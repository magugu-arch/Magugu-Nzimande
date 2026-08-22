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
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const steps = [];
const errors = [];
let failed = null;

try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
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
