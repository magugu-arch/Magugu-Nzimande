/**
 * Renders every route of the web export in Chromium and fails on what unit
 * tests cannot see: console errors, horizontal overflow, blank screens and
 * buttons without an accessible name. Screenshots land in .shots/.
 *
 *   npm run export:web && npm run shots
 *   npm run shots -- --only=/home,/book     (a subset)
 *
 * Signed-in routes are visited after signing in as the demo guest through
 * the real sign-in screen; staff routes as the demo admin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { root, signIn as signInAs, startWeb } from './lib/web.mjs';

const out = path.join(root, '.shots');
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const widths = [390, 320];
fs.mkdirSync(out, { recursive: true });

const { base, browser, stop } = await startWeb();

const PUBLIC = [
  '/home',
  '/discover',
  '/book',
  '/events',
  '/profile',
  '/menu',
  '/menu?section=wine',
  '/dish/sig-fillet',
  '/wine/wine-rubicon',
  '/collection/col-fire',
  '/gallery',
  '/events/evt-meerlust-2026-10-27',
  '/visit',
  '/support',
  '/private-functions',
  '/sign-in',
  '/vouchers/new',
  '/legal/privacy',
  '/legal/terms',
  '/legal/marketing',
  '/dish/steak-sirloin',
];
const GUEST = [
  '/profile',
  '/profile/bookings',
  '/profile/vouchers',
  '/profile/favourites',
  '/profile/details',
  '/rewards',
  '/rewards/rw-amuse',
  '/notifications',
  '/notifications/preferences',
  '/events/evt-meerlust-2026-10-27/book',
];
const ADMIN = [
  '/admin',
  '/admin/reservations',
  '/admin/policy',
  '/admin/rewards',
  '/admin/templates',
  '/admin/campaigns',
  '/admin/vouchers',
  '/admin/menu',
  '/admin/events',
  '/admin/messages',
  '/admin/guests',
  '/admin/payments',
  '/admin/audit',
];

const failures = [];

async function sweep(routes, label, email) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    if (email) await signInAs(page, base, email);
    for (const route of routes) {
      if (only && !only.includes(route)) continue;
      errors.length = 0;
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
      const check = await page.evaluate(() => {
        const doc = document.documentElement;
        const text = document.body.innerText.trim();
        const unnamed = [...document.querySelectorAll('[role="button"]')].filter(
          (b) => !(b.getAttribute('aria-label') || b.textContent?.trim()),
        ).length;
        return { overflow: doc.scrollWidth - window.innerWidth, textLength: text.length, unnamed };
      });
      const name = `${label}-${width}${route.replace(/[/?=&]/g, '_')}.png`;
      await page.screenshot({ path: path.join(out, name) });
      const problems = [];
      if (check.overflow > 1) problems.push(`overflows by ${check.overflow}px`);
      if (check.textLength < 20) problems.push('renders blank');
      if (check.unnamed) problems.push(`${check.unnamed} unnamed buttons`);
      if (errors.length) problems.push(`console: ${errors.slice(0, 3).join(' | ')}`);
      console.log(
        `${problems.length ? '✗' : '✓'} ${label} ${width}pt ${route}${problems.length ? ` — ${problems.join('; ')}` : ''}`,
      );
      if (problems.length) failures.push({ route, width, label, problems });
    }
    await context.close();
  }
}

await sweep(PUBLIC, 'public');
await sweep(GUEST, 'guest', 'demo@mabu.app');
await sweep(ADMIN, 'admin', 'admin@mabu.demo');
await stop();

console.log(
  `\n${failures.length ? `${failures.length} problem(s)` : 'All screens clean'}. Screenshots in .shots/`,
);
process.exit(failures.length ? 1 : 0);
