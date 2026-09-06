#!/usr/bin/env node
/**
 * Watch the tracking screen the way somebody waiting for food watches it.
 *
 * `etaMinutes` is how long an order takes, counted from when the kitchen
 * starts — a property of the order, fixed when it is placed. Tracking printed
 * it directly, so the line never moved:
 *
 *     t+0min  : Out for delivery in 35 – 45 min
 *     t+15min : Out for delivery in 35 – 45 min
 *     t+30min : Out for delivery in 35 – 45 min
 *     t+45min : Out for delivery in 35 – 45 min
 *
 * Three quarters of an hour after ordering, still forty minutes away, beside a
 * progress bar that had been climbing the whole time. Two things on one card,
 * one of them true.
 *
 * The clock here is Playwright's own, which patches `Date` *and* drives
 * timers. That matters: the screen re-renders off a once-a-minute interval, so
 * a hand-rolled `Date` shim moves the clock without ever waking the thing that
 * reads it — and a first attempt at this journey reported the line as frozen
 * after the fix had already landed.
 *
 * Run: npm run audit:tracking
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-tracking');
const PORT = 8199;
const BASE = `http://localhost:${PORT}`;

/** A Monday lunchtime, so the branches are trading and the clock is not the test. */
const LUNCHTIME = '2026-08-24T13:00:00+02:00';

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
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
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

  const page = await context.newPage();
  await page.clock.install({ time: new Date(LUNCHTIME) });

  const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click({ timeout: 15000 });
  const step = (name) => {
    steps.push(name);
    console.log(`  ✓ ${name}`);
  };

  const readCard = async () => {
    const status = await page
      .locator('[data-testid="tracking-status"]')
      .first()
      .textContent()
      .catch(() => null);
    const eta = await page
      .locator('[data-testid="tracking-eta"]')
      .first()
      .textContent()
      .catch(() => null);
    // "35 – 45 min" → 40, the middle of the window the customer is shown.
    const bounds = eta && /(\d+)\s*–\s*(\d+)\s*min/.exec(eta);
    return {
      status: status?.trim() ?? null,
      eta: eta?.trim() ?? null,
      middle: bounds ? (Number(bounds[1]) + Number(bounds[2])) / 2 : null,
    };
  };

  await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('[data-testid="sign-in-email"]').fill('waiting@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap('sign-in-submit');
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 25000 });
  await page.waitForTimeout(1200);
  await page.getByText('Not now', { exact: false }).first().click({ timeout: 5000 }).catch(() => {});

  await page.goto(BASE + '/menu', { waitUntil: 'networkidle', timeout: 45000 });
  await page.getByText('Golden Original Chicken', { exact: false }).first().click({ timeout: 15000 });
  await page.waitForURL(/product\//, { timeout: 15000 });
  await tap('product-add-to-cart');

  await page.goto(BASE + '/checkout/address', { waitUntil: 'networkidle', timeout: 45000 });
  const saved = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid]')]
      .map((element) => element.getAttribute('data-testid'))
      .find((id) => id?.startsWith('address-card-')),
  );
  if (!saved) throw new Error('this account was supposed to have a saved address');
  await tap(saved);

  await page.goto(BASE + '/checkout', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1800);
  await tap('checkout-place-order');
  await page.waitForURL(/confirmation/, { timeout: 30000 });
  await tap('confirmation-track');
  await page.waitForTimeout(2500);

  const first = await readCard();
  if (first.middle === null) {
    throw new Error(`tracking states no time to wait — it says "${first.eta ?? '(nothing)'}"`);
  }
  step(`placed an order — tracking says ${first.eta}`);

  // Ten minutes on. The window has to have come down by about ten minutes.
  await page.clock.fastForward(10 * 60_000);
  await page.waitForTimeout(2000);

  const later = await readCard();
  if (later.middle === null) {
    throw new Error('the wait vanished after ten minutes, long before the order was due');
  }
  const moved = first.middle - later.middle;
  if (moved <= 0) {
    throw new Error(
      `ten minutes passed and the wait did not come down: "${first.eta}" then "${later.eta}"`,
    );
  }
  if (Math.abs(moved - 10) > 2) {
    throw new Error(
      `ten minutes passed and the wait moved by ${moved}: "${first.eta}" then "${later.eta}"`,
    );
  }
  step(`ten minutes on, it says ${later.eta}`);

  /**
   * And once the order is done, the card stops promising a time.
   *
   * Note what this does *not* reach. The mock finishes an order at exactly the
   * moment its ETA expires, so `dueInMinutes <= 0` and "completed" arrive
   * together and there is no window in which an order is late but still on its
   * way. Real kitchens run late and real backends keep such an order
   * out-for-delivery past its estimate, which is the case the countdown is
   * written to handle — and the arithmetic for it is pinned in the unit tests
   * ("goes negative once the order is overdue, rather than sticking") rather
   * than here, because this journey cannot produce it.
   */
  await page.clock.fastForward(60 * 60_000);
  await page.waitForTimeout(2500);

  const done = await readCard();
  if (done.middle !== null) {
    throw new Error(`an hour later the order is finished and tracking still promises "${done.eta}"`);
  }
  if (!done.status) {
    throw new Error('the card says nothing at all about where the order got to');
  }
  step(`once it is done the countdown is gone, and it says "${done.status}"`);
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (failed) {
  console.log(`Tracking misled the customer after ${steps.length} step(s): ${failed}`);
  process.exit(1);
}
console.log(`The wait on the tracking screen counts down, in ${steps.length} steps.`);
process.exit(0);
