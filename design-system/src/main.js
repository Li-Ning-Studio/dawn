import './styles.css';
import { t, esc, money, button, iconButton, field, link, messages } from './ui.js';
import {
  products,
  strings,
  services,
  findProduct,
  findString,
  blankStringing,
  validateStringing,
  stringingPrice,
  serviceAvailable,
  addLine,
  clampQuantity,
} from './model.js';
import { shell, foundations, components, commerce, guidelines, statePreview, campaignMarkup } from './library.js';
import { collection, productPage, shopHeader, shopFooter, cartContent } from './shop.js';

const root = document.querySelector('#root');
const dialog = document.querySelector('#overlay');
const state = {
  cart: [],
  filters: { available: false, flex: '' },
  search: '',
  sort: 'featured',
  selections: Object.fromEntries(
    products.map((p) => [
      p.handle,
      { variant: p.variants.find((v) => v.available)?.id ?? p.variants[0].id, quantity: 1, stringing: null, image: 0 },
    ]),
  ),
  scenario: 'normal',
  componentState: 'default',
  modal: null,
  stringing: null,
};
let returnFocus = null;
let toastTimer;
const currentProduct = () => findProduct(location.hash.split('/')[1]) ?? products[0];
const announce = (text) => {
  document.querySelector('#announcement').textContent = text;
};
function toast(text) {
  const el = document.querySelector('#toast');
  el.textContent = text;
  el.hidden = false;
  announce(text);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}
function render() {
  const route = location.hash.slice(1) || 'foundations';
  const content = { foundations, components: () => components(state.componentState), commerce, guidelines };
  document.title = t('app.title');
  if (route === 'shop') root.innerHTML = collection(state);
  else if (route.startsWith('product/')) root.innerHTML = productPage(currentProduct(), state);
  else if (route === 'campaign')
    root.innerHTML =
      shopHeader() +
      `<main id="main-content" class="shop-main campaign-page" tabindex="-1">${campaignMarkup()}</main>` +
      shopFooter();
  else root.innerHTML = shell(content[route] ? route : 'foundations', (content[route] || foundations)());
  root.querySelectorAll('img').forEach((img) =>
    img.addEventListener(
      'error',
      () => {
        img.hidden = true;
        const fallback = document.createElement('p');
        fallback.className = 'image-fallback';
        fallback.textContent = img.alt;
        img.parentElement.append(fallback);
      },
      { once: true },
    ),
  );
}
function renderKeepingFocus() {
  const focused = document.activeElement;
  const action = focused?.dataset.action;
  const id = focused?.dataset.id;
  const delta = focused?.dataset.delta;
  const image = focused?.dataset.image;
  render();
  if (action) {
    const target = [...root.querySelectorAll('[data-action]')].find(
      (el) =>
        el.dataset.action === action &&
        el.dataset.id === id &&
        el.dataset.delta === delta &&
        el.dataset.image === image &&
        !el.disabled,
    );
    target?.focus();
  }
}
function dialogFrame(title, content, drawer = true) {
  dialog.className = drawer ? 'ds-dialog ds-dialog--drawer' : 'ds-dialog';
  dialog.innerHTML = `<div class="dialog-layout"><header class="dialog-header"><h2 id="dialog-title" tabindex="-1">${esc(title)}</h2>${iconButton(t('app.close'), 'close-overlay', 'close')}</header><div class="dialog-content">${content}</div></div>`;
}
function openOverlay(mode, focus = true) {
  if (!dialog.open) returnFocus = document.activeElement;
  state.modal = mode;
  paintOverlay();
  if (!dialog.open) {
    dialog.showModal();
    document.body.classList.add('has-dialog');
  }
  if (focus) (dialog.querySelector('[autofocus]') || dialog.querySelector('#dialog-title'))?.focus();
}
function forceClose() {
  if (dialog.open) dialog.close();
  state.modal = null;
  state.stringing = null;
  document.body.classList.remove('has-dialog');
  if (returnFocus?.isConnected) returnFocus.focus();
  else (root.querySelector('[data-action="open-cart"]') || root.querySelector('main'))?.focus();
}
function requestClose() {
  if (
    state.modal === 'stringing' &&
    state.stringing &&
    JSON.stringify(state.stringing.draft) !== state.stringing.original
  ) {
    state.stringing.confirm = true;
    paintOverlay();
    dialog.querySelector('#dialog-title')?.focus();
    return;
  }
  forceClose();
}
function paintOverlay() {
  if (state.modal === 'cart') return dialogFrame(t('cart.title'), cartContent(state));
  if (state.modal === 'checkout')
    return dialogFrame(
      t('cart.checkout_title'),
      `<p>${t('cart.checkout_body')}</p>${button(t('cart.checkout_back'), 'open-cart')}`,
      false,
    );
  if (state.modal === 'filter')
    return dialogFrame(
      t('shop.filter'),
      `<form id="filter-form"><fieldset><legend>${t('shop.availability')}</legend><label class="check-label"><input name="available" type="checkbox" ${state.filters.available ? 'checked' : ''}>${t('shop.stock')}</label></fieldset><fieldset><legend>${t('shop.flex')}</legend>${['', 'hard', 'flexible'].map((value) => `<label class="check-label"><input name="flex" type="radio" value="${value}" ${value === state.filters.flex ? 'checked' : ''}>${t('shop.' + (value || 'all'))}</label>`).join('')}</fieldset><div class="dialog-actions"><button class="ds-button" type="submit">${t('shop.apply')}</button>${button(t('shop.clear'), 'clear-filters', 'ds-button--secondary')}</div></form>`,
    );
  if (state.modal === 'sort')
    return dialogFrame(
      t('shop.sort'),
      `<form id="sort-form"><fieldset><legend class="sr-only">${t('shop.sort')}</legend>${['featured', 'low', 'high', 'name'].map((value) => `<label class="check-label"><input type="radio" name="sort" value="${value}" ${value === state.sort ? 'checked' : ''}>${t('shop.sort_' + value)}</label>`).join('')}</fieldset><button class="ds-button" type="submit">${t('shop.apply')}</button></form>`,
      false,
    );
  if (state.modal === 'search')
    return dialogFrame(
      t('shop.search'),
      `${field('search-input', t('shop.search_label'), `<input class="ds-input" type="search" id="search-input" placeholder="${t('shop.search_placeholder')}" value="${esc(state.search)}" autofocus autocomplete="off">`)}<div id="search-results" aria-live="polite">${searchResults(state.search)}</div>`,
    );
  if (state.modal === 'menu')
    return dialogFrame(
      t('shop.menu'),
      `<nav class="menu-links">${link(t('shop.all_rackets'), '#shop', 'ds-button--text')}${link(t('nav.campaign'), '#campaign', 'ds-button--text')}${link(t('app.back_library'), '#foundations', 'ds-button--text')}</nav>`,
    );
  if (state.modal === 'stringing') return paintStringing();
  const drawer = state.modal === 'demo-drawer';
  dialogFrame(
    t(drawer ? 'component.drawer_title' : 'component.dialog_title'),
    `<p>${t(drawer ? 'component.drawer_body' : 'component.dialog_body')}</p><div class="dialog-actions">${button(t('component.confirm'), 'demo-confirm')}${button(t('component.cancel'), 'close-overlay', 'ds-button--secondary')}</div>`,
    drawer,
  );
}
function searchResults(query) {
  const found = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return `<p class="caption muted">${t('shop.results', { count: found.length })}</p>${found.length ? found.map((p) => `<a class="search-result" href="#product/${p.handle}"><img src="${p.cardImage}" alt="" width="64" height="64"><span>${esc(p.name)}<small>${money(p.price)}</small></span></a>`).join('') : `<p>${t('shop.no_results_help')}</p>`}`;
}
function beginStringing(product = currentProduct(), cartId = null, scenario = 'normal') {
  const existing = cartId
    ? state.cart.find((line) => line.id === cartId).stringing
    : state.selections[product.handle].stringing;
  const draft = structuredClone(existing || blankStringing());
  state.stringing = {
    product: product.handle,
    cartId,
    scenario,
    draft,
    step: 0,
    error: '',
    confirm: false,
    original: JSON.stringify(draft),
  };
  openOverlay('stringing');
}
function stringChoice(string) {
  const selected = state.stringing.draft.string === string.handle;
  return `<label class="string-option"><input type="radio" name="string" value="${string.handle}" ${selected ? 'checked' : ''}><span><img src="${string.images[0]}" alt="" width="80" height="80"><span><strong>${esc(string.title)}</strong><small>${money(string.price)}</small></span></span></label>`;
}
function paintStringing() {
  const flow = state.stringing;
  const product = findProduct(flow.product);
  const draft = flow.draft;
  if (flow.confirm)
    return dialogFrame(
      t('stringing.discard_title'),
      `<p>${t('stringing.discard_body')}</p><div class="dialog-actions">${button(t('stringing.keep'), 'keep-stringing')}${button(t('stringing.discard'), 'discard-stringing', 'ds-button--secondary')}</div>`,
      false,
    );
  if (['loading', 'error', 'empty'].includes(flow.scenario))
    return dialogFrame(
      t('stringing.title'),
      `<div class="feedback-block" ${flow.scenario === 'error' ? 'role="alert"' : ''}>${flow.scenario === 'loading' ? '<span class="spinner" aria-hidden="true"></span>' : ''}<h3>${t('stringing.' + { loading: 'loading', error: 'load_error', empty: 'empty' }[flow.scenario])}</h3>${button(t('stringing.retry'), 'reset-stringing-scenario', 'ds-button--secondary')}</div>`,
    );
  let body = '';
  const step = flow.step;
  const labels = ['choose_string', 'choose_colour', 'choose_tension', 'choose_method', 'review'];
  if (step === 0)
    body = `<fieldset class="string-options"><legend class="sr-only">${t('stringing.choose_string')}</legend>${strings.map(stringChoice).join('')}</fieldset>${button(t('stringing.no_string'), 'keep-unstrung', 'ds-button--text')}`;
  if (step === 1) {
    const string = findString(draft.string);
    body = `<p class="muted">${esc(string.title)}</p><fieldset class="option-row"><legend class="sr-only">${t('stringing.choose_colour')}</legend>${string.variants.map((v) => `<label class="text-option"><input type="radio" name="string-colour" value="${v.id}" ${String(draft.variant) === String(v.id) ? 'checked' : ''} ${!v.available ? 'disabled' : ''}><span>${esc(v.title)}${!v.available ? `<small>${t('stringing.unavailable')}</small>` : ''}</span></label>`).join('')}</fieldset>`;
  }
  if (step === 2)
    body = `${field('tension-input', t('stringing.tension_label'), `<input class="ds-input" id="tension-input" type="number" min="21" max="${product.maxTension}" step="1" inputmode="numeric" value="${esc(draft.tension)}" aria-describedby="tension-input-hint stringing-error">`, t('stringing.tension_hint', { max: product.maxTension }))}<p class="muted">${t('stringing.limits_note')}</p>`;
  if (step === 3)
    body = `<fieldset class="method-options"><legend class="sr-only">${t('stringing.choose_method')}</legend>${['two', 'four'].map((method) => `<label class="method-option"><input type="radio" name="method" value="${method}" ${draft.method === method ? 'checked' : ''} ${!serviceAvailable(method, flow.scenario) ? 'disabled' : ''}><span><strong>${t('stringing.' + method)}</strong><span>${serviceAvailable(method, flow.scenario) ? money(services[method].variants[0].price) : t('stringing.unavailable')}</span></span></label>`).join('')}</fieldset><p class="caption muted">${t('stringing.replacement_note')}</p>`;
  if (step === 4) {
    const string = findString(draft.string);
    const variant = string.variants.find((v) => String(v.id) === String(draft.variant));
    const rows = [
      [t('stringing.string'), string.title],
      [t('stringing.colour'), variant.title],
      [t('stringing.tension'), t('stringing.lbs', { value: draft.tension })],
      [t('stringing.method'), t('stringing.' + draft.method)],
      [t('stringing.string'), money(variant.price)],
      [t('stringing.service'), money(services[draft.method].variants[0].price)],
    ];
    body = `<dl class="spec-list">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}<div class="summary-total"><dt>${t('stringing.total')}</dt><dd>${money(stringingPrice(draft))}</dd></div></dl>`;
  }
  const progress = `<ol class="stepper" aria-label="${t('component.step_label')}">${messages.stringing.steps.map((label, i) => `<li ${i === step ? 'aria-current="step"' : ''} class="${i <= step ? 'is-active' : ''}"><span aria-hidden="true">${i + 1}</span><small>${esc(label)}</small></li>`).join('')}</ol>`;
  dialogFrame(
    t('stringing.title'),
    progress +
      `<p class="eyebrow">${t('stringing.step', { current: step + 1, total: 5 })}</p><h3 class="step-title">${t('stringing.' + labels[step])}</h3>${body}<p class="field-message is-error" id="stringing-error" role="alert">${flow.error ? t('stringing.' + flow.error) : ''}</p><div class="dialog-actions">${step > 0 ? button(t('stringing.back'), 'stringing-back', 'ds-button--secondary') : ''}${button(step === 4 ? t('stringing.save') : t('stringing.next'), step === 4 ? 'stringing-save' : 'stringing-next')}</div>`,
  );
}
function nextStringing() {
  const flow = state.stringing;
  const error = validateStringing(flow.draft, findProduct(flow.product), flow.scenario);
  const required = ['required_string', 'required_colour', 'required_tension', 'required_method'];
  if (error && required.indexOf(error) <= flow.step) {
    flow.error = error;
    paintStringing();
    dialog.querySelector('#stringing-error')?.scrollIntoView({ block: 'nearest' });
    if (error === 'required_tension') dialog.querySelector('#tension-input')?.focus();
    return;
  }
  flow.error = '';
  flow.step++;
  paintStringing();
  dialog.querySelector('#dialog-title')?.focus();
}
function saveStringing(remove = false) {
  const flow = state.stringing;
  const product = findProduct(flow.product);
  if (!remove) {
    const error = validateStringing(flow.draft, product, flow.scenario);
    if (error) {
      flow.error = error;
      paintStringing();
      return;
    }
  }
  const selection = remove ? null : structuredClone(flow.draft);
  const editingCart = flow.cartId;
  if (editingCart) state.cart.find((line) => line.id === editingCart).stringing = selection;
  else state.selections[product.handle].stringing = selection;
  forceClose();
  render();
  if (editingCart) openOverlay('cart');
  else
    (
      root.querySelector('[data-action="open-stringing"]') || root.querySelector('[data-action="try-stringing"]')
    )?.focus();
  toast(t(remove ? 'stringing.removed' : 'stringing.saved'));
}

// One event layer makes exported markup portable; stateful actions are confined to this preview.
document.addEventListener('click', async (event) => {
  const anchor = event.target.closest('a[href^="#"]');
  if (anchor) {
    if (anchor.getAttribute('href') === '#main-content') {
      event.preventDefault();
      root.querySelector('main')?.focus();
      return;
    }
    if (dialog.open) forceClose();
  }
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === 'noop') return;
  if (action === 'toast') return toast(t('component.success'));
  if (action === 'copy') {
    try {
      await navigator.clipboard.writeText(document.getElementById(target.dataset.code).textContent);
      toast(t('app.copied'));
    } catch {
      toast(t('app.copy_failed'));
    }
    return;
  }
  if (action === 'motion') {
    target.classList.remove('is-moving');
    requestAnimationFrame(() => target.classList.add('is-moving'));
    return;
  }
  if (action === 'tab') {
    const id = target.dataset.tab;
    document.querySelectorAll('[role="tab"]').forEach((el) => {
      el.setAttribute('aria-selected', String(el === target));
      el.tabIndex = el === target ? 0 : -1;
    });
    document.querySelectorAll('[role="tabpanel"]').forEach((el) => {
      el.hidden = el.id !== 'panel-' + id;
    });
    return;
  }
  if (action === 'demo-dialog' || action === 'demo-drawer') return openOverlay(action);
  if (action === 'demo-confirm') {
    forceClose();
    return toast(t('component.success'));
  }
  if (action === 'state-retry' || action === 'state-reset') {
    state.componentState = 'default';
    document.querySelector('#component-state').value = 'default';
    document.querySelector('#state-preview').innerHTML = statePreview('default');
    return;
  }
  if (action === 'slider-next' || action === 'slider-prev') {
    document.querySelector('#recommendation-slider').scrollBy({
      left: action === 'slider-next' ? 300 : -300,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
    return;
  }
  if (action === 'open-filter') return openOverlay('filter');
  if (action === 'open-sort') return openOverlay('sort');
  if (action === 'open-search') return openOverlay('search');
  if (action === 'open-menu') return openOverlay('menu');
  if (action === 'open-cart') return openOverlay('cart');
  if (action === 'close-overlay') return requestClose();
  if (action === 'checkout') return openOverlay('checkout');
  if (action === 'clear-filters') {
    state.filters = { available: false, flex: '' };
    state.search = '';
    forceClose();
    render();
    root.querySelector('[data-action="open-filter"]')?.focus();
    announce(t('shop.results', { count: products.length }));
    return;
  }
  if (action === 'product-image') {
    state.selections[currentProduct().handle].image = Number(target.dataset.image);
    renderKeepingFocus();
    return;
  }
  if (action === 'product-quantity') {
    const selection = state.selections[currentProduct().handle];
    selection.quantity = clampQuantity(selection.quantity + Number(target.dataset.delta));
    renderKeepingFocus();
    return;
  }
  if (action === 'open-stringing') return beginStringing();
  if (action === 'try-stringing')
    return beginStringing(products[0], null, document.querySelector('#stringing-scenario').value);
  if (action === 'remove-product-stringing') {
    state.selections[currentProduct().handle].stringing = null;
    render();
    root.querySelector('[data-action="open-stringing"]')?.focus();
    return toast(t('stringing.removed'));
  }
  if (action === 'add-cart') {
    const product = currentProduct(),
      selection = state.selections[product.handle];
    if (
      addLine(state.cart, {
        product: product.handle,
        variant: selection.variant,
        quantity: selection.quantity,
        stringing: selection.stringing,
      })
    ) {
      render();
      openOverlay('cart');
      announce(t('shop.added'));
    }
    return;
  }
  if (action === 'cart-quantity') {
    const line = state.cart.find((l) => l.id === target.dataset.id);
    line.quantity = clampQuantity(line.quantity + Number(target.dataset.delta));
    paintOverlay();
    render();
    const focus = [...dialog.querySelectorAll('[data-action="cart-quantity"]')].find(
      (el) => el.dataset.id === line.id && el.dataset.delta === target.dataset.delta && !el.disabled,
    );
    focus?.focus();
    return;
  }
  if (action === 'cart-remove') {
    state.cart = state.cart.filter((l) => l.id !== target.dataset.id);
    paintOverlay();
    render();
    dialog.querySelector('#dialog-title').focus();
    return;
  }
  if (action === 'cart-remove-service') {
    state.cart.find((l) => l.id === target.dataset.id).stringing = null;
    paintOverlay();
    dialog.querySelector('#dialog-title')?.focus();
    announce(t('stringing.removed'));
    return;
  }
  if (action === 'cart-stringing') {
    const line = state.cart.find((l) => l.id === target.dataset.id);
    return beginStringing(findProduct(line.product), line.id);
  }
  if (action === 'stringing-next') return nextStringing();
  if (action === 'stringing-back') {
    state.stringing.step--;
    state.stringing.error = '';
    paintStringing();
    dialog.querySelector('#dialog-title').focus();
    return;
  }
  if (action === 'stringing-save') return saveStringing();
  if (action === 'keep-unstrung') return saveStringing(true);
  if (action === 'keep-stringing') {
    state.stringing.confirm = false;
    paintStringing();
    dialog.querySelector('#dialog-title').focus();
    return;
  }
  if (action === 'discard-stringing') return forceClose();
  if (action === 'reset-stringing-scenario') {
    state.stringing.scenario = 'normal';
    paintStringing();
    dialog.querySelector('#dialog-title').focus();
  }
});
document.addEventListener('change', (event) => {
  const el = event.target;
  if (el.id === 'component-state') {
    state.componentState = el.value;
    document.querySelector('#state-preview').innerHTML = statePreview(el.value);
    return;
  }
  if (el.name === 'product-variant') {
    state.selections[currentProduct().handle].variant = el.value;
    render();
    root.querySelector('input[name="product-variant"]:checked')?.focus();
    return;
  }
  if (state.modal !== 'stringing' || !state.stringing) return;
  const draft = state.stringing.draft;
  if (el.name === 'string' && draft.string !== el.value) {
    draft.string = el.value;
    draft.variant = '';
  }
  if (el.name === 'string-colour') draft.variant = el.value;
  if (el.name === 'method') draft.method = el.value;
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'search-input') {
    const value = event.target.value;
    document.querySelector('#search-results').innerHTML = searchResults(value);
  }
  if (event.target.id === 'tension-input' && state.stringing) state.stringing.draft.tension = event.target.value;
});
document.addEventListener('submit', (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.id === 'filter-form') {
    const data = new FormData(form);
    state.filters = { available: data.has('available'), flex: data.get('flex') || '' };
    forceClose();
    render();
    root.querySelector('[data-action="open-filter"]')?.focus();
    return;
  }
  if (form.id === 'sort-form') {
    state.sort = new FormData(form).get('sort');
    forceClose();
    render();
    root.querySelector('[data-action="open-sort"]')?.focus();
    return;
  }
  if (form.id === 'example-form') {
    const email = form.querySelector('input[type="email"]');
    const valid = email.validity.valid;
    email.setAttribute('aria-invalid', String(!valid));
    const msg = form.querySelector('#example-form-message');
    msg.textContent = t(valid ? 'component.email_success' : 'component.email_invalid');
    msg.classList.toggle('is-error', !valid);
    if (!valid) email.focus();
  }
});
document.addEventListener('keydown', (event) => {
  // Native dialog makes the background inert; wrap its controls explicitly so
  // repeated Tab presses never move keyboard focus into the browser chrome.
  if (dialog.open && event.key === 'Tab') {
    const controls = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(
      (element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length,
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      dialog.querySelector('#dialog-title')?.focus();
    } else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.target.matches('[role="tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    let index = tabs.indexOf(event.target);
    index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].click();
    tabs[index].focus();
  }
});
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  requestClose();
});
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
    requestClose();
});
window.addEventListener('hashchange', () => {
  forceClose();
  render();
  window.scrollTo(0, 0);
  root.querySelector('main')?.focus({ preventScroll: true });
});
render();
