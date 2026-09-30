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
          if (saved?.notice === 'unavailable' && Date.now() - saved.at < 5 * 60 * 1000) {
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
      const message = notice === 'unavailable' ? window.cartStrings.giftsUnavailable : '';
      const paragraph = document.createElement('p');
      paragraph.textContent = message;
      this.replaceChildren(paragraph);
      this.hidden = !message;
    }
  },
);
