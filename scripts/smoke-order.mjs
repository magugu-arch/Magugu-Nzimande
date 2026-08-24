#!/usr/bin/env node
/**
 * Place a real order, start to finish.
 *
 * Sign in, add an item, choose an address, place the order, land on the
 * confirmation and follow it into tracking. Every unit test in this repo
 * checks a piece of that; none of them checks that the pieces connect, and
 * connecting them is the only thing the app is for.
 *
 * Runs against the mock service layer, so it needs no backend — which also
 * makes it a good check that the mock layer still models the real one.
 *
 * The browser clock is pinned, for two reasons. The branches trade 10:00–22:00,
 * so an unpinned run passed in the afternoon and failed in the evening — a
 * check that depends on when you run it is not a check. And the night pass
 * below is a regression guard: this journey used to complete at half past
 * three in the morning and issue a real order reference against a kitchen that
 * had shut five hours earlier.
 *
 * Needs Playwright's Chromium once: npx playwright install chromium
 * On a machine that already has one, set CHROMIUM_PATH instead.
 *
 * Run: npm run smoke:order
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-web');
const PORT = 8124;
const BASE = `http://localhost:${PORT}`;

const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

console.log('Building the web bundle…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  // `expo export` is a release build, where the mock layer is off by default.
  // This sweep has no backend to talk to, so it asks for the mock by name —
  // the same thing eas.json's preview profile does, and for the same reason.
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

/** A Monday, so the branches keep their ordinary hours. */
const LUNCHTIME = '2026-08-24T14:00:00+02:00';
const MIDDLE_OF_THE_NIGHT = '2026-08-24T03:30:00+02:00';

/** An evening, for the pass that lets a scheduled slot go stale. */
const FIVE_PM = '2026-08-24T17:00:00+02:00';
const SIX_PM_LABEL = '18:00';
const HALF_PAST_SEVEN = '2026-08-24T19:30:00+02:00';

/** Seeded to expire seven days out, so it is good today and dead in eight. */
const LAPSING_CODE = 'SPICY15';
const LAPSING_CODE_MARKER = `Promo \u00b7 ${LAPSING_CODE}`;

/**
 * Pin the page's clock, and leave a handle to move it.
 *
 * Only `new Date()` and `Date.now()` are affected; parsing and `Date.UTC` are
 * left alone, because the app reads ISO timestamps off orders and opening
 * dates and those must still work.
 *
 * Moving it is what makes the stale-schedule pass possible: the gap between
 * choosing a slot and paying for it is the whole bug, and it is not something
 * you can sit through in a test.
 */
const pinClock = (iso) => `
  window.__t = new Date('${iso}').getTime();
  const Real = Date;
  Date = class extends Real {
    constructor(...args) { super(...(args.length ? args : [window.__t])); }
    static now() { return window.__t; }
  };
  Date.parse = Real.parse;
  Date.UTC = Real.UTC;
  window.__advanceTo = (to) => { window.__t = new Real(to).getTime(); };
`;

const steps = [];
const errors = [];
let failed = null;

try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await ctx.addInitScript(pinClock(LUNCHTIME));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('uncaught: ' + String(e).slice(0, 160)));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('Failed to load resource')) errors.push(t.slice(0, 160));
  });

  const go = (route) => page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tap = (testId) => page.locator(`[data-testid="${testId}"]`).first().click({ timeout: 10000 });
  const step = (name) => {
    steps.push(name);
    console.log(`  ✓ ${name}`);
  };

  await go('/sign-in');
  await page.locator('[data-testid="sign-in-email"]').fill('smoke@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap('sign-in-submit');
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });
  step('signed in');

  await go('/menu');
  await page.getByText('Golden Original Chicken', { exact: false }).first().click({ timeout: 10000 });
  await page.waitForURL(/product\//, { timeout: 15000 });
  step('opened a product');

  await tap('product-add-to-cart');
  step('added it to the cart');

  await go('/checkout/address');
  const addressCard = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .find((i) => i?.startsWith('address-card-')),
  );
  if (!addressCard) throw new Error('no saved address to choose');
  await tap(addressCard);
  step('chose a delivery address');

  await go('/checkout');
  const disabled = await page
    .locator('[data-testid="checkout-place-order"]')
    .first()
    .getAttribute('aria-disabled');
  if (disabled === 'true') {
    // The screen renders the reason as a caption directly above the button, so
    // report that rather than dumping the whole page at whoever hits this.
    const why = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="checkout-place-order"]');
      const footer = btn?.parentElement;
      const caption = footer && [...footer.children].find((c) => c !== btn && c.textContent?.trim());
      return caption?.textContent?.trim() ?? '(no reason shown)';
    });
    throw new Error(`place order is still blocked: "${why}"`);
  }
  step('checkout is ready to submit');

  // Snapshot the app exactly here — signed in, an item in the cart, an address
  // and a store chosen, all while the branch was open. The night pass below
  // starts from this, which is the shape the bug actually had: the selected
  // store is persisted whole, `isOpenNow: true` and all, and comes back hours
  // later still claiming it.
  const chosenWhileOpen = await ctx.storageState();

  await tap('checkout-place-order');
  // The mock service has a deliberate delay; a one-second check would be a lie.
  await page.waitForURL(/confirmation/, { timeout: 30000 });
  step('placed the order');

  const reference = await page.locator('body').innerText();
  const match = /BBQ-\d+/.exec(reference);
  if (!match) throw new Error('confirmation shows no order reference');
  step(`confirmation shows ${match[0]}`);

  await tap('confirmation-track');
  await page.waitForURL(/\/order\/[^/]+$/, { timeout: 15000 });
  const tracking = await page.locator('body').innerText();
  if (!/Order received/i.test(tracking)) throw new Error('tracking does not show the first status');
  step('tracking shows the order in progress');

  // Come back to that same basket at half past three in the morning. Every
  // branch shut at 22:00, and the store held in storage still says otherwise.
  // This used to sail through and issue a real order reference.
  const night = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
    storageState: chosenWhileOpen,
  });
  await night.addInitScript(pinClock(MIDDLE_OF_THE_NIGHT));
  const nightPage = await night.newPage();
  await nightPage.goto(BASE + '/checkout', { waitUntil: 'networkidle', timeout: 45000 });

  // Worth asserting rather than assuming: if the snapshot did not carry the
  // store across, this pass would be checking an empty checkout and passing
  // for the wrong reason.
  const saved = await nightPage.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('bbq.fulfilment') ?? '{}')?.state?.store ?? null;
    } catch {
      return null;
    }
  });
  if (!saved) throw new Error('night pass started with no saved store — nothing to check');
  if (saved.isOpenNow !== true) {
    throw new Error('the saved store no longer claims to be open; this pass proves nothing');
  }

  const nightBlocked =
    (await nightPage
      .locator('[data-testid="checkout-place-order"]')
      .first()
      .getAttribute('aria-disabled')) === 'true';
  if (!nightBlocked) {
    throw new Error('checkout took an order at 03:30, with every branch shut since 22:00');
  }

  // Blocked is not enough: the reason has to name a next step the customer can
  // actually take, or they are stuck on a disabled button with no explanation.
  const nightReason = await nightPage.evaluate(() => {
    const btn = document.querySelector('[data-testid="checkout-place-order"]');
    const footer = btn?.parentElement;
    const cap = footer && [...footer.children].find((c) => c !== btn && c.textContent?.trim());
    return cap?.textContent?.trim() ?? '';
  });
  if (!/closed/i.test(nightReason) || !/schedule/i.test(nightReason)) {
    throw new Error(`03:30 blocker does not offer a way forward: "${nightReason}"`);
  }
  step(`refused a 03:30 order on a store saved while open — "${nightReason}"`);
  await night.close();

  /**
   * Schedule at five o'clock for six, put the phone down, pay at half past
   * seven. This one is here rather than only in the unit tests because the
   * unit tests passed while the app did not: checkout memoised its blocker
   * over state, and the clock is not state, so the screen kept handing back
   * the answer it worked out when it opened.
   */
  const stale = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await stale.addInitScript(pinClock(FIVE_PM));
  const stalePage = await stale.newPage();
  const goStale = (route) =>
    stalePage.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tapStale = (id) =>
    stalePage.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });

  // Its own journey rather than a snapshot of the one above: this pass turns
  // on a difference of two and a half hours, and inheriting state captured at
  // a different time of day made its failures hard to account for.
  await goStale('/sign-in');
  await stalePage.locator('[data-testid="sign-in-email"]').fill('smoke@example.co.za');
  await stalePage.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tapStale('sign-in-submit');
  await stalePage.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });

  await goStale('/menu');
  await stalePage
    .getByText('Golden Original Chicken', { exact: false })
    .first()
    .click({ timeout: 10000 });
  await stalePage.waitForURL(/product\//, { timeout: 15000 });
  await tapStale('product-add-to-cart');

  await goStale('/checkout/address');
  const staleAddress = await stalePage.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .find((i) => i?.startsWith('address-card-')),
  );
  if (!staleAddress) throw new Error('no saved address to choose (stale-slot pass)');
  await tapStale(staleAddress);

  // In-app navigation, not a reload: the scheduled time is deliberately not
  // persisted, so a page load would drop it and this pass would prove nothing.
  await goStale('/checkout');
  await stalePage
    .getByText('As soon as possible', { exact: false })
    .first()
    .click({ timeout: 10000 });
  await stalePage.waitForURL(/schedule/, { timeout: 15000 });
  await tapStale(`schedule-slot-${SIX_PM_LABEL}`);
  await tapStale('schedule-confirm');
  await stalePage.waitForURL(/checkout$/, { timeout: 15000 });

  const scheduled = await stalePage.evaluate(() => document.body.innerText);
  if (!scheduled.includes(`\u00b7 ${SIX_PM_LABEL}`)) {
    throw new Error('the slot did not stick; this pass would prove nothing');
  }

  await stalePage.evaluate((to) => window.__advanceTo(to), HALF_PAST_SEVEN);
  await tapStale('checkout-place-order');
  await stalePage.waitForTimeout(2500);

  if (/confirmation/.test(stalePage.url())) {
    throw new Error('checkout placed an order scheduled for 18:00 at 19:30');
  }
  const staleShown = await stalePage.evaluate(() => document.body.innerText);
  if (!/that time has passed/i.test(staleShown)) {
    throw new Error('the stale slot was refused with nothing said about why');
  }
  step('refused a 18:00 slot paid for at 19:30, and said why');
  await stale.close();

  /**
   * Apply a voucher, let it expire in the basket, and pay.
   *
   * The terms the cart keeps are meant to let a voucher be re-decided against
   * the basket at any moment, and expiry was the one term left out — checked
   * once as the code was typed and never again. It charged R 214.65 against
   * R 246.00 owed, six days after the code died.
   */
  const lapsed = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await lapsed.addInitScript(pinClock(LUNCHTIME));
  const lapsedPage = await lapsed.newPage();
  const goLapsed = (route) =>
    lapsedPage.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tapLapsed = (id) =>
    lapsedPage.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });

  await goLapsed('/sign-in');
  await lapsedPage.locator('[data-testid="sign-in-email"]').fill('smoke@example.co.za');
  await lapsedPage.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tapLapsed('sign-in-submit');
  await lapsedPage.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });

  await goLapsed('/menu');
  await lapsedPage
    .getByText('Golden Original Chicken', { exact: false })
    .first()
    .click({ timeout: 10000 });
  await lapsedPage.waitForURL(/product\//, { timeout: 15000 });
  await tapLapsed('product-add-to-cart');

  await goLapsed('/checkout/address');
  const lapsedAddress = await lapsedPage.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .find((i) => i?.startsWith('address-card-')),
  );
  if (!lapsedAddress) throw new Error('no saved address to choose (lapsed-voucher pass)');
  await tapLapsed(lapsedAddress);

  // SPICY15 is seeded to expire seven days out, so it is good today.
  await goLapsed('/cart');
  await lapsedPage.locator('[data-testid="cart-promo-input"]').fill(LAPSING_CODE);
  await tapLapsed('cart-promo-apply');
  await lapsedPage.waitForTimeout(1500);
  const withDiscount = await lapsedPage.evaluate(() => document.body.innerText);
  if (!withDiscount.includes(LAPSING_CODE_MARKER)) {
    throw new Error('the voucher did not apply; this pass would prove nothing');
  }

  // Eight days on. It died yesterday. Straight to checkout in-app, because the
  // applied voucher lives in memory and a reload would simply drop it — which
  // would pass this check for entirely the wrong reason.
  await lapsedPage.evaluate(() =>
    window.__advanceTo(new Date(window.__t + 8 * 86400000).toISOString()),
  );
  await tapLapsed('cart-checkout');
  await lapsedPage.waitForURL(/checkout/, { timeout: 15000 });
  await lapsedPage.waitForTimeout(1200);

  const atCheckout = await lapsedPage.evaluate(() => document.body.innerText);
  if (atCheckout.includes(LAPSING_CODE_MARKER)) {
    throw new Error('an expired voucher was still discounting the order at checkout');
  }

  await tapLapsed('checkout-place-order');
  await lapsedPage.waitForURL(/confirmation/, { timeout: 30000 });
  const receipt = await lapsedPage.evaluate(() => document.body.innerText);
  if (/Promo discount/i.test(receipt)) {
    throw new Error('an expired voucher was charged through onto the receipt');
  }
  step('dropped a voucher that expired in the basket, and charged full price');
  await lapsed.close();
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (failed) {
  console.log(`Order journey failed after ${steps.length} step(s): ${failed}`);
  if (errors.length) console.log('Console errors:\n  ' + [...new Set(errors)].join('\n  '));
  process.exit(1);
}
if (errors.length) {
  console.log('Order placed, but the console was not clean:');
  for (const e of [...new Set(errors)]) console.log(`  ${e}`);
  process.exit(1);
}
console.log(`Order placed end to end across ${steps.length} steps, console clean.`);
process.exit(0);
