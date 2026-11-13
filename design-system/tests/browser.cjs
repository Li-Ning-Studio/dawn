/* Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package, or install it locally. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
const out = path.join(project, 'qa/screenshots');
fs.mkdirSync(out, { recursive: true });
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const checks = [],
  errors = [],
  failed = [];
const check = (name, condition = true) => {
  assert.ok(condition, name);
  checks.push(name);
};
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGE ERROR:', e.message); });
    page.on('console', (m) => {
      if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE ERROR:', m.text()); }
    });
    page.on('requestfailed', (r) => {
      if (!r.failure()?.errorText.includes('ABORTED')) failed.push(r.url());
    });
    const go = async (route) => {
      await page.goto(base + '/?qa=' + Date.now() + '#' + route);
      await page.locator('#root main').waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
    };
    const act = (action) =>
      page.locator(
        `body.has-dialog #overlay [data-action="${action}"]:visible, body:not(.has-dialog) #root [data-action="${action}"]:visible`,
      );
    const dialog = page.locator('#overlay');
    const next = () => act('stringing-next').click();
    const chooseString = async () => {
      await page.locator('input[name="string"]').first().check();
      await next();
      await page.locator('input[name="string-colour"]:enabled').first().check();
      await next();
      await page.locator('#tension-input').fill('26');
      await next();
    };
    await go('shop');
    check('Four collection cards', (await page.locator('#collection-grid .product-card').count()) === 4);
    await act('open-filter').click();
    await page.locator('input[name="flex"][value="hard"]').check();
    await page.locator('#filter-form button[type="submit"]').click();
    check('Flex filter returns two rackets', (await page.locator('#collection-grid .product-card').count()) === 2);
    await act('clear-filters').click();
    await act('open-sort').click();
    await page.locator('input[value="low"]').check();
    await page.locator('#sort-form button[type="submit"]').click();
    check(
      'Price sorting puts Attack first',
      (await page.locator('#collection-grid h3').first().textContent()).includes('Attack'),
    );
    await act('open-search').click();
    await page.locator('#search-input').fill('volta');
    check('Search narrows to Volta', (await page.locator('.search-result').count()) === 1);
    await page.locator('.search-result').click();
    await page.waitForURL('**/#product/nitrix-70-volta');
    check('Search opens product and closes dialog', !(await dialog.evaluate((e) => e.open)));
    await go('product/nitrix-pro-4u');
    check('Sold-out product cannot be added', await act('add-cart').isDisabled());
    await go('product/nitrix-attack-4u');
    check(
      'Unavailable colour uses a disabled labelled text choice',
      (await page.locator('input[name="product-variant"]:disabled').count()) === 1,
    );
    await go('product/nitrix-70-venom');
    await page.locator('[data-image="1"]').click();
    check('Gallery image changes', (await page.locator('#main-product-image').getAttribute('src')).endsWith('-1.png'));
    check(
      'Gallery selection keeps focus',
      await page.locator('[data-image="1"]').evaluate((e) => e === document.activeElement),
    );
    await act('open-stringing').click();
    await next();
    check(
      'Missing string is explained',
      (await page.locator('#stringing-error').textContent()).includes('Choose a string'),
    );
    await page.locator('input[name="string"]').first().check();
    await next();
    await next();
    check('Missing colour is explained', (await page.locator('#stringing-error').textContent()).includes('colour'));
    await page.locator('input[name="string-colour"]:enabled').first().check();
    await next();
    await page.locator('#tension-input').fill('33');
    await next();
    check('Above-limit tension is rejected', (await page.locator('#stringing-error').textContent()).includes('limit'));
    await page.locator('#tension-input').fill('26');
    await next();
    check(
      'Full service prices are shown',
      (await dialog.textContent()).includes('₹99') && (await dialog.textContent()).includes('₹299'),
    );
    await page.locator('input[name="method"][value="four"]').check();
    await next();
    check(
      'Four-knot total is string plus one service',
      (await page.locator('.summary-total dd').textContent()) === '₹848',
    );
    await page.screenshot({ path: out + '/stringing-mobile.png', animations: 'disabled' });
    await act('stringing-save').click();
    check('Saved stringing returns focus', await act('open-stringing').evaluate((e) => e === document.activeElement));
    await act('open-stringing').click();
    await next();
    await next();
    await page.locator('#tension-input').fill('27');
    await page.keyboard.press('Escape');
    check('Dirty configuration asks before discard', await act('discard-stringing').isVisible());
    await act('discard-stringing').click();
    check('Discard retains saved 26 lbs', (await page.locator('.service-row').textContent()).includes('26 lbs'));
    await act('add-cart').click();
    check('Configured cart subtotal is exact', (await page.locator('#cart-subtotal').textContent()) === '₹10,838');
    await page.locator('[data-action="cart-quantity"][data-delta="1"]').click();
    check('Cart quantity updates all costs', (await page.locator('#cart-subtotal').textContent()) === '₹21,676');
    await act('cart-stringing').click();
    await next();
    await next();
    await next();
    await page.locator('input[name="method"][value="two"]').check();
    await next();
    await act('stringing-save').click();
    check(
      'Cart edit replaces service price for both rackets',
      (await page.locator('#cart-subtotal').textContent()) === '₹21,276',
    );
    await page.screenshot({ path: out + '/cart-mobile.png', animations: 'disabled' });
    await act('checkout').click();
    check('Checkout stops at explicit demo boundary', (await dialog.textContent()).includes('No order or payment'));
    await act('open-cart').click();
    await act('cart-remove-service').click();
    check(
      'Removing stringing removes both string and service cost',
      (await page.locator('#cart-subtotal').textContent()) === '₹19,980',
    );
    await act('cart-remove').click();
    check('Cart removal reaches empty state', (await dialog.textContent()).includes('Your bag is empty'));
    await page.keyboard.press('Escape');
    await go('components');
    await page.locator('#example-email').fill('bad');
    await page.locator('#example-form button[type="submit"]').click();
    check(
      'Form explains invalid email',
      (await page.locator('#example-email').getAttribute('aria-invalid')) === 'true',
    );
    await page.locator('#example-email').fill('test@example.com');
    await page.locator('#example-form button[type="submit"]').click();
    check(
      'Form success is preview-only',
      (await page.locator('#example-form-message').textContent()).includes('Nothing was submitted'),
    );
    await page.locator('#tab-details').focus();
    await page.keyboard.press('ArrowRight');
    check('Tabs support arrow keys', (await page.locator('#tab-specs').getAttribute('aria-selected')) === 'true');
    await act('demo-dialog').click();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      check('Dialog contains keyboard focus ' + i, await dialog.evaluate((el) => el.contains(document.activeElement)));
    }
    await page.keyboard.press('Escape');
    check('Dialog restores trigger focus', await act('demo-dialog').evaluate((el) => el === document.activeElement));
    for (const state of ['loading', 'error', 'empty', 'success', 'disabled']) {
      await page.locator('#component-state').selectOption(state);
      check('Component state ' + state, await page.locator('#state-preview').isVisible());
    }
    await go('commerce');
    for (const state of ['loading', 'error', 'empty']) {
      await page.locator('#stringing-scenario').selectOption(state);
      await act('try-stringing').click();
      check('Stringing ' + state + ' offers recovery', await act('reset-stringing-scenario').isVisible());
      await act('reset-stringing-scenario').click();
      check('Stringing recovery restores choices', (await page.locator('input[name="string"]').count()) > 0);
      await page.keyboard.press('Escape');
    }
    for (const [scenario, method] of [
      ['four_off', 'four'],
      ['base_off', 'two'],
    ]) {
      await page.locator('#stringing-scenario').selectOption(scenario);
      await act('try-stringing').click();
      await chooseString();
      check(
        scenario + ' disables unavailable method',
        await page.locator(`input[name="method"][value="${method}"]`).isDisabled(),
      );
      await page.keyboard.press('Escape');
      if (await act('discard-stringing').isVisible()) await act('discard-stringing').click();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go('shop');
    check(
      'Reduced motion removes smooth scrolling',
      (await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)) === 'auto',
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
      for (const route of [
        'foundations',
        'components',
        'commerce',
        'guidelines',
        'shop',
        'product/nitrix-70-venom',
        'campaign',
      ]) {
        await go(route);
        await page.waitForTimeout(70);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        check(`${route} at ${width}px has no horizontal page overflow`, !overflow);
        check(
          `${route} at ${width}px has no failed loaded images`,
          await page.locator('img').evaluateAll((imgs) => imgs.every((img) => !img.complete || img.naturalWidth > 0)),
        );
        if ([390, 1440].includes(width)) {
          await page.screenshot({
            path: out + '/' + route.replace('/', '-') + '-' + width + '.png',
            fullPage: route !== 'shop',
          });
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await go('shop');
    await page.screenshot({ path: out + '/collection-mobile-final.png' });
    const source = fs.readFileSync(path.join(project, 'references/selected-no-swatches.png')).toString('base64');
    const actual = fs.readFileSync(out + '/collection-mobile-final.png').toString('base64');
    await page.setViewportSize({ width: 820, height: 894 });
    await page.setContent(
      `<html><body style="margin:0;background:#ddd;font:14px Arial;display:flex;gap:20px;padding:10px"><div>Selected source<br><img style="width:390px;height:844px" src="data:image/png;base64,${source}"></div><div>Implementation<br><img width="390" height="844" src="data:image/png;base64,${actual}"></div></body></html>`,
    );
    await page.screenshot({ path: out + '/comparison-final.png' });
    console.log(JSON.stringify({ errors, failed }));
    check('No runtime or console errors', errors.length === 0);
    check('No failed network requests', failed.length === 0);
    fs.writeFileSync(
      path.join(project, 'qa/browser-results.json'),
      JSON.stringify({ testedAt: new Date().toISOString(), checks, errors, failed }, null, 2),
    );
    console.log(JSON.stringify({ passed: checks.length, errors, failed }));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
