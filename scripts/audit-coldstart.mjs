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

  // The part the seeded account could never test: no saved address at all.
  await go('/checkout/address');
  await page.waitForTimeout(1200);
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

  await go('/checkout');
  await page.waitForTimeout(1800);

  // The defect this audit exists for: a customer with no saved card was
  // offered no way to pay at all, cash included.
  const rails = await page.evaluate(
    () => document.querySelectorAll('[data-testid^="payment-"]').length,
  );
  if (rails === 0) {
    throw new Error('no way to pay was offered to a customer with no saved card');
  }
  step(`offered ${rails} way(s) to pay without a saved card`);

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
    throw new Error(`a new customer cannot check out: "${why}"`);
  }

  await tap('checkout-place-order');
  await page.waitForURL(/confirmation/, { timeout: 30000 });
  const receipt = await page.locator('body').innerText();
  const reference = /BBQ-\d+/.exec(receipt);
  if (!reference) throw new Error('confirmation shows no order reference');
  step(`placed their first order — ${reference[0]}`);
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
