#!/usr/bin/env node
/**
 * Render the Expo app's web build route by route and photograph it.
 *
 * This is a layout and wiring check through react-native-web, not a
 * substitute for running on iOS and Android: native sheets, the native stack
 * and haptics behave differently on a device. It catches what unit tests
 * cannot — a screen that renders blank, throws, or overflows.
 *
 * Serves .web-preview/ (from `npm run export:web`) with an SPA fallback,
 * visits each route at phone width, fails on page errors or console errors,
 * and writes screenshots to .web-shots/.
 *
 * Run: npm run export:web && node scripts/web-screens.mjs
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(root, '.web-preview');
const SHOTS = path.join(root, '.web-shots');
if (!existsSync(BUILD)) {
  console.error('No web build. Run: npm run export:web');
  process.exit(2);
}
mkdirSync(SHOTS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.css': 'text/css' };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(BUILD, url);
  if (!file.startsWith(BUILD) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(BUILD, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const ROUTES = [
  ['home', '/'],
  ['shop', '/shop'],
  ['discover', '/discover'],
  ['saved', '/saved'],
  ['account', '/account'],
  ['product', '/product/p03'],
  ['story', '/story/s1'],
  ['bag', '/bag'],
  ['tracker', '/orders/DEMO-ORDER-0001'],
  ['orders', '/orders'],
  ['appointment', '/appointment'],
  ['notifications', '/notifications'],
  ['filters', '/filters'],
  ['size-guide', '/size-guide/tops'],
  ['market', '/market'],
];

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
}

const browser = await launch();
let failures = 0;
for (const [name, route] of ROUTES) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const blank = await page.evaluate(() => document.body.innerText.trim().length < 20);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  const ok = !errors.length && !blank && overflow <= 0;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${route}${errors.length ? ` — ${errors[0].slice(0, 160)}` : ''}${blank ? ' — blank' : ''}${overflow > 0 ? ` — overflows ${overflow}px` : ''}`);
  await context.close();
}

await browser.close();
server.close();
console.log(`\n${ROUTES.length - failures}/${ROUTES.length} routes rendered cleanly. Screenshots: .web-shots/`);
process.exit(failures ? 1 : 0);
