/*
  <quick-add-sheet>: pick a variant and add it to the cart without leaving the page.
  Markup: snippets/quick-add-sheet.liquid. Styles: assets/quick-add-sheet.css.
  Loaded globally (layout/theme.liquid) so sheets inserted later by AJAX (cart drawer re-renders,
  collection filtering) work without re-running scripts.

  - Openers: any element with [data-quick-add-sheet] and aria-controls="<sheet id>" (document-level
    click delegation, so openers rendered after load work too).
  - One option: tapping an available chip adds it. Several options: select one chip per option,
    then "Add to Bag". Chips with no available variant for the current selection are disabled.
  - Open: moved into <body> (bottom sheet on mobile, centred dialog on desktop); close puts it back.
  - QuickAddSheet.addVariant(variantId, button) is the shared add: it updates and opens the cart
    drawer when there is one, otherwise goes to /cart. Also used by assets/cart-recommendations.js
    for single-variant "+ Add".
*/
if (!customElements.get('quick-add-sheet')) {
  class QuickAddSheet extends HTMLElement {
    static async addVariant(variantId, button) {
      const drawer = document.querySelector('cart-drawer');
      const sections = drawer ? drawer.getSectionsToRender().map((section) => section.id) : [];
      const label = button.innerHTML; // chip value, "+ Add" (with icon) or "Add to Bag"
      // One add at a time per sheet: while busy, onClick ignores chips/Add and update() keeps
      // "Add to Bag" disabled, so a second tap can't add the item twice.
      const sheet = button.closest('quick-add-sheet');
      sheet?.setAttribute('aria-busy', 'true');

      button.disabled = true;
      const adding = button.closest('[data-adding-label]')?.dataset.addingLabel;
      if (adding) button.textContent = adding;

      try {
        const response = await fetch(`${routes.cart_add_url}`, {
          ...fetchConfig('javascript'),
          body: JSON.stringify({
            items: [{ id: Number(variantId), quantity: 1 }],
            sections,
            sections_url: window.location.pathname,
          }),
        });
        const data = await response.json();
        if (!response.ok || data.status) throw new Error(data.description || data.message || 'Add failed');

        if (!drawer) {
          window.location = routes.cart_url;
          return;
        }
        // Re-renders (and opens) the drawer; any sheet inside it is replaced, i.e. closed.
        document.querySelector('quick-add-sheet:not([hidden])')?.close({ restoreFocus: false });
        drawer.renderContents(data);
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'quick-add-sheet', cartData: data });
        // A button outside the drawer (sheet on a collection/product card, or a "+ Add" not
        // re-rendered) survives the add: reset it so the next add works without a reload.
        if (button.isConnected) {
          button.innerHTML = label;
          button.disabled = false;
          if (button.classList.contains('quick-add-sheet__chip')) button.setAttribute('aria-pressed', 'false');
          sheet?.removeAttribute('aria-busy');
          sheet?.update(); // re-derives "Add to Bag" and chip states
        }
      } catch (error) {
        console.error('[quick-add-sheet] add failed:', error);
        button.disabled = false;
        // A one-option chip was marked pressed on tap; nothing was added, so unmark it.
        if (button.classList.contains('quick-add-sheet__chip')) button.setAttribute('aria-pressed', 'false');
        if (window.cartStrings?.error) button.textContent = window.cartStrings.error;
        else button.innerHTML = label;
        setTimeout(() => {
          button.innerHTML = label;
        }, 3000);
      } finally {
        sheet?.removeAttribute('aria-busy');
      }
    }

    connectedCallback() {
      if (this.bound) return; // moved to <body> on open: don't bind twice
      this.bound = true;
      this.variants = JSON.parse(this.querySelector('[data-variants]').textContent);
      // Server-rendered price ("From ₹x" when variants differ); replaced by the chosen variant's price.
      this.priceElement = this.querySelector('.quick-add-sheet__price');
      this.defaultPrice = this.priceElement?.innerHTML;
      this.addEventListener('click', (event) => this.onClick(event));
      this.addEventListener('keyup', (event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation(); // cart-drawer.js closes the drawer on keyup Escape; only the sheet closes
        this.close();
      });
    }

    open(opener) {
      document.querySelector('quick-add-sheet:not([hidden])')?.close({ restoreFocus: false });
      // While open, live directly in <body>: full-width bottom sheet on mobile, centred dialog on
      // desktop (assets/quick-add-sheet.css), above the cart drawer, and free of any card or drawer
      // whose transform/overflow would trap a position: fixed element. A placeholder marks where
      // it came from so close() can put it back (keeps AJAX re-renders of that area clean).
      if (this.parentElement !== document.body) {
        this.placeholder = document.createComment('quick-add-sheet');
        this.before(this.placeholder);
        document.body.appendChild(this);
      }
      this.opener = opener;
      this.hidden = false;
      opener.setAttribute('aria-expanded', 'true');
      this.update();
      // Modal: keep Tab inside the sheet (Dawn's trapFocus, global.js) and stop the page scrolling
      // behind it. The cart drawer may already hold the lock; remember so close() leaves it.
      this.lockedScroll = !document.body.classList.contains('overflow-hidden');
      document.body.classList.add('overflow-hidden');
      const first = this.querySelector('.quick-add-sheet__chip:not([disabled])');
      if (typeof trapFocus === 'function') trapFocus(this.querySelector('.quick-add-sheet__panel'), first);
      first?.focus({ preventScroll: true });
    }

    close({ restoreFocus = true } = {}) {
      this.hidden = true;
      this.opener?.setAttribute('aria-expanded', 'false');
      // Back to its original place; if that area was re-rendered meanwhile, this copy is stale.
      if (this.placeholder?.isConnected) this.placeholder.replaceWith(this);
      else if (this.placeholder) this.remove();
      this.placeholder = null;
      if (this.lockedScroll) document.body.classList.remove('overflow-hidden');
      this.lockedScroll = false;

      // Hand focus back: re-trap the cart drawer if it is still open (trapFocus replaces the
      // drawer's own trap), otherwise release the trap.
      const opener = restoreFocus && this.opener?.isConnected ? this.opener : null;
      const drawer = document.querySelector('cart-drawer.active #CartDrawer');
      if (drawer && typeof trapFocus === 'function') trapFocus(drawer, opener || drawer);
      else {
        if (typeof removeTrapFocus === 'function') removeTrapFocus();
        opener?.focus();
      }
    }

    onClick(event) {
      const target = event.target;
      if (target.closest('[data-quick-add-close]')) return this.close();
      if (this.getAttribute('aria-busy') === 'true') return; // an add is running

      const chip = target.closest('.quick-add-sheet__chip');
      if (chip && !chip.disabled) return this.select(chip);

      const add = target.closest('.quick-add-sheet__add');
      if (add && !add.disabled) QuickAddSheet.addVariant(add.dataset.variantId, add);
    }

    // Current selection by option position (undefined = not chosen yet).
    selection() {
      return [...this.querySelectorAll('.quick-add-sheet__chips')].map(
        (group) => group.querySelector('[aria-pressed="true"]')?.dataset.value,
      );
    }

    select(chip) {
      const group = chip.closest('.quick-add-sheet__chips');
      const index = Number(group.dataset.optionIndex);

      if (this.variants[0].options.length === 1) {
        // One option: the chip is the whole choice, so add straight away.
        const variant = this.variants.find((v) => v.available && v.options[index] === chip.dataset.value);
        if (!variant) return;
        chip.setAttribute('aria-pressed', 'true');
        QuickAddSheet.addVariant(variant.id, chip);
        return;
      }

      const pressed = chip.getAttribute('aria-pressed') === 'true';
      group.querySelectorAll('.quick-add-sheet__chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', String(!pressed));
      this.update();
    }

    // Disable each chip no available variant offers with the other current selections; enable
    // "Add to Bag" only when every option is chosen and that exact variant is available.
    update() {
      const selection = this.selection();
      const available = this.variants.filter((v) => v.available);

      this.querySelectorAll('.quick-add-sheet__chips').forEach((group) => {
        const index = Number(group.dataset.optionIndex);
        group.querySelectorAll('.quick-add-sheet__chip').forEach((chip) => {
          chip.disabled = !available.some((v) =>
            v.options.every((value, i) =>
              i === index ? value === chip.dataset.value : !selection[i] || value === selection[i],
            ),
          );
          if (chip.disabled) chip.setAttribute('aria-pressed', 'false');
        });
      });

      const add = this.querySelector('.quick-add-sheet__add');
      if (!add) return;
      const chosen = this.selection();
      const variant = available.find((v) => v.options.every((value, i) => value === chosen[i]));
      add.disabled = !variant || this.getAttribute('aria-busy') === 'true';
      if (variant) add.dataset.variantId = variant.id;
      // Show what will be charged: the chosen variant's price, else the server-rendered default.
      if (this.priceElement) {
        if (variant) this.priceElement.textContent = variant.price;
        else this.priceElement.innerHTML = this.defaultPrice;
      }
    }
  }

  customElements.define('quick-add-sheet', QuickAddSheet);
  window.QuickAddSheet = QuickAddSheet;

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-quick-add-sheet]');
    if (!opener) return;
    event.preventDefault(); // openers may be links to the product page (no-JS fallback)
    document.getElementById(opener.getAttribute('aria-controls'))?.open(opener);
  });
}
