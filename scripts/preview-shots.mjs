#!/usr/bin/env node
/**
 * Photograph the running app for a browser preview.
 *
 * Serves the exported web build and drives it in Chromium, one route per shot
 * at phone width. These are the real screens against the mock layer — the same
 * thing `audit:screens` sweeps — not mockups.
 *
 * Run: node scripts/preview-shots.mjs   (after `expo export` into .preview-web)
 */
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(root, '.preview-web');
const SHOTS = path.join(root, '.preview-shots');
const PORT = 8127;

/** Route, the label the preview page shows, and the section it belongs to. */
const SHOTS_WANTED = [
  ['/welcome', 'Welcome', 'Getting in'],
  ['/location', 'Find your branch', 'Getting in'],
  ['/sign-in', 'Sign in', 'Getting in'],
  ['/register', 'Create an account', 'Getting in'],
  ['/verify', 'Verify the number', 'Getting in'],
  ['/reset-password?token=preview', 'Choose a new password', 'Getting in'],
  ['/home', 'Home', 'Ordering'],
  ['/menu', 'Menu', 'Ordering'],
  ['/product/golden-original', 'Product detail', 'Ordering'],
  ['/cart', 'Basket', 'Ordering'],
  ['/checkout', 'Checkout', 'Ordering'],
  ['/checkout/store', 'Pick a branch', 'Ordering'],
  ['/checkout/address', 'Delivery address', 'Ordering'],
  ['/checkout/schedule', 'Schedule it', 'Ordering'],
  ['/order/order-4821', 'Tracking a delivery', 'After the order'],
  ['/order/order-4610', 'Tracking a collection', 'After the order'],
  ['/order/order-4610/rate', 'Rate the order', 'After the order'],
  ['/orders', 'Order history', 'After the order'],
  ['/rewards', 'Rewards', 'Loyalty'],
  ['/rewards/vouchers', 'Vouchers', 'Loyalty'],
  ['/offers', 'Offers', 'Loyalty'],
  ['/more', 'More', 'Account'],
  ['/account/profile', 'Profile', 'Account'],
  ['/account/preferences', 'Preferences', 'Account'],
  ['/account/notifications', 'Notifications', 'Account'],
  ['/account/payment-methods', 'Payment methods', 'Account'],
  ['/account/help', 'Help', 'Account'],
  ['/account/contact', 'Contact us', 'Account'],
];

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

/** Static server with an SPA fallback, so client-side routes resolve. */
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let file = path.join(BUILD, decodeURIComponent(url.pathname));
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(BUILD, 'index.html');
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'text/plain' });
  createReadStream(file).pipe(response);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

const taken = [];
for (const [route, label, section] of SHOTS_WANTED) {
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(String(error)));

  try {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
    // The mock layer resolves on a timer; give the screen its data before the
    // shutter, or every capture is a skeleton.
    await page.waitForTimeout(1400);

    const name = `${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'index'}.png`;
    await page.screenshot({ path: path.join(SHOTS, name) });
    taken.push({ route, label, section, file: name, problems });
    process.stdout.write(`${problems.length > 0 ? '!' : '.'}`);
  } catch (error) {
    process.stdout.write('x');
    taken.push({ route, label, section, file: null, problems: [String(error)] });
  } finally {
    await page.close();
  }
}

process.stdout.write('\n');
await browser.close();
server.close();

const failed = taken.filter((shot) => !shot.file);
const noisy = taken.filter((shot) => shot.file && shot.problems.length > 0);
console.log(`captured ${taken.length - failed.length}/${taken.length}`);
if (failed.length > 0) console.log('failed:', failed.map((shot) => shot.route).join(', '));
if (noisy.length > 0) {
  for (const shot of noisy) console.log(`console errors on ${shot.route}:`, shot.problems[0]);
}

import('node:fs').then(({ writeFileSync }) =>
  writeFileSync(path.join(SHOTS, 'index.json'), JSON.stringify(taken, null, 2)),
);
