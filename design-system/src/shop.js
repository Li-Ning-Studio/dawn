import { t, esc, icon, logo, button, iconButton, link, pill, card, breadcrumb, money } from './ui.js';
import { products, findString, stringingPrice, services, subtotal, linePrice, findProduct } from './model.js';
export function shopHeader(count = 0) {
  return `<a class="skip-link" href="#main-content">${t('app.skip')}</a><header class="shop-header"><a href="#shop" aria-label="HNDRD">${logo()}</a><nav class="desktop-shop-nav" aria-label="${t('shop.menu')}"><a href="#shop" aria-current="page">${t('shop.all_rackets')}</a><a href="#campaign">${t('nav.campaign')}</a></nav><div class="shop-header__actions">${iconButton(t('shop.search'), 'open-search', 'search')}${iconButton(t('shop.bag') + (count ? ' (' + count + ')' : ''), 'open-cart', 'cart-empty', count ? 'data-count="' + count + '"' : '')}${iconButton(t('shop.menu'), 'open-menu', 'hamburger')}</div></header>`;
}
export function shopFooter() {
  return `<footer class="shop-footer"><span>${t('app.footer')}</span><a class="text-link" href="#foundations">${t('app.back_library')}</a></footer>`;
}
export function filteredProducts(state) {
  let results = products.filter(
    (p) =>
      (!state.filters.available || p.available) &&
      (!state.filters.flex || state.filters.flex === p.flex) &&
      p.name.toLowerCase().includes(state.search.toLowerCase()),
  );
  if (state.sort === 'low') results.sort((a, b) => a.price - b.price);
  if (state.sort === 'high') results.sort((a, b) => b.price - a.price);
  if (state.sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}
export function collection(state) {
  const results = filteredProducts(state);
  const active = state.filters.available || state.filters.flex || state.search;
  return (
    shopHeader(state.cart.reduce((sum, l) => sum + l.quantity, 0)) +
    `<main id="main-content" class="shop-main collection" tabindex="-1"><header class="collection-intro">${breadcrumb()}<h1>${t('shop.title').replace('\n', '<br>')}</h1><p>${t('shop.tagline')}</p><div class="collection-tools">${button(t('shop.filter'), 'open-filter', '', '', 'filter')}${button(t('shop.sort'), 'open-sort', 'ds-button--secondary', '', 'caret')}${active ? button(t('shop.clear'), 'clear-filters', 'ds-button--text') : ''}</div></header>${active ? `<p class="caption result-count" role="status">${t('shop.results', { count: results.length })}</p>` : ''}<div class="product-grid" id="collection-grid">${results.length ? results.map(card).join('') : `<div class="empty-state"><h2>${t('shop.no_results')}</h2><p>${t('shop.no_results_help')}</p>${button(t('shop.clear'), 'clear-filters', 'ds-button--secondary')}</div>`}</div></main>` +
    shopFooter()
  );
}
export function stringingSummary(config) {
  if (!config) return t('shop.unstrung');
  const string = findString(config.string);
  const variant = string.variants.find((v) => String(v.id) === String(config.variant));
  return t('stringing.summary_line', {
    string: string.title,
    colour: variant.title,
    tension: config.tension,
    method: t('stringing.' + config.method),
  });
}
export function quantityControl(quantity, action, id = '', label = t('shop.quantity')) {
  return `<div class="quantity" role="group" aria-label="${esc(label)}">${iconButton(t('shop.decrease'), action, 'minus', `data-delta="-1" data-id="${id}" ${quantity <= 1 ? 'disabled' : ''}`)}<output aria-label="${esc(label)}">${quantity}</output>${iconButton(t('shop.increase'), action, 'plus', `data-delta="1" data-id="${id}" ${quantity >= 99 ? 'disabled' : ''}`)}</div>`;
}
export function productPage(product, state) {
  const selection = state.selections[product.handle];
  const variant = product.variants.find((v) => String(v.id) === String(selection.variant));
  const specs = [
    [t('shop.weight'), product.weight],
    [t('shop.flex'), t('shop.' + product.flex)],
    [t('shop.max_tension'), t('stringing.lbs', { value: product.maxTension })],
    [t('shop.shaft'), product.shaft],
    [t('shop.grip'), product.grip],
  ];
  return (
    shopHeader(state.cart.reduce((sum, l) => sum + l.quantity, 0)) +
    `<main id="main-content" class="shop-main product-page" tabindex="-1"><a class="text-link back-link" href="#shop">${t('shop.all_rackets')}</a><div class="product-layout"><section class="gallery" aria-label="${t('shop.gallery')}"><div class="main-product-image"><img id="main-product-image" src="${product.images[selection.image || 0]}" width="900" height="900" alt="${esc(product.title)}"></div><div class="thumbnails">${product.images.map((img, i) => `<button class="thumbnail ${i === (selection.image || 0) ? 'is-selected' : ''}" data-action="product-image" data-image="${i}" aria-label="${t('shop.view_image', { index: i + 1 })}" aria-pressed="${i === (selection.image || 0)}"><img src="${img}" alt="" width="120" height="120"></button>`).join('')}</div></section><section class="purchase-panel"><p class="eyebrow">HNDRD / NITRIX</p><h1>${esc(product.name)}</h1><p class="lead muted">${product.weight} · ${t('shop.' + product.flex)}</p><div class="product-price">${money(variant?.price ?? product.price)}${!variant?.available ? pill(t('shop.sold_out')) : ''}</div><p class="caption muted">${t('shop.taxes')}</p><fieldset class="variant-field"><legend>${t('shop.weight')}</legend><label class="text-option"><input type="radio" name="weight" value="4U" checked><span>4U</span></label></fieldset>${product.options[0]?.name === 'Color' ? `<fieldset class="variant-field"><legend>${t('shop.colour')}</legend><div class="option-row">${product.variants.map((v) => `<label class="text-option"><input type="radio" name="product-variant" value="${v.id}" ${String(v.id) === String(selection.variant) ? 'checked' : ''} ${!v.available ? 'disabled' : ''}><span>${esc(v.title)}${!v.available ? `<small>${t('shop.sold_out')}</small>` : ''}</span></label>`).join('')}</div></fieldset>` : ''}<div class="service-row"><div><h2>${t('shop.stringing_title')}</h2><p>${esc(stringingSummary(selection.stringing))}</p>${selection.stringing ? `<strong>${money(stringingPrice(selection.stringing))}</strong>` : `<p class="caption">${t('shop.stringing_description')}</p>`}</div>${button(selection.stringing ? t('shop.edit_stringing') : t('shop.customise'), 'open-stringing', 'ds-button--secondary ds-button--small', !variant?.available ? 'disabled' : '')}</div>${selection.stringing ? button(t('shop.remove_stringing'), 'remove-product-stringing', 'ds-button--text') : ''}<div class="purchase-actions">${quantityControl(selection.quantity, 'product-quantity')}${button(variant?.available ? t('shop.add') : t('shop.sold_out'), 'add-cart', '', !variant?.available ? 'disabled' : '')}</div><details class="accordion" open><summary>${t('shop.specifications')}${icon('plus')}</summary><dl class="spec-list">${specs.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></details><details class="accordion"><summary>${t('shop.product_details')}${icon('plus')}</summary><p>${t('shop.details_copy')}</p><a class="text-link" href="${product.url}" target="_blank" rel="noreferrer">${t('shop.read_source')}</a></details><details class="accordion"><summary>${t('shop.delivery_heading')}${icon('plus')}</summary><p>${t('shop.delivery_copy')}</p></details></section></div><section class="related-section"><h2>${t('shop.related')}</h2><div class="product-slider">${products
      .filter((p) => p.handle !== product.handle)
      .map(card)
      .join('')}</div></section></main>` +
    shopFooter()
  );
}
export function cartContent(state) {
  if (!state.cart.length)
    return `<div class="empty-state"><h3>${t('cart.empty')}</h3><p>${t('cart.empty_body')}</p>${link(t('cart.browse'), '#shop')}</div>`;
  return `<div class="cart-items">${state.cart
    .map((line) => {
      const p = findProduct(line.product);
      const v = p.variants.find((v) => String(v.id) === String(line.variant));
      return `<article class="cart-item"><a href="#product/${p.handle}"><img src="${p.cardImage}" alt="${esc(p.name)}" width="100" height="100"></a><div class="cart-item__body"><a href="#product/${p.handle}"><h3>${esc(p.name)}</h3></a><p class="caption muted">4U${v.title !== 'Default Title' ? ' · ' + esc(v.title) : ''}</p><strong>${money(linePrice(line))}</strong>${quantityControl(line.quantity, 'cart-quantity', line.id, t('cart.quantity', { product: p.name }))}${button(t('cart.remove', { product: p.name }), 'cart-remove', 'ds-button--text', `data-id="${line.id}"`)}${line.stringing ? `<div class="cart-service"><p>${esc(stringingSummary(line.stringing))}</p><p class="caption">${t('cart.service_breakdown')} · ${money(stringingPrice(line.stringing))}</p><div class="action-row">${button(t('cart.edit'), 'cart-stringing', 'ds-button--text', `data-id="${line.id}"`)}${button(t('cart.remove_service'), 'cart-remove-service', 'ds-button--text', `data-id="${line.id}"`)}</div></div>` : ''}</div></article>`;
    })
    .join(
      '',
    )}</div><div class="cart-summary"><div><span>${t('cart.subtotal')}</span><strong id="cart-subtotal">${money(subtotal(state.cart))}</strong></div><p class="caption muted">${t('cart.shipping')}</p>${button(t('cart.checkout'), 'checkout', 'full-width')}${button(t('shop.continue'), 'close-overlay', 'ds-button--text full-width')}</div>`;
}
