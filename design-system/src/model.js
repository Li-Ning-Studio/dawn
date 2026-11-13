import catalogue from './data/catalogue.json' with { type: 'json' };

export const capturedAt = catalogue.capturedAt;
const byHandle = (handle) => catalogue.products.find((p) => p.handle === handle);
const details = [
  ['nitrix-70-venom', 'Nitrix 70 Venom', 'hard', '6.1 mm'],
  ['nitrix-70-volta', 'Nitrix 70 Volta', 'flexible', '7 mm'],
  ['nitrix-pro-4u', 'Nitrix Pro', 'hard', '6.5 mm'],
  ['nitrix-attack-4u', 'Nitrix Attack', 'flexible', '6.5 mm'],
];
export const products = details.map(([handle, name, flex, shaft]) => ({
  ...byHandle(handle),
  name,
  flex,
  shaft,
  maxTension: 32,
  weight: '4U',
  grip: 'G6',
  cardImage: '/assets/' + handle + '.png',
}));
export const strings = ['jp65-magnite', 'jp-70-magnite'].map(byHandle).filter(Boolean);
export const services = { two: byHandle('studio-pro-stringing'), four: byHandle('studio-four-knots-service') };
export const findProduct = (handle) => products.find((p) => p.handle === handle);
export const findString = (handle) => strings.find((p) => p.handle === handle);
export const blankStringing = () => ({ string: '', variant: '', tension: '', method: 'two' });
export function serviceAvailable(method, scenario = 'normal') {
  return (
    Boolean(services[method]?.variants[0]?.available) &&
    !(method === 'four' && scenario === 'four_off') &&
    !(method === 'two' && scenario === 'base_off')
  );
}
export function validateStringing(config, product, scenario = 'normal') {
  const string = findString(config.string);
  if (!string) return 'required_string';
  const variant = string.variants.find((v) => String(v.id) === String(config.variant));
  if (!variant?.available) return 'required_colour';
  const tension = Number(config.tension);
  // No preferred tension is inferred: the customer chooses within the fixture racket limit.
  if (!Number.isInteger(tension) || tension < 21 || tension > product.maxTension) return 'required_tension';
  if (!serviceAvailable(config.method, scenario)) return 'required_method';
  return null;
}
export function stringingPrice(config) {
  if (!config) return 0;
  const variant = findString(config.string)?.variants.find((v) => String(v.id) === String(config.variant));
  const service = services[config.method]?.variants[0];
  if (!variant || !service) throw new Error('Invalid stringing configuration');
  // The method is a replacement: never sum the two-knot and four-knot service prices.
  return variant.price + service.price;
}
export function linePrice(line) {
  const product = findProduct(line.product);
  const variant = product.variants.find((v) => String(v.id) === String(line.variant));
  return (variant.price + stringingPrice(line.stringing)) * line.quantity;
}
export const subtotal = (cart) => cart.reduce((sum, line) => sum + linePrice(line), 0);
export const clampQuantity = (quantity) => Math.max(1, Math.min(99, Math.trunc(Number(quantity) || 1)));
export function addLine(cart, line) {
  const product = findProduct(line.product);
  if (!product?.variants.some((v) => String(v.id) === String(line.variant) && v.available)) return false;
  if (line.stringing && validateStringing(line.stringing, product)) return false;
  const match = cart.find(
    (item) =>
      item.product === line.product &&
      String(item.variant) === String(line.variant) &&
      JSON.stringify(item.stringing) === JSON.stringify(line.stringing),
  );
  if (match) match.quantity = clampQuantity(match.quantity + line.quantity);
  else cart.push({ ...structuredClone(line), id: crypto.randomUUID(), quantity: clampQuantity(line.quantity) });
  return true;
}
