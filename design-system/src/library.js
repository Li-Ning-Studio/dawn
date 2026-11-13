import { t, esc, icon, logo, button, link, field, heading, section, pill, card, messages } from './ui.js';
import { products, capturedAt } from './model.js';
import tokens from '../public/tokens.json';

const navItems = ['foundations', 'components', 'commerce', 'guidelines'];
export function shell(route, content) {
  return `<a class="skip-link" href="#main-content">${t('app.skip')}</a><div class="library-layout"><aside class="library-sidebar"><a href="#foundations" class="library-brand">${logo()}<span>${t('app.title')}</span></a><div class="sidebar-body"><p class="eyebrow">${t('app.version')}</p><nav aria-label="${t('app.nav_label')}">${navItems.map((id, i) => `<a href="#${id}" ${route === id ? 'aria-current="page"' : ''}><span class="nav-number">0${i + 1}</span>${t('nav.' + id)}${icon('arrow')}</a>`).join('')}</nav></div><div class="sidebar-footer"><p>${t('app.footer')}</p><span class="caption">${t('app.eyebrow')}</span></div></aside><div class="library-body"><header class="library-topbar"><a class="mobile-brand" href="#foundations">${logo()}</a><span class="topbar-label">${t('app.eyebrow')}</span><div class="topbar-actions">${link(t('nav.shop'), '#shop', 'ds-button--small ds-button--secondary')}<details class="mobile-nav"><summary aria-label="${t('app.open_navigation')}">${icon('hamburger')}</summary><nav aria-label="${t('app.nav_label')}">${navItems.map((id) => `<a href="#${id}">${t('nav.' + id)}</a>`).join('')}</nav></details></div></header><main id="main-content" class="library-main" tabindex="-1">${content}</main><footer class="library-footer"><span>HNDRD</span><p>${t('app.demo_note')}</p></footer></div></div>`;
}
function specimen(markup, id) {
  return `<div class="specimen" id="${id}"><div class="specimen-preview" aria-label="${t('app.preview_label')}">${markup}</div><details class="code-disclosure"><summary>${t('app.code')}</summary>${button(t('app.copy'), 'copy', 'ds-button--small ds-button--secondary', `data-code="${id}-code"`)}<pre><code id="${id}-code">${esc(markup)}</code></pre></details></div>`;
}
export function foundations() {
  const colours = ['canvas', 'surface', 'ink', 'muted', 'line', 'accent'];
  const labels = { canvas: 'white', surface: 'surface', ink: 'ink', muted: 'muted', line: 'line', accent: 'accent' };
  const palette = `<div class="palette">${colours.map((name) => `<div class="palette-item"><div class="palette-chip" style="background:var(--hndrd-color-${name})" aria-hidden="true"></div><h3>${t('foundation.' + labels[name])}</h3><code>${tokens.color[name].toUpperCase()}</code><p class="caption">--hndrd-color-${name}</p></div>`).join('')}</div>`;
  const type = `<div class="type-table">${[
    ['display', 'display'],
    ['title', 'title_role'],
    ['heading', 'heading'],
    ['body', 'body'],
    ['caption', 'caption'],
  ]
    .map(
      ([role, label]) =>
        `<div class="type-row"><div><span class="eyebrow">${t('foundation.' + label)}</span><code>${tokens.type[role]}</code></div><p class="type-${role}">${t('foundation.type_sample')}</p></div>`,
    )
    .join('')}</div>`;
  const space = `<div class="space-scale">${Object.entries(tokens.space)
    .map(
      ([key, value]) =>
        `<div><span class="space-block" style="height:${value}" aria-hidden="true"></span><code>${value}</code></div>`,
    )
    .join('')}</div>`;
  return (
    heading(t('foundation.eyebrow'), t('foundation.title'), t('foundation.intro')) +
    `<div class="intro-actions">${link(t('app.preview'), '#shop')}<a class="text-link" href="/tokens.json" download>${t('app.download_tokens')}</a></div>` +
    section(t('foundation.palette'), t('foundation.palette_note'), palette) +
    section(t('foundation.type'), t('foundation.type_note'), type) +
    section(t('foundation.space'), t('foundation.space_note'), space) +
    section(
      t('foundation.shape'),
      t('foundation.shape_note'),
      `<div class="action-row">${button(t('foundation.primary'), 'toast')}${button(t('foundation.secondary'), 'toast', 'ds-button--secondary')}${button(t('foundation.disabled'), 'noop', '', 'disabled')}</div><p class="muted">${t('foundation.swatches_note')}</p>`,
    ) +
    section(
      t('foundation.motion'),
      t('foundation.motion_note'),
      `<div class="motion-samples">${['fast', 'measured', 'slow'].map((name, i) => `<button class="motion-sample" data-action="motion" style="--sample-duration:${[150, 240, 400][i]}ms"><span>${icon('arrow')}</span>${t('foundation.' + name)}</button>`).join('')}</div>`,
    ) +
    section(
      t('foundation.layout'),
      t('foundation.layout_note'),
      `<div class="mini-grid">${products.map(card).join('')}</div>`,
    )
  );
}
export function statePreview(state) {
  if (state === 'loading')
    return `<div class="feedback-block" role="status"><span class="spinner" aria-hidden="true"></span><p>${t('component.loading')}</p><div class="skeleton-row" aria-hidden="true"><span></span><span></span></div></div>`;
  if (state === 'error')
    return `<div class="feedback-block feedback-block--error" role="alert">${icon('error')}<h3>${t('component.error')}</h3><p>${t('component.error_help')}</p>${button(t('component.retry'), 'state-retry', 'ds-button--secondary')}</div>`;
  if (state === 'empty')
    return `<div class="feedback-block"><h3>${t('component.empty')}</h3><p>${t('component.empty_help')}</p>${button(t('shop.clear'), 'state-reset', 'ds-button--secondary')}</div>`;
  if (state === 'success')
    return `<div class="alert alert--success" role="status">${icon('success')}<p>${t('component.success')}</p></div>`;
  if (state === 'disabled') return button(t('foundation.disabled'), 'noop', '', 'disabled');
  return `<div class="mini-grid two-columns">${products.slice(0, 2).map(card).join('')}</div>`;
}
export function components(state = 'default') {
  const actions = `<div class="action-row">${button(t('foundation.primary'), 'toast')}${button(t('foundation.secondary'), 'toast', 'ds-button--secondary')}${button(t('foundation.disabled'), 'noop', '', 'disabled')}<a class="text-link" href="#commerce">${t('nav.commerce')}</a></div>`;
  const forms = `<form id="example-form" novalidate class="example-form">${field('example-email', t('component.email'), `<input class="ds-input" type="email" id="example-email" name="email" placeholder="${t('component.email_placeholder')}" autocomplete="email" required aria-describedby="example-email-hint example-form-message">`, t('component.email_hint'))}${field('example-size', t('component.size'), `<select class="ds-input" id="example-size"><option value="">${t('component.choose_size')}</option><option>S</option><option>M</option><option>L</option><option>XL</option></select>`)}<label class="check-label"><input type="checkbox" name="updates">${t('component.terms')}</label><fieldset><legend>${t('component.radio_label')}</legend><div class="action-row"><label class="check-label"><input type="radio" name="delivery" value="standard" checked>${t('component.standard')}</label><label class="check-label"><input type="radio" name="delivery" value="express">${t('component.express')}</label></div></fieldset><label class="switch-label"><input type="checkbox" role="switch" checked><span>${t('component.toggle')}</span></label><p id="example-form-message" class="field-message" role="status"></p><button class="ds-button" type="submit">${t('component.validate')}</button></form>`;
  const feedback = `<div class="action-row">${pill(t('component.status_new'))}${pill(t('component.status_sold'))}${pill(t('component.status_sale'), 'badge--accent')}</div><div class="alert" role="status">${icon('checkmark')}<div><strong>${t('component.notice')}</strong><p>${t('component.notice_body')}</p></div></div><label class="field state-picker" for="component-state"><span>${t('component.states')}</span><select id="component-state" class="ds-input">${['default', 'loading', 'error', 'empty', 'success', 'disabled'].map((value) => `<option value="${value}" ${state === value ? 'selected' : ''}>${t('component.state_' + value)}</option>`).join('')}</select></label><p class="caption muted">${t('component.state_note')}</p><div id="state-preview">${statePreview(state)}</div>`;
  const tabs = `<div class="tabs" role="tablist" aria-label="${t('component.tabs_label')}">${['details', 'specs', 'care'].map((id, i) => `<button class="tab" id="tab-${id}" role="tab" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" data-action="tab" data-tab="${id}">${t('component.' + id)}</button>`).join('')}</div>${['details', 'specs', 'care'].map((id, i) => `<div class="tab-panel" id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}" tabindex="0" ${i ? 'hidden' : ''}><p>${t('component.tab_' + id)}</p></div>`).join('')}<div class="accordion-group">${[1, 2].map((i) => `<details class="accordion"><summary>${t('component.faq_' + i)}${icon('plus')}</summary><p>${t('component.faq_' + i + '_body')}</p></details>`).join('')}</div>`;
  return (
    heading(t('component.eyebrow'), t('component.title'), t('component.intro')) +
    section(t('component.actions'), t('component.actions_note'), specimen(actions, 'actions')) +
    section(t('component.forms'), t('component.forms_note'), specimen(forms, 'forms')) +
    section(t('component.feedback'), t('component.feedback_note'), feedback) +
    section(t('component.disclosure'), t('component.disclosure_note'), specimen(tabs, 'disclosure')) +
    section(
      t('component.overlays'),
      t('component.overlays_note'),
      `<div class="action-row">${button(t('component.open_dialog'), 'demo-dialog')}${button(t('component.open_drawer'), 'demo-drawer', 'ds-button--secondary')}</div>`,
    )
  );
}
export function commerce() {
  const scenario = `<label class="field" for="stringing-scenario"><span>${t('stringing.state_title')}</span><select class="ds-input" id="stringing-scenario">${['normal', 'loading', 'error', 'empty', 'four_off', 'base_off'].map((key) => `<option value="${key}">${t('stringing.scenario_' + key)}</option>`).join('')}</select></label><p class="caption muted">${t('stringing.state_note')}</p>`;
  return (
    heading(t('commerce.eyebrow'), t('commerce.title'), t('commerce.intro')) +
    `<div class="intro-actions">${link(t('commerce.start'), '#shop')}</div><p class="caption muted">${t('commerce.fixture_note')}</p>` +
    section(
      t('commerce.collection'),
      t('commerce.collection_note'),
      `<div class="mini-grid">${products.map(card).join('')}</div>`,
    ) +
    section(
      t('commerce.product'),
      t('commerce.product_note'),
      `<div class="purchase-specimen"><img src="${products[0].cardImage}" alt="${products[0].name}" width="400" height="400"><div><p class="eyebrow">${t('shop.weight')} · 4U</p><h3>${products[0].name}</h3><p>${t('shop.stringing_description')}</p>${link(t('commerce.view'), '#product/' + products[0].handle)}</div></div>`,
    ) +
    section(
      t('commerce.stringing'),
      t('commerce.stringing_note'),
      scenario + button(t('commerce.try_stringing'), 'try-stringing'),
    ) +
    section(
      t('commerce.cart'),
      t('commerce.cart_note'),
      button(t('commerce.open_cart'), 'open-cart', 'ds-button--secondary'),
    ) +
    section(
      t('commerce.recommendations'),
      t('commerce.recommendations_note'),
      `<div class="slider-toolbar">${button(t('commerce.previous'), 'slider-prev', 'ds-button--small ds-button--secondary')}${button(t('commerce.next'), 'slider-next', 'ds-button--small ds-button--secondary')}</div><div class="product-slider" id="recommendation-slider" tabindex="0" aria-label="${t('commerce.recommendations')}">${products.map(card).join('')}</div>`,
    ) +
    section(t('commerce.campaign'), t('commerce.campaign_note'), campaignMarkup())
  );
}
export function campaignMarkup() {
  return `<div class="editorial"><div><p class="eyebrow">HNDRD / NITRIX</p><h2>${t('shop.editorial_title')}</h2><p>${t('shop.editorial_copy')}</p>${link(t('shop.editorial_action'), '#product/nitrix-70-venom', 'ds-button--secondary')}</div><img src="/assets/nitrix-70-venom-1.png" alt="${products[0].name}" width="800" height="800" loading="lazy"></div><div class="campaign-strip"><div>${pill(t('shop.sale_badge'), 'badge--accent')}<h3>${t('shop.sale_title')}</h3><p>${t('shop.sale_copy')}</p></div>${link(t('shop.sale_action'), '#shop', 'ds-button--light')}</div><p class="caption muted">${t('shop.sale_note')}</p>`;
}
export function guidelines() {
  const list = (key) =>
    `<dl class="guideline-list">${messages.guidelines[key].map(([title, body]) => `<div><dt>${esc(title)}</dt><dd>${esc(body)}</dd></div>`).join('')}</dl>`;
  return (
    heading(t('guidelines.eyebrow'), t('guidelines.title'), t('guidelines.intro')) +
    section(t('guidelines.principles'), '', list('principles_items')) +
    section(t('guidelines.usage'), '', list('usage_items')) +
    section(
      t('guidelines.accessibility'),
      t('guidelines.accessibility_note'),
      '<a class="text-link" href="https://www.w3.org/WAI/WCAG22/quickref/" target="_blank" rel="noreferrer">WCAG 2.2 AA</a>',
    ) +
    section(
      t('guidelines.tokens'),
      t('guidelines.tokens_note'),
      `<div class="action-row"><a class="text-link" href="/tokens.json" download>${t('guidelines.tokens_json')}</a><a class="text-link" href="/tokens.css" download>${t('guidelines.tokens_css')}</a></div>`,
    ) +
    section(t('guidelines.adoption'), t('guidelines.adoption_note'), '') +
    section(
      t('guidelines.sources'),
      t('guidelines.source_note', { date: new Date(capturedAt).toLocaleDateString('en-GB') }),
      `<a class="text-link" href="/sources.json" target="_blank">${t('guidelines.source_link')}</a>`,
    ) +
    section(t('guidelines.limits'), t('guidelines.limits_note'), '')
  );
}
