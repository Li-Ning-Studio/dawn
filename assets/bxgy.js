// BXGY only selects and adds merchandise. Shopify's native discount remains
// responsible for its price, and subsequent cart edits are independent.
window.Bxgy = {
  notice: null,

  selectGifts(offers, collections, quantity, instanceId) {
    const offer = offers?.find((candidate) => collections?.includes(candidate.trigger_collection));
    if (!offer) return { items: [], unavailable: false };

    const gifts = offer.gifts || [];
    const count = Number(offer.expected_count);
    // A truncated collection is missing data, unlike a known sold-out gift.
    // Keep that guard before filtering so missing products cannot be silently
    // interpreted as unavailable. Liquid has already applied product priority.
    if (gifts.length !== count) {
      return { items: [], unavailable: true };
    }

    const availableGifts = gifts.filter((gift) => gift.id);
    return {
      unavailable: availableGifts.length !== gifts.length,
      items: availableGifts.map((gift) => ({
        id: gift.id,
        quantity: Number(quantity),
        properties: { _offer: offer.offer_name || '', _offerInstanceId: instanceId },
      })),
    };
  },

  async readCart() {
    const response = await fetch(`${routes.cart_url}.js`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Unable to check gift additions.');
    const cart = await response.json();
    if (!Array.isArray(cart.items)) throw new Error('Unable to confirm gift additions.');
    return cart;
  },

  async renderSections(sections) {
    if (sections.length === 0) return {};
    // Shopify's /cart route negotiates on Accept. Asking for application/json
    // returns cart data instead of the requested section HTML, even with
    // ?sections present. Use the default Accept header for section rendering.
    const response = await fetch(`${routes.cart_url}?sections=${encodeURIComponent(sections.join(','))}`);
    if (!response.ok) throw new Error('Unable to refresh the cart after adding gifts.');
    const renderedSections = await response.json();
    if (sections.some((section) => typeof renderedSections?.[section] !== 'string')) {
      throw new Error('Unable to render the cart after adding gifts.');
    }
    return renderedSections;
  },

  async addGifts(items, instanceId, sections) {
    // Discounts can split one variant across lines. Count only this attempt's
    // quantities, without interpreting prices or including earlier purchases.
    const quantityAdded = (lines, expected) =>
      (Array.isArray(lines) ? lines : [])
        .filter(
          (line) =>
            String(line.variant_id || line.id) === String(expected.id) &&
            line.properties?._offerInstanceId === instanceId,
        )
        .reduce((quantity, line) => quantity + Number(line.quantity), 0);

    let cart;
    for (const item of items) {
      cart = null;
      let confirmed = false;
      try {
        // Independent requests let later gifts proceed when this variant has
        // sold out since the page rendered. Each variant is attempted once.
        const response = await fetch(routes.cart_add_url, {
          ...fetchConfig(),
          body: JSON.stringify({ items: [item] }),
        });
        const added = await response.json();
        confirmed = response.ok && !added.status && quantityAdded(added.items, item) >= item.quantity;
      } catch (error) {
        console.error('Unable to confirm the gift addition:', error);
      }

      // A stock error or lost response can still mean some units were added.
      // Preserve them and establish the cart state before attempting another
      // gift. If the read fails, the caller stops and refreshes the drawer.
      if (!confirmed) cart = await this.readCart();
    }

    cart = cart || (await this.readCart());
    // Refresh once after all attempts, including any partially fulfilled last
    // request. Reading sections never changes cart quantities or discounts.
    const renderedSections = await this.renderSections(sections);

    return {
      items: cart.items.filter((item) => item.properties?._offerInstanceId === instanceId),
      sections: renderedSections,
      notice: items.some((item) => quantityAdded(cart.items, item) < item.quantity) ? 'unavailable' : null,
    };
  },

  // Rewards progress bar gifts (window.s3_milestoneGifts, set in layout/theme.liquid). Shopify never
  // adds merchandise by itself: the matching Buy X Get Y discount ("spends a minimum amount") makes the
  // gift ₹0, and this keeps exactly one marked gift line (_milestoneGift = milestone number) in the
  // cart while the subtotal without gifts reaches the threshold, and none below it, so an unearned
  // gift never reaches checkout at full price. Runs after every cartUpdate event and once on page
  // load. It never publishes cartUpdate itself, so it cannot loop.
  milestoneGiftsSync: null,
  milestoneGiftsQueued: false,
  // Milestones whose gift came back with a price (the Shopify discount is not applying). Skipped for
  // the rest of this page view so every cart change doesn't add and remove it again; the next page
  // load tries once more, which picks up a fixed discount.
  milestoneGiftsUndiscounted: new Set(),

  syncMilestoneGifts() {
    // One sync at a time; changes made meanwhile get a single follow-up pass.
    if (this.milestoneGiftsSync) {
      this.milestoneGiftsQueued = true;
      return this.milestoneGiftsSync;
    }
    this.milestoneGiftsSync = this.applyMilestoneGifts()
      .catch((error) => console.error('[bxgy] milestone gift sync failed:', error))
      .finally(() => {
        this.milestoneGiftsSync = null;
        if (this.milestoneGiftsQueued) {
          this.milestoneGiftsQueued = false;
          this.syncMilestoneGifts();
        }
      });
    return this.milestoneGiftsSync;
  },

  async applyMilestoneGifts() {
    const gifts = window.s3_milestoneGifts || [];
    let cart = await this.readCart();
    const giftLines = cart.items.filter((item) => item.properties?._milestoneGift);
    const subtotal =
      cart.items_subtotal_price - giftLines.reduce((total, item) => total + Number(item.final_line_price), 0);

    const updates = {};
    const additions = [];
    let soldOut = false;
    // Lines from a milestone that no longer has a gift (setting cleared) are removed too.
    giftLines
      .filter((item) => !gifts.some((gift) => gift.milestone === item.properties._milestoneGift))
      .forEach((item) => (updates[item.key] = 0));

    gifts.forEach((gift) => {
      const lines = giftLines.filter((item) => item.properties._milestoneGift === gift.milestone);
      // Never keep a gift the discount isn't making free: a sync mistake must not charge for it.
      const earned = subtotal >= gift.threshold;
      const reached = earned && !this.milestoneGiftsUndiscounted.has(gift.milestone);
      // Keep the first line at quantity 1 when it is still the configured gift. A sold-out gift
      // (variantId null) keeps a line that is already in the cart rather than taking it away.
      lines.forEach((item, index) => {
        const isGift = !gift.variantId || String(item.variant_id) === String(gift.variantId);
        const isFree = Number(item.final_line_price) === 0;
        // Below the amount a price is expected (the discount's minimum isn't met): just remove it.
        if (earned && isGift && !isFree) this.flagUndiscountedGift(gift.milestone, item);
        const quantity = reached && index === 0 && isGift && isFree ? 1 : 0;
        if (item.quantity !== quantity) updates[item.key] = quantity;
      });
      const kept = lines.some((item) => updates[item.key] !== 0);
      if (!reached || kept) return;
      if (gift.variantId) {
        additions.push({ id: gift.variantId, quantity: 1, properties: { _milestoneGift: gift.milestone } });
      } else {
        soldOut = true;
      }
    });

    // Only clear our own message, never a product-form BXGY notice.
    if (soldOut) this.setNotice('milestone_unavailable');
    else if (this.notice === 'milestone_unavailable') this.setNotice(null);
    if (Object.keys(updates).length === 0 && additions.length === 0) return;

    if (Object.keys(updates).length > 0) {
      await fetch(`${routes.cart_update_url}`, { ...fetchConfig(), body: JSON.stringify({ updates }) });
    }
    if (additions.length > 0) {
      const response = await fetch(routes.cart_add_url, {
        ...fetchConfig(),
        body: JSON.stringify({ items: additions }),
      });
      if (!response.ok) this.setNotice('milestone_unavailable');
    }
    cart = await this.readCart();

    // Shopify applies automatic discounts in the cart response, so a just-added gift that isn't ₹0
    // means the Buy X Get Y discount is missing, paused or set up differently. Take it straight out.
    const pricedGifts = {};
    cart.items
      .filter((item) => item.properties?._milestoneGift && Number(item.final_line_price) > 0)
      .forEach((item) => {
        this.flagUndiscountedGift(item.properties._milestoneGift, item);
        pricedGifts[item.key] = 0;
      });
    if (Object.keys(pricedGifts).length > 0) {
      await fetch(`${routes.cart_update_url}`, { ...fetchConfig(), body: JSON.stringify({ updates: pricedGifts }) });
      cart = await this.readCart();
    }

    await this.renderCartUI(cart);
  },

  flagUndiscountedGift(milestone, item) {
    if (this.milestoneGiftsUndiscounted.has(milestone)) return;
    this.milestoneGiftsUndiscounted.add(milestone);
    console.warn(
      `[bxgy] Milestone ${milestone} gift "${item.product_title}" is priced at ${item.final_line_price / 100}, ` +
        'not 0: its Buy X Get Y discount is not applying. Removed it from the cart; check the discount.',
    );
  },

  // Refresh whichever cart UIs are on the page (drawer and/or /cart) without opening the drawer,
  // using each component's own section list, as CartItems.updateQuantity does in assets/cart.js.
  async renderCartUI(cart) {
    const empty = cart.item_count === 0;
    for (const cartItems of document.querySelectorAll('cart-items, cart-drawer-items')) {
      const sections = cartItems.getSectionsToRender();
      const rendered = await this.renderSections(sections.map((section) => section.section));
      sections.forEach((section) => {
        const container = document.getElementById(section.id);
        if (!container) return;
        const target = container.querySelector(section.selector) || container;
        target.innerHTML = cartItems.getSectionInnerHTML(rendered[section.section], section.selector);
      });
    }
    document.querySelector('cart-drawer')?.classList.toggle('is-empty', empty);
    document.querySelector('cart-items')?.classList.toggle('is-empty', empty);
    document.getElementById('main-cart-footer')?.classList.toggle('is-empty', empty);
  },

  setNotice(notice) {
    this.notice = notice;
    // Preserve the skipped-gift message when the shopper opens the cart later.
    // Storage may be unavailable in privacy modes, so it must never fail a purchase.
    try {
      if (notice) sessionStorage.setItem('bxgy-notice', JSON.stringify({ notice, at: Date.now() }));
      else sessionStorage.removeItem('bxgy-notice');
    } catch (error) {
      console.debug('Gift notice storage is unavailable.', error);
    }
    document.querySelectorAll('bxgy-notice').forEach((element) => element.showNotice());
  },
};

customElements.define(
  'bxgy-notice',
  class extends HTMLElement {
    connectedCallback() {
      if (!window.Bxgy.notice) {
        try {
          const saved = JSON.parse(sessionStorage.getItem('bxgy-notice'));
          const known = ['unavailable', 'milestone_unavailable'].includes(saved?.notice);
          if (known && Date.now() - saved.at < 5 * 60 * 1000) {
            window.Bxgy.notice = saved.notice;
          }
        } catch (error) {
          // The in-memory notice still works when storage is unavailable.
        }
      }
      this.showNotice();
    }

    showNotice() {
      const notice = window.Bxgy.notice;
      const messages = {
        unavailable: window.cartStrings.giftsUnavailable,
        milestone_unavailable: window.cartStrings.milestoneGiftUnavailable,
      };
      const message = messages[notice] || '';
      const paragraph = document.createElement('p');
      paragraph.textContent = message;
      this.replaceChildren(paragraph);
      this.hidden = !message;
    }
  },
);

// Milestone gifts: re-check after every cart change, and once on load for carts changed elsewhere
// (another tab, a discount or setting change). Also runs while a gift line is still in the cart after
// its setting was cleared, so that line is removed instead of being charged at checkout. Otherwise
// it is skipped entirely, with no extra cart requests.
if (window.s3_milestoneGifts?.length || window.s3_milestoneGiftInCart) {
  subscribe(PUB_SUB_EVENTS.cartUpdate, () => window.Bxgy.syncMilestoneGifts());
  if (window.s3_milestoneGiftsCheckOnLoad) window.Bxgy.syncMilestoneGifts();
}
