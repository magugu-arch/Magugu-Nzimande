#!/usr/bin/env node
/**
 * Earn the points the app promised, then spend them.
 *
 * Loyalty was the one part of this app whose arithmetic nothing could check.
 * `fetchLoyaltyAccount` returned a frozen constant, so the confirmation
 * promised 287 points, the balance stayed at 1 840 and the history never
 * mentioned the order. Redeeming deducted nothing at all, so the same
 * 1 500-point reward could be spent over and over for ever. Every answer was
 * the same answer, which is why no test could say what the right one was.
 *
 * The unit tests now pin the arithmetic. This is here for the other half: that
 * a customer *sees* it. The balance on the rewards screen, the entry in the
 * history, the reward that stops being affordable once it has been spent —
 * those are three different screens reading the same number, and a demo build
 * is where anybody would first notice they disagreed.
 *
 * Every step navigates in-app. Going by URL reloads the bundle, which resets
 * the mock's ledgers along with the balance — so a URL-driven version of this
 * journey would compare 1 840 against 1 840 and call it a pass.
 *
 * Run: npm run audit:points
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-points');
const PORT = 8195;
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
  const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });
  const step = (name) => {
    steps.push(name);
    console.log(`  ✓ ${name}`);
  };

  /**
   * The tab bar renders real anchors, so this is in-app navigation, not a
   * reload — which is the whole point of this journey.
   *
   * `:visible` is load-bearing. Expo Router keeps every screen you have been
   * to mounted, each with its own copy of the tab bar, so a plain `.first()`
   * picks an anchor on a screen nobody can see and the click times out with
   * the element sitting right there in the DOM.
   */
  const openTab = async (route) => {
    await page.locator(`a[href="${route}"]:visible`).first().click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  };

  /**
   * The balance as the rewards screen states it, read back as a number.
   *
   * Digits are grouped with a non-breaking thin space for legibility, so this
   * strips anything that is not a digit rather than assuming a separator.
   */
  const readBalance = async () => {
    await openTab('/rewards');
    const shown = await page.evaluate(() => document.body.innerText);
    const match = /([\d    ]{3,})\s*\n\s*points/i.exec(shown);
    if (!match) throw new Error('the rewards screen does not state a points balance');
    const value = Number(match[1].replace(/\D/g, ''));
    if (!Number.isFinite(value)) throw new Error(`could not read "${match[1]}" as a balance`);
    return value;
  };

  await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('[data-testid="sign-in-email"]').fill('loyal@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap('sign-in-submit');
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
  await page.waitForTimeout(1500);
  // The location sheet sits over everything until it is answered.
  await page.getByText('Not now', { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  step('signed in');

  const before = await readBalance();
  step(`the rewards screen states a balance — ${before} points`);

  // Build an order, entirely in-app.
  // From the home carousel, by the card's own accessible name. A bare text
  // match lands on a child node that the card's own layers cover, and the menu
  // tab has the sticky cart bar over the foot of the list as well.
  await openTab('/home');
  await page
    .getByLabel(/^Golden Original Chicken/)
    .first()
    .click({ timeout: 10000 });
  await page.waitForURL(/product\//, { timeout: 15000 });
  await tap('product-add-to-cart');
  await page.waitForTimeout(1500);
  await tap('sticky-cart-bar');
  await page.waitForTimeout(1800);
  await tap('cart-checkout');
  await page.waitForTimeout(2500);

  /**
   * What the app promises, taken off the screen that promises it. Asserting
   * against a number typed in here would only prove the two halves of this
   * script agree with each other.
   */
  const receiptText = await page.evaluate(() => document.body.innerText);
  const promised = Number(
    /You.ll earn\s+([\d\s\u202f\u2009\u00a0]+?)\s*bb\.q points/i
      .exec(receiptText)?.[1]
      ?.replace(/\D/g, '') ?? '',
  );
  if (!Number.isFinite(promised) || promised <= 0) {
    throw new Error('checkout does not say how many points this order earns');
  }

  /**
   * Why the button is disabled, rather than a timeout on the click.
   *
   * Tapping a disabled button reports "locator.click: Timeout 10000ms", which
   * says nothing about the order. This journey never picks a store or an
   * address — it leans on checkout pre-selecting both — so when a change to
   * that pre-select breaks it, the reason is exactly what needs reading.
   */
  const blocked = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="checkout-place-order"]');
    if (button?.getAttribute('aria-disabled') !== 'true') return null;
    const footer = button.parentElement;
    const caption =
      footer && [...footer.children].find((child) => child !== button && child.textContent?.trim());
    return caption?.textContent?.trim() ?? '(no reason shown)';
  });
  if (blocked) throw new Error(`checkout will not take the order: "${blocked}"`);

  await tap('checkout-place-order');
  await page.waitForURL(/confirmation/, { timeout: 30000 });
  const reference = /BBQ-\d+/.exec(await page.locator('body').innerText())?.[0];
  if (!reference) throw new Error('confirmation shows no order reference');
  step(`placed an order promising ${promised} points — ${reference}`);

  // The confirmation sits outside the tab navigator, so there is no tab bar to
  // click until its own way back has been taken.
  // Forced, deliberately. The button is there and it is the only one of its
  // name — Expo Router keeps the screens underneath mounted, so on web an
  // earlier screen's container sits over it and Playwright will not call it
  // clickable. That is the DOM this harness produces, not something a thumb on
  // a handset would meet.
  // Forced, deliberately. The button is there and it is the only one of its
  // name — Expo Router keeps the screens underneath mounted, so on web an
  // earlier screen's container sits over it and Playwright will not call it
  // clickable. That is the DOM this harness produces, not something a thumb on
  // a handset would meet.
  await page
    .locator('[data-testid="confirmation-home"]')
    .first()
    .click({ timeout: 10000, force: true });
  await page.waitForTimeout(2000);

  const after = await readBalance();
  if (after === before) {
    throw new Error(
      `the balance did not move: ${before} before the order, ${before} after, ` +
        `for an order that promised ${promised} points`,
    );
  }
  if (after !== before + promised) {
    throw new Error(
      `the balance moved by ${after - before}, but the order promised ${promised}`,
    );
  }
  step(`the points arrived — ${before} → ${after}`);

  // And the history has to account for them, not merely the headline number.
  const history = await page.evaluate(() => document.body.innerText);
  if (!history.includes(reference)) {
    throw new Error(`the points history does not mention ${reference}`);
  }
  step('the history says where the points came from');
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (failed) {
  console.log(`The points did not add up after ${steps.length} step(s): ${failed}`);
  process.exit(1);
}
console.log(`Points earned on an order reach the customer's balance, in ${steps.length} steps.`);
process.exit(0);
