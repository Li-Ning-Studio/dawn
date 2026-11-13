import locale from './locales/en.json';
export const messages = locale;
export const esc = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function t(key, values = {}) {
  const message = key.split('.').reduce((value, part) => value?.[part], locale);
  if (typeof message !== 'string') throw new Error('Missing translation: ' + key);
  return message.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}
export const money = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount / 100);
export const icon = (name, extra = '') =>
  `<img class="icon ${extra}" src="/assets/icon-${name}.svg" width="24" height="24" alt="" aria-hidden="true">`;
export const logo = () =>
  `<img class="brand-logo" src="/assets/hndrd-wordmark.png" alt="HNDRD" width="150" height="20">`;
export const button = (label, action, style = '', extra = '', iconName = '') =>
  `<button type="button" class="ds-button ${style}" data-action="${action}" ${extra}>${iconName ? icon(iconName) : ''}${esc(label)}</button>`;
export const iconButton = (label, action, name, extra = '') =>
  `<button type="button" class="icon-button" aria-label="${esc(label)}" data-action="${action}" ${extra}>${icon(name)}</button>`;
export const pill = (label, className = '') => `<span class="badge ${className}">${esc(label)}</span>`;
export function card(product) {
  return `<article class="product-card"><a class="product-card__link" href="#product/${product.handle}" aria-label="${esc(t('shop.open_product', { product: product.name }))}"><div class="product-card__media"><img src="${product.cardImage}" width="800" height="800" alt="${esc(product.title)}" loading="lazy">${!product.available ? pill(t('shop.sold_out')) : ''}</div><div class="product-card__body"><h3>${esc(product.name)}</h3><p class="product-card__detail">${product.weight} · ${t('shop.' + product.flex)}</p><p class="product-card__price">${money(product.price)}</p></div></a></article>`;
}
export const breadcrumb = (label = t('shop.breadcrumb')) =>
  `<p class="eyebrow breadcrumb"><span class="accent-dot" aria-hidden="true"></span>${esc(label)}</p>`;
export const field = (id, label, input, hint = '') =>
  `<div class="field"><label for="${id}">${esc(label)}</label>${input}${hint ? `<p class="field-hint" id="${id}-hint">${esc(hint)}</p>` : ''}</div>`;
export const heading = (eyebrow, title, intro) =>
  `<header class="page-intro"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title).replace(/\n/g, '<br>')}</h1><p class="lead">${esc(intro)}</p></header>`;
export const section = (title, note, body, id = '') =>
  `<section class="doc-section" ${id ? `id="${id}"` : ''}><div class="section-intro"><h2>${esc(title)}</h2><p>${esc(note)}</p></div><div class="section-content">${body}</div></section>`;
export const link = (label, href, style = '') =>
  `<a class="ds-button ${style}" href="${href}">${esc(label)}${icon('arrow')}</a>`;
