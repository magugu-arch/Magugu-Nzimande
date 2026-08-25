#!/usr/bin/env node
/**
 * Order twice.
 *
 * Every check in this repo places a *first* order. The smoke test does, the
 * cold-start audit does, every browser journey I have driven by hand does —
 * and a first order is the one order where checkout already has an address in
 * hand, because the customer has just tapped it. So the entire second half of
 * the commonest journey there is went unlooked-at, and it was broken:
 *
 *     FIRST order  : {"disabled":null,  "reason":"(none)"}
 *     SECOND order : {"disabled":"true","reason":"Add a delivery address"}
 *
 * Two different things had to be true for that. `reset()` nulled the address
 * when the order went through, and checkout — which pre-selects a branch and a
 * card for you — never offered to pick the address back up. So this drives two
 * journeys, one for each:
 *
 *   1. Order, then order again. Covers the state kept across a placed order.
 *   2. Sign in with the device store wiped, the way a new phone arrives.
 *      Covers checkout restoring the address from the account.
 *
 * Run: npm run audit:returning
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-returning');
const PORT = 8193;
const BASE = `http://localhost:${PORT}`;

/** A Monday lunchtime, so the branches are trading and the clock is not the test. */
const LUNCHTIME = '2026-08-24T13:00:00+02:00';

const pinClock = (iso) => `
  const fixed = new Date('${iso}').getTime();
  const Real = Date;
  Date = class extends Real {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  };
  Date.parse = Real.parse;
  Date.UTC = Real.UTC;
`;

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

console.log('Building…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const steps = [];
let failed = null;

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await context.addInitScript(pinClock(LUNCHTIME));

  const page = await context.newPage();
  const go = (route) => page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });
  const step = (name) => {
    steps.push(name);
    console.log(`  ✓ ${name}`);
  };

  /** Why the Place Order button is disabled, in the customer's own words. */
  const blocker = async () => {
    const disabled = await page
      .locator('[data-testid="checkout-place-order"]')
      .first()
      .getAttribute('aria-disabled');
    if (disabled !== 'true') return null;
    return page.evaluate(() => {
      const button = document.querySelector('[data-testid="checkout-place-order"]');
      const footer = button?.parentElement;
      const caption =
        footer && [...footer.children].find((child) => child !== button && child.textContent?.trim());
      return caption?.textContent?.trim() ?? '(no reason shown)';
    });
  };

  const addFoodToCart = async () => {
    await go('/menu');
    await page.getByText('Golden Original Chicken', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForURL(/product\//, { timeout: 15000 });
    await tap('product-add-to-cart');
  };

  /**
   * Note the reference will read the same on every pass. Navigating by URL
   * reloads the bundle, which resets the mock's counter along with everything
   * else in module state — so it is evidence a confirmation was reached, not
   * evidence of a distinct order. The persisted store is what actually carries
   * anything across, and that is what the assertions above lean on.
   */
  const placeDeliveryOrder = async (which) => {
    await go('/checkout');
    await page.waitForTimeout(1500);
    await tap('fulfilment-delivery');
    await page.waitForTimeout(1500);

    const why = await blocker();
    if (why) throw new Error(`the ${which} order could not be placed: "${why}"`);

    await tap('checkout-place-order');
    await page.waitForURL(/confirmation/, { timeout: 30000 });
    const reference = /BBQ-\d+/.exec(await page.locator('body').innerText());
    if (!reference) throw new Error(`the ${which} order's confirmation shows no reference`);
    return reference[0];
  };

  const signIn = async (email) => {
    await go('/sign-in');
    await page.locator('[data-testid="sign-in-email"]').fill(email);
    await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
    await tap('sign-in-submit');
    await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
  };

  // ---- Journey one: order, then order again ----
  await signIn('regular@example.co.za');
  step('signed in');

  /**
   * The address they pick is deliberately *not* their default one.
   *
   * Two separate things had to be fixed here, and either one on its own is
   * enough to get a second order placed — which means an audit that only asks
   * "was the button enabled?" passes with one of them reverted, and proves
   * nothing about the other. Reverting `reset` and watching this pass is
   * exactly how that was found.
   *
   * Choosing the address that is not the default splits them apart. If the
   * placed order throws the choice away, checkout's pre-select is what answers
   * next time, and it answers with the *default* — so the second order goes to
   * Melrose Arch when the customer sent the first one to Sandton, quietly, on
   * a screen they had no reason to re-read. That is the failure worth guarding
   * against, and it is a worse one than being asked to pick again.
   */
  await addFoodToCart();
  await go('/checkout/address');
  await page.waitForTimeout(1200);
  const saved = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((element) => element.getAttribute('data-testid'))
      .filter((id) => id?.startsWith('address-card-')),
  );
  const notDefault = saved.find((id) => id !== 'address-card-address-home');
  if (!notDefault) {
    throw new Error('this account was supposed to have a second, non-default address');
  }
  const chosenId = notDefault.replace('address-card-', '');
  await tap(notDefault);
  step(`chose the address that is not their default — ${chosenId}`);

  const first = await placeDeliveryOrder('first');
  step(`placed a first order — ${first}`);

  /**
   * What the placed order left behind, read off the device rather than
   * inferred from a screen.
   *
   * `reset()` runs when the order goes through, and the persisted store is the
   * only thing that carries anything across the reload below — the mock's
   * ledgers are module state and start again from the seed every time. So this
   * is the exact record the next order will be built from, and it is worth
   * asserting on directly rather than inferring from a button being enabled.
   *
   * Only the address, deliberately. The branch is checked here too and comes
   * back set — `reset` does clear it, and checkout's own pre-select effect
   * fires once more before the screen unmounts and puts the preferred branch
   * straight back. Which is what it would do on the next visit anyway, so
   * asserting it were null would be asserting something the app has never
   * done and does not need to.
   */
  const kept = await page.evaluate(() => window.localStorage.getItem('bbq.fulfilment'));
  const state = JSON.parse(kept ?? '{}')?.state ?? {};
  if (!state.address) {
    throw new Error('placing the order threw away the address the customer had just used');
  }
  if (state.address.id !== chosenId) {
    throw new Error(
      `the next order would go to ${state.address.label}, not the ${chosenId} they chose`,
    );
  }
  step('the placed order kept the address it was actually delivered to');

  // The whole point. Nothing between these two but hunger.
  await addFoodToCart();
  await go('/checkout');
  await page.waitForTimeout(1500);
  await tap('fulfilment-delivery');
  await page.waitForTimeout(1500);

  // Read it off the screen too, not only off the device: this is the line the
  // customer would have had to notice had changed.
  const showing = await page.evaluate(() => document.body.innerText);
  if (!/Alice Lane/i.test(showing)) {
    throw new Error('the second order is not showing the address the first one went to');
  }

  const second = await placeDeliveryOrder('second');
  step(`ordered again, to the same address, without being asked for it — ${second}`);

  // ---- Journey two: the same account on a phone that has never seen it ----
  //
  // Wiping the persisted stores is exactly what a new handset looks like from
  // the app's side: the account still has the address, the device knows
  // nothing. Journey one alone cannot see this, because there the address is
  // never missing in the first place.
  await page.evaluate(() => window.localStorage.clear());
  await go('/');
  await signIn('regular@example.co.za');
  const leftover = await page.evaluate(() =>
    window.localStorage.getItem('bbq.fulfilment'),
  );
  if (leftover && /"address":\{/.test(leftover)) {
    throw new Error('the device was supposed to start with no address saved on it');
  }
  await addFoodToCart();
  const third = await placeDeliveryOrder('new-phone');
  step(`ordered from a phone with nothing saved on it — ${third}`);
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (failed) {
  console.log(`A returning customer got stuck after ${steps.length} step(s): ${failed}`);
  process.exit(1);
}
console.log(`A customer can order more than once, in ${steps.length} steps.`);
process.exit(0);
