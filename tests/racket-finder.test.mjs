import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { config } from './fixtures/racket-finder.mts';
import {
  cleanAnswers,
  complete,
  identify,
  rank,
  validateConfig,
  quizQuestions,
} from '../reax/src/components/racket-finder/engine.ts';
import {
  loadProducts,
  message,
  normaliseProduct,
  readSaved,
  saveAnswers,
  forgetAnswers,
  storageKey,
  track,
  downloadCard,
} from '../reax/src/components/racket-finder/platform.ts';

// Compile the real entry and its presentation helpers together with the existing
// Vite dependency. An empty document prevents mounting in these Node-only tests.
const requireReax = createRequire(new URL('../reax/package.json', import.meta.url));
const { build } = await import(requireReax.resolve('vite'));
const testEntry = fileURLToPath(new URL('./finder-test-exports.js', import.meta.url));
const entryBuild = await build({
  configFile: false,
  logLevel: 'silent',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  plugins: [
    {
      name: 'finder-test-exports',
      resolveId: (id) => (id === testEntry ? id : undefined),
      load: (id) =>
        id === testEntry
          ? `
      export { resolveMetaobjects, readMessages } from ${JSON.stringify(fileURLToPath(new URL('../reax/src/components/racket-finder/index.tsx', import.meta.url)))};
      export { reasonTexts, racketSpecs, transitionQuestion } from ${JSON.stringify(fileURLToPath(new URL('../reax/src/components/racket-finder/Finder.tsx', import.meta.url)))};
    `
          : undefined,
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: testEntry,
      formats: ['es'],
    },
  },
});
const entryOutput = Array.isArray(entryBuild) ? entryBuild[0] : entryBuild;
const entryCode = entryOutput.output.find((file) => file.type === 'chunk' && file.isEntry).code;
const previousDocument = globalThis.document;
let resolveMetaobjects, readMessages, reasonTexts, racketSpecs, transitionQuestion;
try {
  globalThis.document = { querySelectorAll: () => [], addEventListener: () => {} };
  ({ resolveMetaobjects, readMessages, reasonTexts, racketSpecs, transitionQuestion } = await import(
    `data:text/javascript;base64,${Buffer.from(entryCode).toString('base64')}`
  ));
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}

const answers = {
  experience: 'developing',
  style: 'attack',
  benefit: 'power',
  budget: '5000',
};
const fixture = (handle, price = 189000, available = true) => ({
  handle,
  title: handle,
  featured_image: null,
  variants: [{ id: 123, title: 'White', price, available }],
});
const profiles = config.products;
const clone = () => structuredClone(config);
const messages = JSON.parse(
  readFileSync(new URL('../locales/en.default.json', import.meta.url), 'utf8').replace(/^\/\*[\s\S]*?\*\//, ''),
).racket_finder;

test('rapid quiz selections retain only the latest pending destination', () => {
  const destinations = [];
  const first = () => destinations.push('first');
  const latest = () => destinations.push('latest');
  let state = transitionQuestion({ phase: 'answering' }, { type: 'request', navigate: first, wait: true });
  assert.equal(state.phase, 'waiting');
  state = transitionQuestion(state, { type: 'request', navigate: latest, wait: true });
  state = transitionQuestion(state, { type: 'leave' });
  assert.equal(state.phase, 'leaving');
  assert.deepEqual(destinations, [], 'transition selection must not execute navigation');
  state.navigate();
  assert.deepEqual(destinations, ['latest']);
  assert.deepEqual(transitionQuestion(state, { type: 'finish' }), { phase: 'answering' });
});

test('Back or Next replaces the pending automatic advance without another selection pause', () => {
  const automatic = () => {};
  const back = () => {};
  const waiting = transitionQuestion({ phase: 'answering' }, { type: 'request', navigate: automatic, wait: true });
  const leaving = transitionQuestion(waiting, { type: 'request', navigate: back, wait: false });
  assert.equal(leaving.phase, 'leaving');
  assert.equal(leaving.navigate, back);
});

test('outgoing quiz fades reject extra navigation and duplicate phase events', () => {
  const navigate = () => {};
  const leaving = transitionQuestion({ phase: 'answering' }, { type: 'request', navigate, wait: false });
  assert.equal(transitionQuestion(leaving, { type: 'request', navigate: () => {}, wait: true }), leaving);
  assert.equal(transitionQuestion(leaving, { type: 'leave' }), leaving);
  const finished = transitionQuestion(leaving, { type: 'finish' });
  assert.equal(transitionQuestion(finished, { type: 'finish' }), finished);
  assert.equal(transitionQuestion(finished, { type: 'leave' }), finished);
});

test('cancelling a pending transition removes its destination and makes late phase events harmless', () => {
  for (const wait of [true, false]) {
    const pending = transitionQuestion({ phase: 'answering' }, { type: 'request', navigate: () => {}, wait });
    const cancelled = transitionQuestion(pending, { type: 'cancel' });
    assert.deepEqual(cancelled, { phase: 'answering' });
    assert.equal(transitionQuestion(cancelled, { type: 'leave' }), cancelled);
    assert.equal(transitionQuestion(cancelled, { type: 'finish' }), cancelled);
  }
});

test('all finder translations have unique escaped Liquid data attributes', () => {
  const section = readFileSync(new URL('../sections/racket-finder.liquid', import.meta.url), 'utf8');
  const attributes = [...section.matchAll(/data-message-([a-z0-9-]+)="([\s\S]*?)"/g)];
  assert.equal(attributes.length, Object.keys(messages).length);
  const keys = attributes.map(([, name]) => name.replaceAll('-', '_'));
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys.sort(), Object.keys(messages).sort());
  for (const [, name, expression] of attributes) {
    assert.equal(
      expression.replace(/\s+/g, ' ').trim(),
      `{{ 'racket_finder.${name.replaceAll('-', '_')}' | t | escape }}`,
    );
  }
  const dataset = Object.fromEntries(
    attributes.map(([, name]) => [
      `message-${name}`.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      messages[name.replaceAll('-', '_')],
    ]),
  );
  assert.deepEqual(readMessages(dataset), messages);
});

test('translation reader preserves decoded text and ignores unrelated section data', () => {
  const value = `Racket "A" & player's choice — ₹2,000\n日本語 </script><img src=x> &quot;`;
  assert.deepEqual(
    readMessages({
      messageStyleAttack: value,
      messageReasonStyle: 'You chose [answer].',
      root: '/fr/',
      currency: 'INR',
      module: '/finder.js',
      messages: 'unrelated',
    }),
    { style_attack: value, reason_style: 'You chose [answer].' },
  );
  assert.equal(
    message(readMessages({ messageStep: 'Question [current] of [total]' }), 'step', { current: 2, total: 4 }),
    'Question 2 of 4',
  );
});

test('launch configuration and every translation reference are complete', () => {
  assert.deepEqual(validateConfig(config), []);
  assert.equal(config.products.length, 20);
  const keys = config.questions
    .flatMap((q) => [
      q.title,
      q.help,
      ...q.options.flatMap((o) => [o.label, ...(o.description ? [o.description] : [])]),
    ])
    .concat(
      config.archetypes.flatMap((a) => [a.title, a.line, a.description]),
      [config.exploration.title, config.exploration.line, config.exploration.description],
      config.products.map((p) => p.consideration),
    );
  for (const key of keys) assert.equal(typeof messages[key], 'string', key);
  for (const key of Object.keys(messages)) assert.match(key, /^[a-z0-9_]+$/);
  for (const question of config.questions) {
    assert.ok(['quiz', 'refinement'].includes(question.placement));
    assert.ok(['rows', 'compact'].includes(question.layout));
    if (question.defaultOption) {
      assert.equal(question.placement, 'refinement');
      assert.ok(question.options.some((option) => option.id === question.defaultOption));
    }
  }
  for (const archetype of config.archetypes) assert.equal(archetype.image, undefined);
});

for (const [style, expected] of [
  ['attack', 'smash-merchant'],
  ['speed', 'speed-demon'],
  ['control', 'court-chessmaster'],
  ['counter', 'comeback-kid'],
  ['adapt', 'wild-card'],
  ['unsure', null],
])
  test(`identifies ${expected} independently of budget and experience`, () => {
    for (const experience of ['new', 'developing', 'experienced']) {
      for (const budget of ['2000', '10000', 'unlimited'])
        assert.equal(identify(config, { ...answers, experience, budget, style }), expected);
    }
  });

test('unknown and tied preferences resolve without declaration-order bias', () => {
  assert.equal(identify(config, {}), null);
  assert.equal(identify(config, { style: 'unsure', pressure: 'speed', goal: 'power' }), null);
  assert.equal(identify(config, { style: 'control', pressure: 'attack', goal: 'power' }), 'court-chessmaster');
});

test('renamed personalities retain IDs while exploration has its own neutral presentation', () => {
  assert.equal(config.archetypes.length, 5);
  for (const [style, title] of [
    ['counter', 'The Counterpuncher'],
    ['adapt', 'All-Court Ace'],
  ]) {
    const profile = config.archetypes.find((a) => a.id === identify(config, { ...answers, style }));
    assert.equal(messages[profile.title], title);
    assert.equal(profile.image, undefined);
  }
  assert.equal(messages[config.exploration.title], 'Finding your court style');
  assert.equal(config.exploration.image, undefined);
  assert.equal(identify(config, { ...answers, style: 'removed-option' }), null);
});

test('saved adaptable and unsure sessions remain complete and reclassify without resetting answers', () => {
  for (const [style, expected] of [
    ['adapt', 'wild-card'],
    ['unsure', null],
  ]) {
    const saved = { ...answers, style };
    globalThis.localStorage = { getItem: () => JSON.stringify({ version: '3.0.0', answers: saved }) };
    const restored = readSaved(config);
    assert.deepEqual(restored, saved);
    assert.equal(complete(config, restored), true);
    assert.equal(identify(config, restored), expected);
    assert.equal(identify(config, { ...restored, style: 'counter' }), 'comeback-kid');
  }
});

test('all player routes complete in four questions without optional refinements', () => {
  for (const experience of ['new', 'developing', 'experienced']) {
    for (const style of config.questions.find((q) => q.id === 'style').options) {
      for (const budget of config.questions.find((q) => q.id === 'budget').options) {
        const value = { ...answers, experience, style: style.id, budget: budget.id };
        assert.deepEqual(
          quizQuestions(config).map((q) => q.id),
          ['experience', 'style', 'benefit', 'budget'],
        );
        assert.equal(complete(config, value), true);
        assert.equal(complete(config, { ...value, style: '' }), false);
        const result = rank(
          config,
          value,
          profiles.map((p) => fixture(p.handle)),
        );
        assert.ok(result.length > 0);
        assert.ok(result.every((r) => r.reasons.every((reason) => ['experience', 'style'].includes(reason.question))));
      }
    }
  }
  assert.deepEqual(
    cleanAnswers(config, {
      ...answers,
      format: 'both',
      pressure: 'speed',
      goal: 'power',
      issue: 'slow',
      injected: 'x',
    }),
    answers,
  );
});

test('optional weight strictly filters the class without changing personality or budget', () => {
  const variants = profiles.filter((p) => p.model === 'nitrix-10');
  const products = variants.map((p) => fixture(p.handle));
  const original = rank(config, answers, products);
  const refined = { ...answers, handling: 'light' };
  assert.equal(rank(config, refined, products)[0].profile.weight, '5U');
  assert.equal(identify(config, refined), identify(config, answers));
  assert.equal(complete(config, refined), true);
  assert.deepEqual(rank(config, { ...answers, handling: 'unsure' }, products), original);
  products.find((p) => p.handle === variants.find((p) => p.weight === '5U').handle).variants[0].available = false;
  assert.deepEqual(rank(config, refined, products), []);
  assert.deepEqual(cleanAnswers(config, { ...answers, handling: 'invalid' }), answers);
});

test('weight is optional and cannot influence personality', () => {
  for (const handling of ['light', 'middle', 'substantial', 'unsure']) {
    assert.equal(identify(config, { ...answers, handling }), 'smash-merchant');
    assert.equal(complete(config, { ...answers, handling }), true);
  }
});

test('invalid or partial saved answers cannot produce recommendations', () => {
  assert.deepEqual(cleanAnswers(config, null), {});
  assert.deepEqual(cleanAnswers(config, []), {});
  assert.equal(complete(config, { ...answers, budget: 'fake' }), false);
  assert.deepEqual(
    rank(
      config,
      { ...answers, budget: 'fake' },
      profiles.map((p) => fixture(p.handle)),
    ),
    [],
  );
});

test('budget is inclusive, uses the available variant, and never silently expands', () => {
  const p = fixture(profiles[0].handle, 200001);
  p.variants.push({ id: 124, title: 'Black', price: 199900, available: false });
  assert.deepEqual(rank(config, { ...answers, budget: '2000' }, [p]), []);
  p.variants[0].price = 200000;
  assert.equal(rank(config, { ...answers, budget: '2000' }, [p])[0].variant.id, 123);
});

test('picks the cheapest purchasable variant and excludes selling-plan-only variants', () => {
  const p = fixture(profiles[0].handle, 199000);
  p.variants.push({ id: 124, title: 'Blue', price: 189000, available: true });
  p.variants.push({ id: 125, title: 'Plan', price: 100, available: true, requires_selling_plan: true });
  assert.equal(rank(config, answers, [p])[0].variant.id, 124);
  p.requires_selling_plan = true;
  assert.deepEqual(rank(config, answers, [p]), []);
});

test('zero, unavailable and missing products are handled without fabricated alternatives', () => {
  assert.deepEqual(rank(config, answers, []), []);
  assert.deepEqual(rank(config, answers, [fixture(profiles[0].handle, 100, false)]), []);
  assert.equal(rank(config, answers, [fixture(profiles[0].handle)]).length, 1);
});

test('deduplicates different weight versions of a model', () => {
  const result = rank(
    config,
    answers,
    profiles.map((p) => fixture(p.handle)),
  );
  assert.equal(result.length, 3);
  assert.equal(new Set(result.map((r) => r.profile.model)).size, 3);
});

test('suitability ranks before price; eligible equal fits use higher price', () => {
  const attack = profiles.find((p) => p.model === 'nitrix-10' && p.weight === '4U');
  const speed = profiles.find((p) => p.model === 'flareon-100' && p.weight === '4U');
  const result = rank(config, answers, [fixture(speed.handle, 100), fixture(attack.handle, 200000)]);
  assert.equal(result[0].profile.handle, attack.handle);
  assert.ok(result[0].reasons.some((r) => r.question === 'style' && r.answer === 'attack'));
  assert.equal(
    rank(config, answers, [fixture(speed.handle, 400000), fixture(attack.handle, 200000)])[0].profile.handle,
    attack.handle,
  );
  const c = clone();
  c.products.forEach((p) => (p.playingStrengths = p.playerLevels = []));
  assert.equal(
    rank(c, answers, [fixture(speed.handle, 100), fixture(attack.handle, 200000)])[0].profile.handle,
    attack.handle,
  );
});

// Equal primary fit and distinct models isolate the secondary specification
// preferences. Prices deliberately favour the second candidate in each pair.
function specificationFixture(first = {}, second = {}) {
  const c = clone();
  c.products = [first, second].map((specs, index) => ({
    ...profiles[0],
    handle: `spec-${index}`,
    model: `spec-${index}`,
    playingStrengths: ['power', 'speed', 'control'],
    playerLevels: ['beginner', 'intermediate', 'advanced'],
    balance: 'Head Heavy',
    shaftFlex: 'Flexible',
    ...specs,
  }));
  return { c, products: [fixture('spec-0', 189000), fixture('spec-1', 399000)] };
}

test('verified balance refines equal fit before price for the supported style preferences', () => {
  for (const [style, preferred, alternative] of [
    ['attack', 'Head Heavy', 'Head Light'],
    ['speed', 'Head Light', 'Head Heavy'],
    ['adapt', 'Even Balanced', 'Head Heavy'],
    ['counter', 'Even Balanced', 'Head Heavy'],
    ['counter', 'Head Light', 'Head Heavy'],
  ]) {
    const { c, products } = specificationFixture({ balance: preferred }, { balance: alternative });
    const result = rank(c, { ...answers, style }, products);
    assert.equal(result[0].profile.handle, 'spec-0', style);
    assert.equal(result[0].score, result[1].score);
    assert.equal(result[0].specificationScore, 0.5);
    assert.equal(result[1].specificationScore, 0);
    assert.deepEqual(rank(c, { ...answers, style }, products.reverse()), result);
  }
});

test('unsure, control-only and disabled style scoring do not invent a balance preference', () => {
  const { c, products } = specificationFixture({}, { balance: 'Head Light' });
  for (const style of ['unsure', 'control']) {
    const result = rank(c, { ...answers, style }, products);
    assert.equal(result[0].profile.handle, 'spec-1');
    assert.ok(result.every((r) => r.specificationScore === 0));
  }
  c.questions.find((q) => q.id === 'style').weight = 0;
  assert.ok(rank(c, answers, products).every((r) => r.specificationScore === 0));
});

test('missing balance is neutral for its fit group and does not prevent verified flex scoring', () => {
  const { c, products } = specificationFixture({ balance: undefined }, { shaftFlex: 'Hard Flex' });
  const intermediate = rank(c, answers, products);
  assert.equal(intermediate[0].profile.handle, 'spec-1');
  assert.ok(intermediate.every((r) => r.specificationScore === 0));
  const beginner = rank(c, { ...answers, experience: 'new' }, products);
  assert.equal(beginner[0].profile.handle, 'spec-0');
  assert.equal(beginner[0].specificationScore, 0.25);
});

test('beginner flex preference is conservative; later experience does not imply stiff shafts', () => {
  for (const shaftFlex of ['Flexible', 'Medium']) {
    const { c, products } = specificationFixture({ shaftFlex }, { shaftFlex: 'Hard Flex' });
    const beginner = rank(c, { ...answers, experience: 'new' }, products);
    assert.equal(beginner[0].profile.handle, 'spec-0');
    assert.equal(beginner[0].specificationScore, 0.75);
    for (const experience of ['developing', 'experienced']) {
      const result = rank(c, { ...answers, experience }, products);
      assert.equal(result[0].profile.handle, 'spec-1');
      assert.equal(result[0].specificationScore, result[1].specificationScore);
    }
  }
});

test('missing flex skips flex scoring while complete balance can still refine a tie', () => {
  const { c, products } = specificationFixture({ shaftFlex: undefined }, { balance: 'Head Light' });
  const result = rank(c, { ...answers, experience: 'new' }, products);
  assert.equal(result[0].profile.handle, 'spec-0');
  assert.equal(result[0].specificationScore, 0.5);
  assert.equal(result[1].specificationScore, 0);
});

test('primary fit remains stronger than specifications and higher price', () => {
  const { c, products } = specificationFixture({ balance: 'Head Light', shaftFlex: 'Hard Flex' });
  c.products[1].playingStrengths = [];
  const result = rank(c, { ...answers, experience: 'new' }, products);
  assert.equal(result[0].profile.handle, 'spec-0');
  assert.ok(result[0].score > result[1].score);
  assert.ok(result[0].specificationScore < result[1].specificationScore);
});

test('ineligible or differently scored profiles do not suppress specification coverage for a fit group', () => {
  const { c, products } = specificationFixture({}, { balance: 'Head Light' });
  c.products.push({ ...c.products[0], handle: 'unknown', model: 'unknown', balance: undefined });
  for (const extra of [fixture('unknown', 500001), fixture('unknown', 100, false)]) {
    assert.equal(rank(c, answers, [...products, extra])[0].profile.handle, 'spec-0');
  }
  c.products[2].playingStrengths = [];
  assert.equal(rank(c, answers, [...products, fixture('unknown', 100)])[0].profile.handle, 'spec-0');
});

test('Nitrix Thunder wins the higher-price tie against Nitrix 10 without inventing missing balance', () => {
  const ten = profiles.find((p) => p.model === 'nitrix-10' && p.weight === '4U');
  const thunder = profiles.find((p) => p.model === 'nitrix-thunder' && p.weight === '4U');
  const products = [fixture(ten.handle, 189000), fixture(thunder.handle, 399000)];
  const result = rank(config, answers, products);
  assert.equal(result[0].profile.handle, thunder.handle);
  assert.equal(result[0].score, result[1].score);
  assert.ok(result.every((r) => r.specificationScore === 0));
  assert.equal(rank(config, { ...answers, budget: '2000' }, products)[0].profile.handle, ten.handle);
});

test('unlimited budget remains explicit and deterministic ties do not depend on fetch order', () => {
  const products = profiles.map((p) => fixture(p.handle, 2000000));
  assert.equal(rank(config, { ...answers, budget: 'unlimited' }, products).length, 3);
  const result = rank(config, { ...answers, budget: 'unlimited' }, products).map((r) => r.profile.handle);
  assert.deepEqual(
    rank(config, { ...answers, budget: 'unlimited' }, products.reverse()).map((r) => r.profile.handle),
    result,
  );
});

test('disabled profiles are excluded from both fetching and ranking', async () => {
  const c = clone();
  c.products = c.products.slice(0, 2);
  c.products[0].enabled = false;
  const fetched = [];
  const loaded = await loadProducts(c, '/', new AbortController().signal, async (url) => {
    const handle = url.split('/').pop().replace('.js', '');
    fetched.push(handle);
    return { ok: true, json: async () => fixture(handle) };
  });
  assert.deepEqual(fetched, [c.products[1].handle]);
  assert.deepEqual(
    rank(c, answers, loaded.products).map((r) => r.profile.handle),
    [c.products[1].handle],
  );
  assert.ok(
    rank(
      c,
      answers,
      c.products.map((p) => fixture(p.handle)),
    ).every((r) => r.profile.enabled),
  );
});

test('catalogue boundary rejects duplicate profiles and malformed inputs', () => {
  const c = clone();
  c.products.push(c.products[0]);
  assert.ok(validateConfig(c).length);
  for (const products of [null, {}, [null], [{ handle: 'invalid' }]])
    assert.throws(() => resolveMetaobjects({ complete: true, resultLimit: 3, products }, messages));
});

test('live data normalisation rejects wrong products, invalid prices and untrusted image origins', () => {
  assert.equal(normaliseProduct(fixture('wrong'), 'right'), null);
  const p = fixture('right');
  p.variants[0].price = NaN;
  assert.equal(normaliseProduct(p, 'right'), null);
  p.variants[0].price = 100;
  p.featured_image = 'https://untrusted.test/photo.jpg';
  assert.equal(normaliseProduct(p, 'right').featured_image, null);
});

test('bounded fetching collects failures independently and uses locale-aware URLs', async () => {
  const c = clone();
  c.products = c.products.slice(0, 7);
  c.concurrency = 2;
  let active = 0,
    maximum = 0;
  const urls = [];
  const result = await loadProducts(c, '/en-in/', new AbortController().signal, async (url) => {
    urls.push(url);
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    const handle = url.split('/').pop().replace('.js', '');
    return { ok: handle !== c.products[0].handle, json: async () => fixture(handle) };
  });
  assert.equal(maximum, 2);
  assert.equal(result.products.length, 6);
  assert.deepEqual(result.failed, [c.products[0].handle]);
  assert.ok(urls.every((url) => url.startsWith('/en-in/products/')));
});

test('aborted loads do not start queued requests or report deliberate aborts as failures', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await loadProducts(config, '/', controller.signal, () => {
    throw new Error('Should not fetch');
  });
  assert.deepEqual(result, { products: [], failed: [] });
});

test('saved results require the matching version and never retain arbitrary input', () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (k) => memory.get(k),
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
  saveAnswers(config, { ...answers, email: 'private@example.com' });
  assert.deepEqual(readSaved(config), answers);
  assert.ok(!memory.get(storageKey).includes('private'));
  assert.deepEqual(readSaved({ ...config, version: 'future' }), {});
  memory.set(storageKey, JSON.stringify({ version: '1.0.0', answers }));
  assert.deepEqual(readSaved(config), {});
  saveAnswers(config, { ...answers, handling: 'light' });
  assert.deepEqual(readSaved(config), { ...answers, handling: 'light' });
  forgetAnswers();
  assert.deepEqual(readSaved(config), {});
  globalThis.localStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(readSaved(config), {});
  saveAnswers(config, answers);
  forgetAnswers();
});

test('translation interpolation preserves readable text and does not evaluate markup', () => {
  assert.equal(message(messages, 'step', { current: 2, total: 7 }), 'Question 2 of 7');
  assert.equal(message({ x: '[value]' }, 'x', { value: '<script>' }), '<script>');
});

test('analytics honours current consent and survives a failing receiver', () => {
  const events = [];
  let allowed = false;
  globalThis.window = {
    Shopify: {
      customerPrivacy: { analyticsProcessingAllowed: () => allowed },
      analytics: { publish: (name, data) => events.push({ name, data }) },
    },
  };
  track(config, 'started');
  assert.equal(events.length, 0);
  allowed = true;
  track(config, 'completed', { archetype: 'speed-demon' });
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'racket_finder_completed');
  assert.deepEqual(Object.keys(events[0].data).sort(), ['archetype', 'version']);
  window.Shopify.analytics.publish = () => {
    throw new Error('unavailable');
  };
  assert.doesNotThrow(() => track(config, 'started'));
});

test('analytics loads the privacy API before checking consent without replaying denied events', async () => {
  const events = [];
  let callback;
  globalThis.window = {
    Shopify: {
      loadFeatures(features, done) {
        assert.deepEqual(features, [{ name: 'consent-tracking-api', version: '0.2' }]);
        callback = done;
      },
      analytics: { publish: (name) => events.push(name) },
    },
  };
  track(config, 'started');
  assert.equal(events.length, 0);
  window.Shopify.customerPrivacy = { analyticsProcessingAllowed: () => false };
  callback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(events.length, 0);
  window.Shopify.customerPrivacy.analyticsProcessingAllowed = () => true;
  track(config, 'answered', { question: 'style', answer: 'speed' });
  assert.deepEqual(events, ['racket_finder_answered']);
});

const imageSettings = JSON.parse(readFileSync(new URL('../templates/page.racket-finder.json', import.meta.url), 'utf8'))
  .sections.main.settings;
const archetypeImages = Object.fromEntries(
  config.archetypes.map((a) => [a.id, imageSettings[`${a.id.replaceAll('-', '_')}_image_url`]]),
);

function metaobjectPayload() {
  const c = clone();
  for (const p of c.products) p.consideration = messages[p.consideration];
  return { complete: true, products: c.products, resultLimit: c.resultLimit, archetypeImages };
}

test('section result limit preserves matching and saved-answer compatibility', () => {
  const payload = metaobjectPayload();
  const before = resolveMetaobjects(payload, messages);
  payload.resultLimit = 1;
  const edited = resolveMetaobjects(payload, messages);
  const live = profiles.map((p) => fixture(p.handle));
  assert.equal(rank(edited.config, answers, live).length, 1);
  assert.equal(edited.messages.exploring_line, messages.exploring_line);
  assert.equal(edited.config.version, before.config.version);
});

test('external payload cannot replace the fixed quiz or its translation keys', () => {
  const payload = metaobjectPayload();
  const resolved = resolveMetaobjects({ ...payload, rules: { questions: [] } }, messages);
  assert.deepEqual(resolved.config.questions, config.questions);
  assert.equal(resolved.messages, messages);
  assert.equal(resolved.config.questions.find((q) => q.id === 'handling').help, 'handling_help');
  for (const style of config.questions.find((q) => q.id === 'style').options) {
    const selected = { ...answers, style: style.id };
    const live = profiles.map((p) => fixture(p.handle));
    assert.deepEqual(
      rank(resolved.config, selected, live).map((r) => r.profile.handle),
      rank(config, selected, live).map((r) => r.profile.handle),
    );
  }
});

test('metaobject configuration never falls back to bundled profiles', () => {
  for (const invalid of [null, {}, { ...metaobjectPayload(), complete: false }])
    assert.throws(() => resolveMetaobjects(invalid, messages));
  const payload = metaobjectPayload();
  payload.products = [];
  const resolved = resolveMetaobjects(payload, messages);
  assert.deepEqual(
    rank(
      resolved.config,
      answers,
      config.products.map((p) => fixture(p.handle)),
    ),
    [],
  );
});

test('profile launches enter the shared pool and editorial copy remains plain text', () => {
  const payload = metaobjectPayload();
  const p = {
    ...payload.products[0],
    handle: 'new-launch',
    model: 'new-launch',
    playingStrengths: ['power'],
    playerLevels: ['intermediate'],
    consideration: '</script><img onerror=alert(1)>',
  };
  payload.products.push(p);
  const resolved = resolveMetaobjects(payload, messages);
  const result = rank(resolved.config, answers, [fixture('new-launch')]);
  assert.equal(result[0].profile.handle, 'new-launch');
  assert.equal(result[0].profile.consideration, p.consideration);
});

test('copy and catalogue changes preserve saved answers; schema changes reset them', () => {
  const payload = metaobjectPayload();
  const first = resolveMetaobjects(payload, messages).config;
  payload.products.pop();
  const edited = resolveMetaobjects(payload, { ...messages, style_title: 'Updated title' }).config;
  globalThis.localStorage = { getItem: () => JSON.stringify({ version: first.version, answers }) };
  assert.deepEqual(readSaved(edited), answers);
  assert.deepEqual(readSaved({ ...edited, version: '4.0.0' }), {});
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ version: '3.0.0-abc123', answers: { ...answers, obsolete: 'bad' } }),
  };
  assert.deepEqual(readSaved(edited), answers);
});

test('products without an active profile never enter the shared shortlist', () => {
  const resolved = resolveMetaobjects(metaobjectPayload(), messages);
  assert.deepEqual(rank(resolved.config, answers, [fixture('retired-product')]), []);
});

test('3U selection never returns a 4U racket even when its style score is stronger', () => {
  const result = rank(
    config,
    { ...answers, experience: 'new', style: 'control', budget: 'unlimited', handling: 'substantial' },
    profiles.map((p) => fixture(p.handle)),
  );
  assert.ok(result.length > 0);
  assert.ok(result.every((r) => r.profile.weight === '3U'));
});

test('strict weight selection never expands budget or substitutes an unavailable class', () => {
  const p3 = profiles.find((p) => p.weight === '3U');
  const p4 = profiles.find((p) => p.weight === '4U');
  const selected = { ...answers, handling: 'substantial' };
  assert.deepEqual(rank(config, selected, [fixture(p3.handle, 500001), fixture(p4.handle, 100000)]), []);
  assert.deepEqual(rank(config, selected, [fixture(p3.handle, 100000, false), fixture(p4.handle, 100000)]), []);
  assert.equal(rank(config, { ...selected, handling: 'unsure' }, [fixture(p4.handle, 100000)])[0].profile.weight, '4U');
  const c = clone();
  c.products.find((p) => p.handle === p4.handle).tags = ['3u'];
  assert.deepEqual(rank(c, selected, [fixture(p4.handle)]), []);
});

test('all supported weight selections keep every returned model in the selected class', () => {
  for (const [handling, weight] of [
    ['light', '5U'],
    ['middle', '4U'],
    ['substantial', '3U'],
  ]) {
    for (const experience of ['new', 'developing', 'experienced']) {
      for (const style of ['attack', 'speed', 'control', 'counter', 'adapt', 'unsure']) {
        const result = rank(
          config,
          { ...answers, experience, style, budget: 'unlimited', handling },
          profiles.map((p) => fixture(p.handle)),
        );
        assert.ok(result.length > 0);
        assert.ok(result.every((r) => r.profile.weight === weight));
      }
    }
  }
});

test('desired benefit is required but cannot change ranking, personality or reasons', () => {
  const live = profiles.map((p) => fixture(p.handle));
  assert.equal(complete(config, { ...answers, benefit: undefined }), false);
  for (const style of config.questions.find((q) => q.id === 'style').options) {
    const baseline = { ...answers, style: style.id };
    for (const benefit of config.questions.find((q) => q.id === 'benefit').options) {
      const value = { ...baseline, benefit: benefit.id };
      assert.deepEqual(rank(config, value, live), rank(config, baseline, live));
      assert.equal(identify(config, value), identify(config, baseline));
    }
  }
  const c = clone();
  const question = c.questions.find((q) => q.id === 'benefit');
  question.options[0].tags = ['power'];
  question.options[0].archetype = 'speed-demon';
  question.weight = 100;
  question.identityWeight = 100;

  assert.deepEqual(rank(c, answers, live), rank(config, answers, live));
  assert.equal(identify(c, answers), identify(config, answers));
  const item = rank(config, answers, live)[0];
  item.reasons.unshift({ question: 'benefit', answer: 'power' });
  assert.ok(reasonTexts(config, item, (key) => key).every((key) => key !== 'reason_benefit'));
});

test('old three-question sessions resume with the new benefit unanswered', () => {
  const oldAnswers = { experience: 'new', style: 'control', budget: '2000', handling: 'light' };
  globalThis.localStorage = { getItem: () => JSON.stringify({ version: '2.0.0-abc123', answers: oldAnswers }) };
  const restored = readSaved(config);
  assert.deepEqual(restored, oldAnswers);
  assert.equal(complete(config, restored), false);
  assert.equal(quizQuestions(config).find((q) => !restored[q.id]).id, 'benefit');
});

test('question placement controls required steps independently of IDs and array position', () => {
  const c = clone();
  const refinement = c.questions.pop();
  refinement.id = 'optional-preference';
  c.questions.unshift(refinement);
  assert.equal(quizQuestions(c)[0].id, 'experience');
  assert.equal(complete(c, answers), true);
  assert.deepEqual(cleanAnswers(c, answers), answers); // Visual defaults do not invent answers.

  const added = { ...structuredClone(c.questions.find((q) => q.id === 'benefit')), id: 'new-question' };
  c.questions.splice(2, 0, added);
  const live = profiles.map((p) => fixture(p.handle));
  assert.equal(complete(c, answers), false);
  assert.deepEqual(rank(c, answers, live), []);
  const completed = { ...answers, 'new-question': 'handling' };
  assert.equal(complete(c, completed), true);
  assert.deepEqual(rank(c, completed, live), rank(config, answers, live));
  assert.equal(identify(c, completed), identify(config, answers));
});

test('adding a required question preserves compatible saved answers and resumes at the gap', () => {
  const c = clone();
  c.questions.splice(1, 0, {
    ...structuredClone(c.questions.find((q) => q.id === 'benefit')),
    id: 'new-question',
  });
  for (const version of [config.version, '3.0.0-abc123']) {
    globalThis.localStorage = { getItem: () => JSON.stringify({ version, answers }) };
    const restored = readSaved(c);
    assert.deepEqual(restored, answers);
    assert.equal(complete(c, restored), false);
    assert.equal(quizQuestions(c).find((q) => !restored[q.id]).id, 'new-question');
  }
});

test('removed options and questions discard only affected saved answers', () => {
  const c = clone();
  c.questions.find((q) => q.id === 'style').options = c.questions
    .find((q) => q.id === 'style')
    .options.filter((option) => option.id !== 'attack');
  c.questions = c.questions.filter((q) => q.id !== 'benefit');
  globalThis.localStorage = { getItem: () => JSON.stringify({ version: config.version, answers }) };
  const restored = readSaved(c);
  assert.deepEqual(restored, { experience: 'developing', budget: '5000' });
  assert.equal(quizQuestions(c).find((q) => !restored[q.id]).id, 'style');
  assert.deepEqual(readSaved({ ...c, version: '4.0.0' }), {});
});

test('compatible partial sessions survive while malformed saved data stays empty', () => {
  for (const version of [config.version, '3.0.0-abc123', '2.0.0', '2.0.0-abc123']) {
    globalThis.localStorage = {
      getItem: () => JSON.stringify({ version, answers: { experience: 'new', style: 'removed', email: 'private' } }),
    };
    assert.deepEqual(readSaved(config), { experience: 'new' });
  }
  for (const value of ['invalid JSON', 'null', '[]', '{}', JSON.stringify({ version: config.version, answers: [] })]) {
    globalThis.localStorage = { getItem: () => value };
    assert.deepEqual(readSaved(config), {});
  }
});

test('specification scales show reviewed categories and leave missing attributes unmarked', () => {
  const profile = { ...config.products[0], weight: '3U', shaftFlex: 'Hard Flex', balance: 'Head Heavy' };
  const t = (key) => key;
  assert.deepEqual(racketSpecs(profile, t), [
    { label: 'spec_weight_label', value: '3U', position: 2, ends: ['spec_lighter', 'spec_heavier'] },
    { label: 'spec_flex_label', value: 'spec_hard_flex', position: 2, ends: ['spec_flexible', 'spec_hard_flex'] },
    {
      label: 'spec_balance_label',
      value: 'spec_head_heavy',
      position: 2,
      ends: ['spec_head_light', 'spec_head_heavy'],
    },
  ]);
  assert.deepEqual(racketSpecs({ ...profile, shaftFlex: undefined, balance: undefined }, t), [
    { label: 'spec_weight_label', value: '3U', position: 2, ends: ['spec_lighter', 'spec_heavier'] },
    { label: 'spec_flex_label', value: 'spec_unknown', position: -1, ends: ['spec_flexible', 'spec_hard_flex'] },
    { label: 'spec_balance_label', value: 'spec_unknown', position: -1, ends: ['spec_head_light', 'spec_head_heavy'] },
  ]);
});

test('specification scale positions describe categories rather than performance ratings', () => {
  const t = (key) => key;
  for (const [weight, position] of [
    ['2U', 2],
    ['3U', 2],
    ['4U', 1],
    ['5U', 0],
    ['6U', 0],
    ['7U', 0],
    ['8U', 0],
  ]) {
    const spec = racketSpecs({ ...config.products[0], weight }, t)[0];
    assert.equal(spec.value, weight);
    assert.equal(spec.position, position);
  }
  for (const [shaftFlex, balance, position] of [
    ['Flexible', 'Head Light', 0],
    ['Medium', 'Even Balanced', 1],
    ['Hard Flex', 'Head Heavy', 2],
  ]) {
    assert.deepEqual(
      racketSpecs({ ...config.products[0], shaftFlex, balance }, t)
        .slice(1)
        .map((s) => s.position),
      [position, position],
    );
  }
  assert.ok(
    racketSpecs({ ...config.products[0], weight: 'unknown', shaftFlex: 'unknown', balance: 'unknown' }, t).every(
      (s) => s.position === -1 && s.value === 'spec_unknown',
    ),
  );
});

test('verified specifications reject unsupported values and allow missing evidence', () => {
  const c = clone();
  c.products[0].shaftFlex = 'Guess';
  c.products[1].balance = 'Guess';
  assert.equal(validateConfig(c).length, 2);
  const payload = metaobjectPayload();
  payload.products[0].shaftFlex = null;
  payload.products[0].balance = null;
  assert.equal(resolveMetaobjects(payload, messages).config.products[0].shaftFlex, undefined);
});

test('weight tags never influence rank and selected weight still explains the match', () => {
  const c = clone();
  c.products.forEach((p) => {
    p.tags = ['3u', '4u', '5u'];
  });
  const live = profiles.map((p) => fixture(p.handle));
  for (const handling of ['light', 'middle', 'substantial']) {
    const selected = { ...answers, handling };
    const result = rank(c, selected, live);
    assert.deepEqual(
      result.map((r) => r.profile.handle),
      rank(config, selected, live).map((r) => r.profile.handle),
    );
    assert.ok(result.every((r) => r.reasons.some((reason) => reason.question === 'handling')));
  }
});

test('explicit suitability validates supported nonempty lists without review metadata', () => {
  assert.deepEqual(validateConfig(clone()), []);
  for (const [field, values] of [
    ['playingStrengths', [[], ['handling'], null]],
    ['playerLevels', [[], ['experienced'], null]],
  ]) {
    for (const value of values) {
      const c = clone();
      c.products[0][field] = value;
      assert.ok(validateConfig(c).length);
    }
  }
});

test('Advanced earns one point including migrated intermediate/advanced profiles; duplicates add nothing', () => {
  for (const p of profiles.filter((p) => p.playerLevels.includes('advanced'))) {
    const c = clone();
    c.products = [structuredClone(p)];
    const a = { ...answers, experience: 'experienced', style: 'unsure', budget: 'unlimited' };
    assert.equal(rank(c, a, [fixture(p.handle)])[0].score, 1);
    c.products[0].playerLevels.push('advanced');
    assert.equal(rank(c, a, [fixture(p.handle)])[0].score, 1);
  }
});

for (const format of ['png', 'jpeg', 'webp'])
  test(`card download preserves ${format} artwork bytes, file extension and temporary URL cleanup`, async (t) => {
    const image = archetypeImages['smash-merchant'];
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    let downloaded,
      clicked = 0,
      removed = 0,
      release;
    const link = { click: () => clicked++, remove: () => removed++ };
    const previous = globalThis.document;
    globalThis.document = {
      body: { appendChild: (node) => assert.equal(node, link) },
      createElement: (tag) => {
        assert.equal(tag, 'a');
        return link;
      },
    };
    t.after(() => {
      if (previous === undefined) delete globalThis.document;
      else globalThis.document = previous;
    });
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, image);
      assert.equal(options.credentials, 'omit');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(bytes, { headers: { 'Content-Type': `image/${format}` } });
    });
    t.mock.method(URL, 'createObjectURL', (blob) => {
      downloaded = blob;
      return 'blob:artwork';
    });
    const revoke = t.mock.method(URL, 'revokeObjectURL', () => {});
    t.mock.method(globalThis, 'setTimeout', (callback) => {
      release = callback;
      return 0;
    });
    await downloadCard(image);
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes);
    assert.equal(link.href, 'blob:artwork');
    assert.equal(link.download, `hndrd-court-personality.${format.replace('jpeg', 'jpg')}`);
    assert.equal(clicked, 1);
    assert.equal(removed, 1);
    release();
    assert.equal(revoke.mock.calls[0].arguments[0], 'blob:artwork');
  });

test('card download rejects unavailable, non-image and blocked CDN responses', async (t) => {
  const image = archetypeImages['smash-merchant'];
  for (const response of [new Response('', { status: 404 }), new Response('<html>Error</html>')]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(downloadCard(image), /Image request failed|Invalid image response/);
  }
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(downloadCard(image), /Failed to fetch/);
});

test('section artwork URLs populate every personality independently of matching and saved answers', () => {
  const original = resolveMetaobjects(metaobjectPayload(), messages).config;
  const custom = Object.fromEntries(
    config.archetypes.map((a) => [a.id, `https://art.example.com/${a.id}.webp?v=2&size=full`]),
  );
  const updated = resolveMetaobjects({ ...metaobjectPayload(), archetypeImages: custom }, messages).config;
  for (const archetype of updated.archetypes) {
    assert.equal(original.archetypes.find((a) => a.id === archetype.id).image, archetypeImages[archetype.id]);
    assert.equal(archetype.image, custom[archetype.id]);
  }
  for (const option of config.questions.find((q) => q.id === 'style').options) {
    const selected = { ...answers, style: option.id };
    assert.equal(identify(updated, selected), identify(original, selected));
    assert.deepEqual(
      rank(
        updated,
        selected,
        profiles.map((p) => fixture(p.handle)),
      ),
      rank(
        original,
        selected,
        profiles.map((p) => fixture(p.handle)),
      ),
    );
  }
  assert.equal(updated.version, original.version);
  assert.equal(updated.exploration.image, undefined);
  assert.ok(config.archetypes.every((a) => a.image === undefined));
});

test('blank or unsupported artwork URLs hide artwork without breaking the finder or restoring hardcoded images', () => {
  for (const value of ['', '   ', null, 42, 'http://art.example.com/image.png', 'javascript:alert(1)']) {
    const resolved = resolveMetaobjects(
      { ...metaobjectPayload(), archetypeImages: { 'smash-merchant': value } },
      messages,
    ).config;
    assert.ok(resolved.archetypes.every((a) => a.image === undefined));
    assert.equal(identify(resolved, answers), 'smash-merchant');
    assert.ok(
      rank(
        resolved,
        answers,
        profiles.map((p) => fixture(p.handle)),
      ).length,
    );
  }
  const payload = metaobjectPayload();
  delete payload.archetypeImages;
  assert.ok(resolveMetaobjects(payload, messages).config.archetypes.every((a) => a.image === undefined));
});
