import test from 'node:test';
import assert from 'node:assert/strict';
import {
  products,
  strings,
  services,
  blankStringing,
  validateStringing,
  stringingPrice,
  serviceAvailable,
  addLine,
  subtotal,
  clampQuantity,
} from '../src/model.js';
const product = products.find((p) => p.available);
const string = strings[0];
const config = {
  string: string.handle,
  variant: string.variants.find((v) => v.available).id,
  tension: 26,
  method: 'two',
};
const line = {
  product: product.handle,
  variant: product.variants.find((v) => v.available).id,
  quantity: 1,
  stringing: config,
};
test('four knots replaces the base service in the complete price', () => {
  const stringPrice = string.variants.find((v) => v.id === config.variant).price;
  assert.equal(stringingPrice(config), stringPrice + services.two.variants[0].price);
  assert.equal(stringingPrice({ ...config, method: 'four' }), stringPrice + services.four.variants[0].price);
  assert.equal(stringingPrice(null), 0);
});
test('stringing requires available choices and obeys racket tension limits', () => {
  assert.equal(validateStringing(blankStringing(), product), 'required_string');
  assert.equal(validateStringing({ ...config, variant: 'missing' }, product), 'required_colour');
  for (const tension of ['', 20, 33, 25.5])
    assert.equal(validateStringing({ ...config, tension }, product), 'required_tension');
  for (const tension of [21, 26, 32]) assert.equal(validateStringing({ ...config, tension }, product), null);
  assert.equal(validateStringing({ ...config, method: 'four' }, product, 'four_off'), 'required_method');
  assert.equal(validateStringing(config, product, 'base_off'), 'required_method');
  assert.equal(serviceAvailable('unknown'), false);
});
test('cart merges identical selections and keeps different customisations separate', () => {
  const cart = [];
  assert.ok(addLine(cart, line));
  assert.ok(addLine(cart, { ...line, quantity: 2 }));
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);
  const base = product.variants.find((v) => v.id === line.variant).price;
  assert.equal(subtotal(cart), 3 * (base + stringingPrice(config)));
  assert.ok(addLine(cart, { ...line, stringing: { ...config, method: 'four' } }));
  assert.equal(cart.length, 2);
  assert.equal(
    subtotal(cart),
    3 * (base + stringingPrice(config)) + base + stringingPrice({ ...config, method: 'four' }),
  );
  cart[0].stringing = null;
  assert.equal(subtotal(cart), 4 * base + stringingPrice({ ...config, method: 'four' }));
});
test('cart rejects sold-out and invalid selections', () => {
  const sold = products.find((p) => !p.available);
  const cart = [];
  assert.equal(addLine(cart, { ...line, product: sold.handle, variant: sold.variants[0].id }), false);
  assert.equal(addLine(cart, { ...line, stringing: { ...config, tension: 100 } }), false);
  assert.equal(cart.length, 0);
});
test('quantity stays between one and 99', () => {
  assert.equal(clampQuantity(-1), 1);
  assert.equal(clampQuantity(100), 99);
  assert.equal(clampQuantity('abc'), 1);
  assert.equal(clampQuantity(3.8), 3);
});
