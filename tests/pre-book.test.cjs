const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../assets/pre-book.js'), 'utf8');
const locale = JSON.parse(
  readFileSync(join(__dirname, '../locales/en.default.json'), 'utf8').replace(/^\/\*[\s\S]*?\*\//, ''),
);
const messages = { ...locale.prebook.errors, submit: 'Pre-book for ₹500', busy: locale.prebook.busy };

// A small DOM adapter keeps the request tests dependency-free. Native radio,
// focus, FormData and responsive rendering are also checked in a real browser.
function element(extra = {}) {
  return Object.assign(
    {
      attributes: {},
      listeners: {},
      events: [],
      textContent: '',
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
      toggleAttribute(name, value) {
        if (value) this.attributes[name] = '';
        else delete this.attributes[name];
      },
      addEventListener(name, callback) {
        this.listeners[name] = callback;
      },
      removeEventListener(name) {
        delete this.listeners[name];
      },
      dispatchEvent(event) {
        this.events.push(event);
      },
      focus() {
        this.focused = true;
      },
    },
    extra,
  );
}

function setup({ enabled = 'true', search = '' } = {}) {
  let Component;
  let timer;
  let fetchResult = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ payment_url: 'https://pay.easebuzz.in/pay/key' }),
  });
  const requests = [];
  const redirects = [];
  const label = element();
  const button = element({ disabled: true, querySelector: () => label });
  const error = element();
  const success = element({ hidden: true });
  const failed = element({ hidden: true });
  const fields = [
    element({ name: 'option[colour]', value: 'Grey / White', type: 'radio', checked: true }),
    element({ name: 'option[size]', value: '9', type: 'radio', checked: true }),
    element({ name: 'name', value: '  Test   Customer  ' }),
    element({ name: 'email', value: 'TEST@example.com' }),
    element({ name: 'phone', value: '+91 98765 43210' }),
  ];
  const form = element({
    dataset: { prebook: 'hypercourt-adapt' },
    elements: fields,
    querySelector: (selector) => (selector === '[type="submit"]' ? button : error),
    querySelectorAll: () => fields.filter((field) => 'aria-invalid' in field.attributes),
  });
  const selectors = {
    'form[data-prebook]': form,
    '[data-prebook-messages]': { textContent: JSON.stringify(messages) },
    '[data-prebook-success]': success,
    '[data-prebook-failed]': failed,
  };
  const window = element();
  const document = element();
  const context = vm.createContext({
    HTMLElement: class {
      dataset = { enabled, serverUrl: 'https://sitemap.hndrd.co/' };
      querySelector(selector) {
        return selectors[selector];
      }
    },
    customElements: { get: () => Component, define: (_, component) => (Component = component) },
    URL,
    URLSearchParams,
    AbortController,
    FormData: class {
      constructor(target) {
        this.fields = target.elements.filter((field) => field.type !== 'radio' || field.checked);
      }
      get(name) {
        return this.fields.find((field) => field.name === name)?.value;
      }
    },
    CustomEvent: class {
      constructor(type, options) {
        Object.assign(this, { type }, options);
      }
    },
    location: { origin: 'https://in.hndrd.co', pathname: '/pages/adapt', search, assign: (url) => redirects.push(url) },
    window,
    document,
    fetch: async (...args) => {
      requests.push(args);
      return fetchResult(...args);
    },
    setTimeout: (callback) => (timer = callback),
    clearTimeout: () => {},
  });
  vm.runInContext(source, context);
  const component = new Component();
  component.connectedCallback();
  return {
    component,
    form,
    fields,
    button,
    label,
    error,
    requests,
    redirects,
    window,
    document,
    success,
    failed,
    context,
    submit: () => component.onSubmit({ preventDefault() {} }),
    respond: (body, status = 200) => {
      fetchResult = async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    },
    setFetch: (callback) => (fetchResult = callback),
    timeout: () => timer(),
  };
}

test('posts exactly the campaign contract, normalizes contacts and redirects to Easebuzz', async () => {
  const app = setup();
  await app.submit();
  assert.equal(app.requests.length, 1);
  const [url, request] = app.requests[0];
  assert.equal(url, 'https://sitemap.hndrd.co/pre-book/initiate');
  assert.equal(request.method, 'POST');
  assert.equal(request.credentials, 'omit');
  assert.deepEqual(JSON.parse(request.body), {
    product: 'hypercourt-adapt',
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '9876543210',
    options: { colour: 'Grey / White', size: '9' },
    return_url: 'https://in.hndrd.co/pages/adapt',
  });
  assert.deepEqual(app.redirects, ['https://pay.easebuzz.in/pay/key']);
  assert.equal(app.button.disabled, true);
  assert.equal(app.form.events.at(-1).type, 'prebook:redirect');
});

test('a single unchecked colour radio is required and receives focus', async () => {
  const app = setup();
  app.fields[0].checked = false;
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.equal(app.error.textContent, messages.colour);
  assert.equal(app.fields[0].attributes['aria-invalid'], 'true');
  assert.equal(app.fields[0].focused, true);
});

test('rejects missing size, invalid name and invalid email before requesting payment', async () => {
  for (const [index, value, message] of [
    [1, '', messages.size],
    [2, 'x', messages.name],
    [3, 'invalid', messages.email],
  ]) {
    const app = setup();
    app.fields[index].value = value;
    await app.submit();
    assert.equal(app.requests.length, 0);
    assert.equal(app.error.textContent, message);
  }
});

test('does not silently truncate foreign, overlong, alphabetic or invalid mobile numbers', async () => {
  for (const phone of ['+1 9876543210', '919876543210', '98765432100', 'abc9876543210', '1234567890']) {
    const app = setup();
    app.fields[4].value = phone;
    await app.submit();
    assert.equal(app.requests.length, 0, phone);
    assert.equal(app.error.textContent, messages.phone);
  }
});

test('accepts a plain 10-digit Indian number', async () => {
  const app = setup();
  app.fields[4].value = '9876543210';
  await app.submit();
  assert.equal(app.requests.length, 1);
});

test('closed campaigns and invalid HTTPS server configuration cannot initiate payments', async () => {
  const closed = setup({ enabled: 'false' });
  await closed.submit();
  assert.equal(closed.button.disabled, true);
  assert.equal(closed.requests.length, 0);
  for (const server of [
    'http://example.com',
    'https://user:password@example.com',
    'not a URL',
    'https://example.com?x=1',
  ]) {
    const app = setup();
    app.component.dataset.serverUrl = server;
    await app.submit();
    assert.equal(app.requests.length, 0);
    assert.equal(app.error.textContent, messages.unavailable);
  }
});

test('double submission starts only one request; Back restores the button', async () => {
  const app = setup();
  let resolve;
  app.setFetch(() => new Promise((done) => (resolve = done)));
  const pending = app.submit();
  await app.submit();
  assert.equal(app.requests.length, 1);
  assert.equal(app.label.textContent, messages.busy);
  resolve({ ok: true, json: async () => ({ payment_url: 'https://testpay.easebuzz.in/pay/key' }) });
  await pending;
  assert.equal(app.button.disabled, true);
  app.window.listeners.pageshow({ persisted: true });
  assert.equal(app.button.disabled, false);
  assert.equal(app.label.textContent, messages.submit);
});

test('server validation marks only known fields and preserves entered values for retry', async () => {
  const app = setup();
  app.respond({ invalid: ['email', 'colour', '<script>'], message: 'Untrusted server content' }, 400);
  await app.submit();
  assert.equal(app.error.textContent, messages.details);
  assert.equal(app.fields[0].attributes['aria-invalid'], 'true');
  assert.equal(app.fields[3].attributes['aria-invalid'], 'true');
  assert.equal(app.fields[3].value, 'TEST@example.com');
  assert.equal(app.button.disabled, false);
  app.respond({ payment_url: 'https://pay.easebuzz.in/pay/retry' });
  await app.submit();
  assert.equal(app.requests.length, 2);
  assert.equal(app.fields[3].attributes['aria-invalid'], undefined);
});

test('HTTP errors do not redirect even when a payment URL is present', async () => {
  for (const status of [404, 503, 502]) {
    const app = setup();
    app.respond({ payment_url: 'https://pay.easebuzz.in/pay/key' }, status);
    await app.submit();
    assert.equal(app.redirects.length, 0);
    assert.equal(app.button.disabled, false);
    assert.equal(app.error.textContent, status === 502 ? messages.generic : messages.unavailable);
  }
});

test('missing or unsafe payment destinations fail without redirecting', async () => {
  for (const url of [
    undefined,
    '/pay/key',
    'http://pay.easebuzz.in/pay/key',
    'https://pay.easebuzz.in.evil.test/pay/key',
    'https://user@pay.easebuzz.in/pay/key',
    'https://pay.easebuzz.in:8443/pay/key',
    'javascript:alert(1)',
  ]) {
    const app = setup();
    app.respond({ payment_url: url });
    await app.submit();
    assert.equal(app.redirects.length, 0, url);
    assert.equal(app.button.disabled, false);
    assert.equal(app.error.textContent, messages.generic);
  }
});

test('malformed JSON and null responses show a recoverable error', async () => {
  for (const json of [
    async () => {
      throw new SyntaxError();
    },
    async () => null,
  ]) {
    const app = setup();
    app.setFetch(async () => ({ ok: true, json }));
    await app.submit();
    assert.equal(app.error.textContent, messages.generic);
    assert.equal(app.button.disabled, false);
  }
});

test('network failures and timeout are recoverable and never retry automatically', async () => {
  const app = setup();
  app.setFetch(async () => {
    throw new TypeError('Failed to fetch');
  });
  await app.submit();
  assert.equal(app.error.textContent, messages.network);
  assert.equal(app.button.disabled, false);
  app.setFetch(
    (url, { signal }) =>
      new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  );
  const pending = app.submit();
  app.timeout();
  await pending;
  assert.equal(app.error.textContent, messages.timeout);
  assert.equal(app.button.disabled, false);
  assert.equal(app.requests.length, 2);
});

test('removed sections and restored pages ignore late responses', async () => {
  for (const action of ['disconnect', 'back']) {
    const app = setup();
    let resolve;
    app.setFetch(() => new Promise((done) => (resolve = done)));
    const pending = app.submit();
    if (action === 'disconnect') app.component.disconnectedCallback();
    else app.window.listeners.pageshow({ persisted: true });
    resolve({ ok: true, json: async () => ({ payment_url: 'https://pay.easebuzz.in/pay/late' }) });
    await pending;
    assert.equal(app.redirects.length, 0);
    assert.equal(app.button.disabled, false);
  }
});

test('theme editor reconnection and duplicate asset loading remain safe', async () => {
  const app = setup();
  app.component.disconnectedCallback();
  assert.equal(app.window.listeners.pageshow, undefined);
  app.component.connectedCallback();
  vm.runInContext(source, app.context);
  await app.submit();
  assert.equal(app.requests.length, 1);
});

test('return parameters only show a status; they never request or assert a payment', () => {
  for (const result of ['success', 'failed', 'other']) {
    const app = setup({ search: `?prebook=${result}` });
    assert.equal(app.success.hidden, result !== 'success');
    assert.equal(app.failed.hidden, result !== 'failed');
    assert.equal(app.requests.length, 0);
    assert.equal(app.document.events.length, result === 'other' ? 0 : 1);
  }
});
