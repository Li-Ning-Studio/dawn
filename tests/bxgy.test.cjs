const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const collection = 'gid://shopify/Collection/10';
const offer = (ids = [201, 202]) => ({
  offer_name: 'Gift set',
  trigger_collection: collection,
  expected_count: ids.length,
  gifts: ids.map((id) => ({ id })),
});
const reply = (data, ok = true) => ({ ok, json: async () => data });
const normalise = (value) => JSON.parse(JSON.stringify(value));

// Execute the real browser scripts with a small DOM boundary and a programmable
// Shopify endpoint. These tests exercise request ordering and cart recovery,
// without treating mocked responses as proof of Shopify's discount behaviour.
function harness(handler, storage = new Map()) {
  const definitions = new Map();
  const requests = [];
  const rendered = [];
  const notices = [];
  const elements = new Map();
  const cartItems = [];
  const routes = { cart_url: '/en/cart', cart_add_url: '/en/cart/add', cart_update_url: '/en/cart/update' };
  function shopify(request) {
    if (request.url === routes.cart_add_url) {
      const added = request.body.items.map((item) => {
        let line = cartItems.find(
          (existing) =>
            String(existing.id) === String(item.id) &&
            JSON.stringify(existing.properties) === JSON.stringify(item.properties),
        );
        if (line) line.quantity += Number(item.quantity);
        else {
          line = { ...item, quantity: Number(item.quantity), key: `line-${cartItems.length}-${item.id}` };
          if (item.parent_id) {
            line.parent_relationship = {
              parent_key: cartItems.find((parent) => String(parent.id) === String(item.parent_id))?.key,
            };
          }
          cartItems.push(line);
        }
        return line;
      });
      return reply({ items: normalise(added), sections: { 'cart-drawer': 'paid-addition' } });
    }
    if (request.url === `${routes.cart_url}.js`) return reply({ items: normalise(cartItems) });
    if (request.url.startsWith(`${routes.cart_url}?sections=`)) {
      // Reproduce Shopify's content negotiation: JSON Accept on /cart returns
      // cart data rather than section HTML. This broke the real drawer refresh.
      if (request.headers?.Accept === 'application/json') return reply({ items: normalise(cartItems) });
      const sections = decodeURIComponent(request.url.split('?sections=')[1]).split(',');
      return reply(Object.fromEntries(sections.map((section) => [section, 'final-cart'])));
    }
    if (request.url === routes.cart_update_url) {
      for (let index = cartItems.length - 1; index >= 0; index--) {
        if (request.body.updates[cartItems[index].key] === 0) cartItems.splice(index, 1);
      }
      return reply({ items: normalise(cartItems), sections: {} });
    }
    assert.fail(`Unexpected request: ${request.url}`);
  }
  const context = vm.createContext({
    window: {
      location: { pathname: '/en/products/racket' },
      routes,
      cartStrings: { error: 'Cart error', giftsUnavailable: 'Gifts unavailable' },
      s3_product_collections: [collection],
      s3_bxgy: [offer()],
      crypto: { randomUUID: () => 'attempt' },
    },
    routes,
    console: { error() {}, debug() {} },
    document: {
      getElementById: (id) => elements.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => notices,
      createElement: () => ({}),
    },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    customElements: { define: (name, value) => definitions.set(name, value), get: (name) => definitions.get(name) },
    HTMLElement: class {
      replaceChildren(child) {
        this.child = child;
      }
    },
    FormData: class {
      constructor(form) {
        this.get = (key) => form[key];
      }
    },
    fetchConfig: () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    }),
    fetch: async (url, options = {}) => {
      const request = {
        url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body ? JSON.parse(options.body) : undefined,
      };
      requests.push(request);
      return (await handler?.(request, requests.length, cartItems)) || shopify(request);
    },
    publish: async () => {},
    PUB_SUB_EVENTS: { cartUpdate: 'update', cartError: 'error' },
    CartPerformance: {
      createStartingMarker() {},
      measureFromMarker() {},
      measureFromEvent() {},
      measure: (_, cb) => cb(),
    },
  });
  for (const file of ['assets/bxgy.js', 'assets/product-form.js']) {
    vm.runInContext(readFileSync(path.join(root, file), 'utf8'), context);
  }
  const classes = { add() {}, remove() {}, contains: () => false };
  const cartClasses = new Set(['is-empty']);
  const form = Object.create(definitions.get('product-form').prototype);
  Object.assign(form, {
    form: { id: '101', quantity: '2' },
    cart: {
      getSectionsToRender: () => [{ id: 'cart-drawer' }],
      renderContents: (data) => rendered.push(data),
      classList: { remove: (name) => cartClasses.delete(name), contains: (name) => cartClasses.has(name) },
    },
    submitButton: {
      getAttribute: () => null,
      setAttribute() {},
      removeAttribute() {},
      querySelector: () => null,
      classList: classes,
    },
    querySelector: () => ({ classList: classes }),
    closest: () => null,
    handleErrorMessage(message) {
      this.lastError = message;
    },
  });
  return {
    context,
    bxgy: context.window.Bxgy,
    definitions,
    requests,
    rendered,
    notices,
    elements,
    form,
    storage,
    cartItems,
  };
}

const submit = (h) => h.form.onSubmitHandler({ preventDefault() {} });
const addedRequests = (h) => h.requests.filter((request) => request.url === '/en/cart/add');
const requestedIds = (h) => addedRequests(h).flatMap((request) => request.body.items.map((item) => Number(item.id)));
const giftsInCart = (h) => h.cartItems.filter((item) => item.properties?._offerInstanceId);

test('first matching offer supplies one of each available gift per purchased unit', () => {
  const { bxgy } = harness();
  const result = bxgy.selectGifts([offer([201, null, 203]), offer([204])], [collection], '2', 'new');
  assert.deepEqual(
    normalise(result.items),
    [201, 203].map((id) => ({
      id,
      quantity: 2,
      properties: { _offer: 'Gift set', _offerInstanceId: 'new' },
    })),
  );
  assert.equal(result.unavailable, true);
});

test('no matching offer, no source and empty collections add nothing', () => {
  const { bxgy } = harness();
  for (const offers of [undefined, [], [offer([])], [{ ...offer(), trigger_collection: 'other' }]]) {
    assert.deepEqual(normalise(bxgy.selectGifts(offers, [collection], 1, 'new')), { items: [], unavailable: false });
  }
});

for (const offers of [undefined, [], [{ ...offer(), trigger_collection: 'other' }]]) {
  test(`ordinary product renders the purchased item without gift requests (${JSON.stringify(offers)})`, async () => {
    const h = harness();
    h.context.window.s3_bxgy = offers;
    await submit(h);
    await submit(h);
    assert.deepEqual(requestedIds(h), [101, 101]);
    assert.equal(h.requests.length, 2);
    assert.equal(h.cartItems.length, 1);
    assert.equal(h.cartItems[0].quantity, 4);
    assert.equal(h.rendered.length, 2);
    assert.equal(h.rendered[1].sections['cart-drawer'], 'paid-addition');
    assert.equal(h.form.cart.classList.contains('is-empty'), false);
    assert.equal(h.bxgy.notice, null);
    assert.equal(h.form.error, false);
    assert.equal(h.context.window.location.pathname, '/en/products/racket');
  });
}

test('sold-out single product, entirely sold-out collection and truncation never use a later offer', () => {
  const { bxgy } = harness();
  for (const configured of [offer([null]), offer([null, null]), { ...offer(), expected_count: 51 }]) {
    assert.deepEqual(normalise(bxgy.selectGifts([configured, offer([203])], [collection], 2, 'new')), {
      items: [],
      unavailable: true,
    });
  }
});

test('successful additions keep split discounted and chargeable lines', async () => {
  const h = harness((request, _, cart) => {
    if (request.url !== '/en/cart/add') return;
    const item = request.body.items[0];
    cart.push(
      { ...item, quantity: 1, key: 'paid-gift', final_line_price: 100 },
      { ...item, quantity: 1, key: 'free-gift', final_line_price: 0 },
    );
    return reply({ items: normalise(cart) });
  });
  const items = h.bxgy.selectGifts([offer([201])], [collection], 2, 'new').items;
  const result = await h.bxgy.addGifts(items, 'new', ['drawer']);
  assert.equal(result.notice, null);
  assert.equal(result.items[0].final_line_price, 100);
  assert.equal(result.items.length, 2);
  assert.equal(result.sections.drawer, 'final-cart');
  assert.equal(addedRequests(h).length, 1);
  assert.ok(!h.requests.some((request) => request.url === '/en/cart/update'));
});

for (const soldOutId of [201, 202, 203]) {
  test(`gift ${soldOutId} sells out after page load; all other gifts survive and are attempted once`, async () => {
    const h = harness((request) => {
      if (request.url === '/en/cart/add' && Number(request.body.items[0].id) === soldOutId) {
        return reply({ status: 422 }, false);
      }
    });
    h.context.window.s3_bxgy = [offer([201, 202, 203])];
    await submit(h);
    assert.deepEqual(requestedIds(h), [101, 201, 202, 203]);
    assert.deepEqual(
      giftsInCart(h).map((item) => item.id),
      [201, 202, 203].filter((id) => id !== soldOutId),
    );
    assert.equal(h.bxgy.notice, 'unavailable');
    assert.equal(h.rendered.length, 1);
    assert.equal(h.rendered[0].sections['cart-drawer'], 'final-cart');
    assert.ok(!h.requests.some((request) => request.url === '/en/cart/update'));
    const failedIndex = h.requests.findIndex((request) => request.body?.items?.[0]?.id === soldOutId);
    assert.equal(h.requests[failedIndex + 1].url, '/en/cart.js');
  });
}

for (const failure of ['inventory', 'incomplete-success', 'network']) {
  test(`${failure}: retain partially added units and prior gifts, then continue without retry`, async () => {
    const h = harness((request, _, cart) => {
      if (request.url !== '/en/cart/add' || request.body.items[0].id !== 201) return;
      const partial = { ...request.body.items[0], quantity: 1, key: 'partial-gift', final_line_price: 100 };
      cart.push(partial);
      if (failure === 'network') throw new Error('Response lost after addition');
      return failure === 'inventory' ? reply({ status: 422 }, false) : reply({ items: [partial] });
    });
    const previous = { id: 201, quantity: 3, key: 'previous-gift', properties: { _offerInstanceId: 'old' } };
    h.cartItems.push(previous);
    await submit(h);
    assert.deepEqual(requestedIds(h), [101, 201, 202]);
    assert.deepEqual(
      h.cartItems.find((item) => item.key === 'previous-gift'),
      previous,
    );
    assert.equal(h.cartItems.find((item) => item.key === 'partial-gift').quantity, 1);
    assert.equal(h.cartItems.find((item) => item.key === 'partial-gift').final_line_price, 100);
    assert.equal(h.cartItems.find((item) => item.id === 202).quantity, 2);
    assert.equal(h.bxgy.notice, 'unavailable');
    assert.ok(!h.requests.some((request) => request.url === '/en/cart/update'));
  });
}

test('a lost response for a fully added gift is recovered without duplication or a false stock notice', async () => {
  const h = harness((request, _, cart) => {
    if (request.url === '/en/cart/add' && request.body.items[0].id === 201) {
      cart.push({ ...request.body.items[0], key: 'confirmed-by-read' });
      throw new Error('Response lost');
    }
  });
  await submit(h);
  assert.deepEqual(requestedIds(h), [101, 201, 202]);
  assert.equal(h.bxgy.notice, null);
  assert.equal(giftsInCart(h).length, 2);
});

test('network failure before addition still allows later gifts after a successful cart read', async () => {
  const h = harness((request) => {
    if (request.url === '/en/cart/add' && request.body.items[0].id === 201) throw new Error('Connection lost');
  });
  await submit(h);
  assert.deepEqual(requestedIds(h), [101, 201, 202]);
  assert.deepEqual(
    giftsInCart(h).map((item) => item.id),
    [202],
  );
  assert.equal(h.bxgy.notice, 'unavailable');
});

test('product-form adds paid merchandise first, then individual gifts, and renders once', async () => {
  const h = harness();
  await submit(h);
  assert.deepEqual(
    addedRequests(h).map((request) => request.body.items.map((item) => [item.id, Number(item.quantity)])),
    [[['101', 2]], [[201, 2]], [[202, 2]]],
  );
  assert.equal(h.rendered.length, 1);
  assert.equal(h.rendered[0].items.length, 3);
  assert.equal(h.rendered[0].key, 'line-0-101');
  assert.equal(h.rendered[0].sections['cart-drawer'], 'final-cart');
  assert.equal(h.form.cart.classList.contains('is-empty'), false);
  assert.deepEqual(
    h.requests.slice(-2).map((request) => request.url),
    ['/en/cart.js', '/en/cart?sections=cart-drawer'],
  );
  assert.equal(h.requests.at(-1).method, 'GET');
});

for (const withGifts of [false, true]) {
  test(`quick-add renders after the modal closes and then clears the empty state (gifts: ${withGifts})`, async () => {
    const h = harness();
    if (!withGifts) h.context.window.s3_bxgy = [];
    const timers = [];
    let modalClosed;
    h.context.setTimeout = (callback) => timers.push(callback);
    h.context.document.body = {
      addEventListener(event, callback, options) {
        assert.equal(event, 'modalClosed');
        assert.equal(options.once, true);
        modalClosed = callback;
      },
    };
    h.form.closest = () => ({
      hide(preventFocus) {
        assert.equal(preventFocus, true);
        modalClosed();
      },
    });
    await submit(h);
    assert.equal(h.rendered.length, 0);
    assert.equal(h.form.cart.classList.contains('is-empty'), true);
    assert.equal(timers.length, 1);
    timers[0]();
    assert.equal(h.rendered.length, 1);
    assert.equal(h.form.cart.classList.contains('is-empty'), false);
    assert.equal(h.rendered[0].sections['cart-drawer'], withGifts ? 'final-cart' : 'paid-addition');
  });
}

test('ordinary product recovers a failed drawer render without repeating the purchase', async () => {
  const h = harness();
  h.context.window.s3_bxgy = [];
  let attempts = 0;
  h.form.cart.renderContents = (response) => {
    if (++attempts === 1) throw new Error('Invalid section markup');
    h.rendered.push(response);
  };
  await submit(h);
  assert.deepEqual(requestedIds(h), [101]);
  assert.equal(h.rendered.length, 1);
  assert.equal(h.rendered[0].sections['cart-drawer'], 'final-cart');
  assert.equal(h.form.cart.classList.contains('is-empty'), false);
  assert.equal(h.form.lastError, undefined);
  assert.equal(h.context.window.location.pathname, '/en/products/racket');
});

test('known sold-out gifts are skipped and their notice survives successful remaining additions', async () => {
  const h = harness();
  h.context.window.s3_bxgy = [offer([201, null, 203])];
  await submit(h);
  assert.deepEqual(requestedIds(h), [101, 201, 203]);
  assert.equal(h.bxgy.notice, 'unavailable');
  assert.equal(h.rendered.length, 1);
  assert.equal(h.form.error, false);
});

test('all known gifts sold out leaves only the purchased product', async () => {
  const h = harness();
  h.context.window.s3_bxgy = [offer([null, null])];
  await submit(h);
  assert.deepEqual(requestedIds(h), [101]);
  assert.equal(h.requests.length, 1);
  assert.equal(h.bxgy.notice, 'unavailable');
});

test('all gifts rejected at addition still leaves the paid purchase successful', async () => {
  const h = harness((request) => {
    if (request.url === '/en/cart/add' && Number(request.body.items[0].id) !== 101)
      return reply({ status: 422 }, false);
  });
  await submit(h);
  assert.deepEqual(requestedIds(h), [101, 201, 202]);
  assert.equal(h.cartItems.length, 1);
  assert.equal(h.rendered[0].items.length, 1);
  assert.equal(h.bxgy.notice, 'unavailable');
  assert.equal(h.form.error, false);
});

test('repeated additions have distinct identifiers and use submitted rather than accumulated quantity', async () => {
  const h = harness();
  let instance = 0;
  h.context.window.crypto.randomUUID = () => `attempt-${++instance}`;
  await submit(h);
  await submit(h);
  assert.equal(h.cartItems.find((item) => item.id === '101').quantity, 4);
  const first = addedRequests(h)[1].body.items[0];
  const next = addedRequests(h)[4].body.items[0];
  assert.notEqual(first.properties._offerInstanceId, next.properties._offerInstanceId);
  assert.deepEqual(
    giftsInCart(h).map((item) => item.quantity),
    [2, 2, 2, 2],
  );
});

test('a rejected paid addition never attempts gifts', async () => {
  const h = harness(() => reply({ status: 422, description: 'Sold out' }, false));
  await submit(h);
  assert.equal(h.requests.length, 1);
  assert.equal(h.rendered.length, 0);
  assert.equal(h.form.cart.classList.contains('is-empty'), true);
  assert.equal(h.form.error, true);
});

function customise(h) {
  h.context.window.s3_current_variant_sku = 'RACKET';
  h.context.window.s3_tshirt_printing_service_variant_id = 301;
  h.context.window.s3_tshirt_printing_config = { tshirtTextColor: '#fff' };
  h.elements.set('the-tshirt-text', { innerText: 'Name' });
}

test('customisations retain native relationships and quantity one, including their independent gifts', async () => {
  const h = harness();
  customise(h);
  await submit(h);
  assert.equal(addedRequests(h)[0].body.items[0].quantity, 1);
  assert.equal(addedRequests(h)[0].body.items[1].parent_id, '101');
  assert.deepEqual(
    giftsInCart(h).map((item) => item.quantity),
    [1, 1],
  );
  assert.ok(giftsInCart(h).every((item) => !item.parent_id));
});

test('customisations without an offer keep their parent relationship and render normally', async () => {
  const h = harness();
  h.context.window.s3_bxgy = [];
  customise(h);
  await submit(h);
  assert.deepEqual(requestedIds(h), [101, 301]);
  assert.equal(h.requests.length, 1);
  assert.equal(h.cartItems[0].quantity, 1);
  assert.equal(h.cartItems[1].parent_relationship.parent_key, h.cartItems[0].key);
  assert.equal(h.rendered.length, 1);
  assert.equal(h.form.cart.classList.contains('is-empty'), false);
  assert.equal(h.form.error, false);
});

test('an incomplete customisation retains existing rollback and never attempts gifts', async () => {
  const h = harness((request, index, cart) => {
    if (index !== 1) return;
    cart.push({ ...request.body.items[0], key: 'partial-paid' });
    return reply({ items: normalise(cart) });
  });
  customise(h);
  await submit(h);
  assert.deepEqual(
    h.requests.map((request) => request.url),
    ['/en/cart/add', '/en/cart.js', '/en/cart/update'],
  );
  assert.deepEqual(h.requests[2].body.updates, { 'partial-paid': 0 });
  assert.equal(h.form.error, true);
  assert.equal(h.cartItems.length, 0);
});

for (const unreadable of ['http', 'malformed']) {
  test(`${unreadable} cart read stops later gifts and refreshes the drawer without navigation`, async () => {
    const h = harness((request) => {
      if (request.url === '/en/cart/add' && request.body.items[0].id === 202) return reply({ status: 422 }, false);
      if (request.url === '/en/cart.js') return unreadable === 'http' ? reply({}, false) : reply({ items: null });
    });
    h.context.window.s3_bxgy = [offer([201, 202, 203])];
    await submit(h);
    assert.deepEqual(requestedIds(h), [101, 201, 202]);
    assert.deepEqual(
      giftsInCart(h).map((item) => item.id),
      [201],
    );
    assert.equal(h.context.window.location.pathname, '/en/products/racket');
    assert.equal(h.bxgy.notice, null);
    assert.equal(h.form.lastError, undefined);
    assert.equal(h.rendered.length, 1);
    assert.equal(h.rendered[0].sections['cart-drawer'], 'final-cart');
    assert.equal(h.rendered[0].key, 'line-0-101');
    assert.ok(!h.requests.some((request) => request.url === '/en/cart/update'));
  });
}

test('persistent section failure stays silent without navigation or stale rendering', async () => {
  const h = harness((request) => (request.url.includes('?sections=') ? reply({ 'cart-drawer': null }) : undefined));
  await submit(h);
  assert.equal(giftsInCart(h).length, 2);
  assert.equal(h.context.window.location.pathname, '/en/products/racket');
  assert.equal(h.bxgy.notice, null);
  assert.equal(h.form.lastError, undefined);
  assert.equal(h.rendered.length, 0);
  assert.equal(h.form.cart.classList.contains('is-empty'), true);
  assert.equal(h.requests.filter((request) => request.url.includes('?sections=')).length, 2);
});

test('a temporary section failure refreshes once without retrying gifts or navigating', async () => {
  let sectionAttempts = 0;
  const h = harness((request) => {
    if (request.url.includes('?sections=') && ++sectionAttempts === 1) return reply({}, false);
  });
  await submit(h);
  assert.deepEqual(requestedIds(h), [101, 201, 202]);
  assert.equal(h.context.window.location.pathname, '/en/products/racket');
  assert.equal(h.rendered.length, 1);
  assert.equal(h.bxgy.notice, null);
});

test('gift recovery stays on the page even when no drawer or notification is available', async () => {
  const h = harness((request) => {
    if (request.url === '/en/cart.js') return reply({}, false);
  });
  h.form.cart = null;
  await submit(h);
  assert.equal(h.context.window.location.pathname, '/en/products/racket');
  assert.equal(h.form.lastError, undefined);
  assert.equal(h.bxgy.notice, null);
});

test('cart-page mode waits for gifts and avoids an unnecessary sections request', async () => {
  const h = harness();
  h.form.cart = null;
  await submit(h);
  assert.deepEqual(requestedIds(h), [101, 201, 202]);
  assert.equal(h.requests.at(-1).url, '/en/cart.js');
  assert.equal(h.context.window.location, '/en/cart');
});

test('gift notices survive page navigation, expire and clear on a subsequent purchase', () => {
  const first = harness();
  first.bxgy.setNotice('unavailable');
  const next = harness(undefined, first.storage);
  const Notice = next.definitions.get('bxgy-notice');
  const element = new Notice();
  next.notices.push(element);
  element.connectedCallback();
  assert.equal(element.child.textContent, 'Gifts unavailable');
  assert.equal(element.hidden, false);
  next.bxgy.setNotice(null);
  assert.equal(element.hidden, true);
  assert.equal(next.storage.size, 0);
  next.storage.set('bxgy-notice', JSON.stringify({ notice: 'unavailable', at: Date.now() - 6 * 60 * 1000 }));
  element.connectedCallback();
  assert.equal(element.hidden, true);
});

test('unavailable session storage cannot interrupt a successful paid purchase', async () => {
  const h = harness();
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    h.context.sessionStorage[method] = () => {
      throw new Error('Storage blocked');
    };
  }
  h.context.window.s3_bxgy = [offer([null])];
  await submit(h);
  assert.equal(h.rendered.length, 1);
  assert.equal(h.bxgy.notice, 'unavailable');
  assert.equal(h.form.error, false);
});
