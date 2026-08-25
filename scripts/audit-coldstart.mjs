#!/usr/bin/env node
/**
 * Order a meal as somebody who installed the app this morning.
 *
 * Nothing saved: no address, no card, no order history, no points. That is
 * every customer bb.q gains on 1 October, and it was the one account the
 * seeded data could not represent — the seed handed everybody two cards, two
 * addresses and a shopping history.
 *
 * That kindness has now hidden three separate defects. A store list where
 * every branch was open. A payment list where five rails always arrived
 * together, so nobody noticed that a customer with no saved card was offered
 * nothing at all — not even cash. A menu that always answered. Each looked
 * fine against the seed and broke against the world.
 *
 * So this signs in as the awkward customer and makes them do the whole thing:
 * find food, add an address from scratch, pick a way to pay that they never
 * set up, and get an order reference at the end.
 *
 * Run: npm run audit:coldstart
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-coldstart');
const PORT = 8191;
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

console.log('Building as a customer with nothing saved…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1', EXPO_PUBLIC_SEED_PROFILE: 'new-customer' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const steps = [];
const errors = [];
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
  page.on('pageerror', (e) => errors.push('uncaught: ' + String(e).slice(0, 160)));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !text.includes('Failed to load resource')) {
      errors.push(text.slice(0, 160));
    }
  });

  const go = (route) => page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });
  const step = (name) => {
    steps.push(name);
    console.log(`  ✓ ${name}`);
  };

  await go('/sign-in');
  await page.locator('[data-testid="sign-in-email"]').fill('opening.day@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap('sign-in-submit');
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });
  step('signed in with a brand-new account');

  // Orders and rewards must be honestly empty, not broken.
  await go('/orders');
  await page.waitForTimeout(1500);
  const ordersText = await page.evaluate(() => document.body.innerText);
  if (/Something went wrong/i.test(ordersText)) {
    throw new Error('Orders errored for a customer who has simply never ordered');
  }
  step('an empty order history reads as empty, not broken');

  await go('/menu');
  await page.getByText('Golden Original Chicken', { exact: false }).first().click({ timeout: 10000 });
  await page.waitForURL(/product\//, { timeout: 15000 });
  await tap('product-add-to-cart');
  step('found food and put it in the basket');

  /**
   * Collection and dine-in first, with no address saved anywhere.
   *
   * Somebody collecting their own food has no reason to type an address, and
   * that is exactly the state in which a wrongly-scoped rule would strand
   * them. Running these after the address was added — which is how this was
   * written first — makes the check unable to fail: with an address present,
   * a guard that wrongly demands one never fires. Reverting the delivery-only
   * scope on that rule proved it, by passing.
   */
  for (const fulfilment of ['collection', 'dinein']) {
    await go('/checkout');
    await page.waitForTimeout(1200);

    const selector = page.locator(`[data-testid="fulfilment-${fulfilment}"]`).first();
    if ((await selector.count()) === 0) {
      throw new Error(`checkout offers no way to choose ${fulfilment}`);
    }
    await selector.click({ timeout: 10000 });
    await page.waitForTimeout(1500);

    if (fulfilment === 'dinein') {
      const table = page.locator('[data-testid="checkout-table-number"]').first();
      if ((await table.count()) === 0) {
        throw new Error('dine-in does not ask which table to bring it to');
      }
      await table.fill('12');
      await page.waitForTimeout(1200);
    }

    const rails = await page.evaluate(
      () => document.querySelectorAll('[data-testid^="payment-"]').length,
    );
    if (rails === 0) throw new Error(`no way to pay was offered for ${fulfilment}`);

    const blocked = await page
      .locator('[data-testid="checkout-place-order"]')
      .first()
      .getAttribute('aria-disabled');
    if (blocked === 'true') {
      const why = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="checkout-place-order"]');
        const footer = btn?.parentElement;
        const cap = footer && [...footer.children].find((c) => c !== btn && c.textContent?.trim());
        return cap?.textContent?.trim() ?? '(no reason shown)';
      });
      throw new Error(`${fulfilment} is blocked for someone with no saved address: "${why}"`);
    }

    step(`${fulfilment} works with no address on file — ${rails} way(s) to pay`);
  }

  /**
   * The part the seeded account could never test: no saved address at all.
   *
   * Reached by tapping through from checkout rather than by URL, and that is
   * load-bearing rather than tidiness. Navigating by URL reloads the bundle,
   * and the mock's ledgers are module state — so an address added on one
   * screen no longer exists on the next, and the order goes out with an id
   * that matches nothing. That is the harness, not the app, but it is enough
   * to hide a real defect underneath it: this journey could not tell the
   * difference between "the address was lost in a reload" and "the order was
   * recorded without one", and the second was true.
   */
  await go('/checkout');
  await page.waitForTimeout(1200);
  await tap('fulfilment-delivery');
  await page.waitForTimeout(1200);
  await page.getByText('Delivering to', { exact: false }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  const preexisting = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .filter((id) => id?.startsWith('address-card-')),
  );
  if (preexisting.length > 0) {
    throw new Error('this account was supposed to have no saved addresses; the seed leaked in');
  }

  await tap('address-add');
  await page.waitForTimeout(400);
  // Matched on a fragment with no apostrophe in it. The first version of this
  // used a typographic apostrophe where the source has a straight one, so the
  // Label field was never filled, validation failed, no address was created —
  // and the step below still printed a tick, because it asserted nothing. A
  // check that cannot fail is worse than no check.
  const fields = [
    ['Home, Work', 'Home'],
    ['14 Acacia Road', '14 Acacia Road'],
    ['Melrose Arch', 'Rosebank'],
    ['Johannesburg', 'Johannesburg'],
    ['2196', '2196'],
    ['Gauteng', 'Gauteng'],
  ];
  for (const [placeholder, value] of fields) {
    const input = page.getByPlaceholder(placeholder, { exact: false }).first();
    if ((await input.count()) === 0) {
      throw new Error(`the address form has no field matching "${placeholder}"`);
    }
    await input.fill(value);
  }
  await tap('address-save');
  await page.waitForTimeout(2500);

  const saved = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((e) => e.getAttribute('data-testid'))
      .filter((id) => id?.startsWith('address-card-')),
  );
  if (saved.length === 0) {
    const shown = await page.evaluate(() => document.body.innerText);
    const complaint = /required|must|enter|invalid/i.exec(shown)?.[0] ?? 'no reason shown';
    throw new Error(`saving the first address did not produce one (${complaint})`);
  }
  step('added a delivery address from nothing');

  // Tapping the new card selects it and goes back to checkout the way the
  // customer would — in-app, so nothing the mock is holding is thrown away.
  await tap(saved[0]);
  await page.waitForTimeout(1800);
  if (!/checkout/.test(page.url())) {
    throw new Error(`choosing the address did not return to checkout — landed on ${page.url()}`);
  }

  const deliveryRails = await page.evaluate(
    () => document.querySelectorAll('[data-testid^="payment-"]').length,
  );
  if (deliveryRails === 0) throw new Error('no way to pay was offered for delivery');
  const deliveryBlocked = await page
    .locator('[data-testid="checkout-place-order"]')
    .first()
    .getAttribute('aria-disabled');
  if (deliveryBlocked === 'true') {
    const why = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="checkout-place-order"]');
      const footer = btn?.parentElement;
      const cap = footer && [...footer.children].find((c) => c !== btn && c.textContent?.trim());
      return cap?.textContent?.trim() ?? '(no reason shown)';
    });
    throw new Error(`a new customer cannot check out for delivery: "${why}"`);
  }
  step(`delivery works once an address exists — ${deliveryRails} way(s) to pay`);

  // And actually place it, from here, without another trip through the URL
  // bar. A journey that stops at "ready to submit" has not proved very much.
  await tap('checkout-place-order');
  await page.waitForURL(/confirmation/, { timeout: 30000 });
  const receipt = await page.locator('body').innerText();
  const reference = /BBQ-\d+/.exec(receipt);
  if (!reference) throw new Error('confirmation shows no order reference');

  /**
   * A reference alone proves the request went through, not that the order is
   * right. This screen is the one a customer reads to check the app understood
   * them, so it has to name the two things they just chose: where it is going
   * and how they are paying for it.
   *
   * Both are things only a customer with nothing saved can catch. Everything
   * on a seeded account matches the seed by construction.
   */
  if (!/14 Acacia Road/.test(receipt)) {
    const showing = /Delivering to\s*\n?\s*(.+)/.exec(receipt)?.[1]?.trim() ?? '(nothing)';
    throw new Error(`the confirmation does not name the address they typed — it says "${showing}"`);
  }
  const paidWith = /Paid with\s*\n?\s*(.+)/.exec(receipt)?.[1]?.trim() ?? '(nothing)';
  if (!/SnapScan|EFT|Cash/i.test(paidWith)) {
    throw new Error(`the confirmation says they paid with "${paidWith}", which they did not`);
  }
  step(`placed their first order — ${reference[0]}, to 14 Acacia Road, by ${paidWith}`);
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (failed) {
  console.log(`A new customer got stuck after ${steps.length} step(s): ${failed}`);
  process.exit(1);
}
if (errors.length > 0) {
  console.log(`Journey completed, but the console was not clean:\n  ${errors.slice(0, 5).join('\n  ')}`);
  process.exit(1);
}
console.log(`Someone who installed the app this morning can order, in ${steps.length} steps.`);
process.exit(0);
