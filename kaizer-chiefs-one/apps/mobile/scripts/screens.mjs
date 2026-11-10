#!/usr/bin/env node
/**
 * Renders every route of the web export in Chromium at phone size and fails
 * on console errors, horizontal overflow or a blank screen. Saves a
 * screenshot per route to .screens/ (git-ignored).
 *
 *   npm run export:web -w @kc-one/mobile
 *   node apps/mobile/scripts/screens.mjs [--scale 2] [--out .screens]
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(here, '../dist/web');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const scale = Number(opt('scale', '1'));
const out = resolve(opt('out', resolve(here, '../../../.screens')));

if (!existsSync(join(dist, 'index.html'))) {
  console.error('No web export found. Run: npm run export:web -w @kc-one/mobile');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || path.endsWith('/'))
    file = join(dist, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const now = Date.now();
const session = {
  userId: 'demo-screens',
  displayName: 'Thandi',
  email: 'thandi@example.com',
  isDemo: true,
  issuedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 6 * 3600_000).toISOString(),
};
const persisted = (state) => JSON.stringify({ state, version: 0 });
const STATES = {
  fresh: {},
  guest: { 'kc1.onboarding': persisted({ completed: true, guest: true }) },
  member: {
    'kc1.onboarding': persisted({ completed: true, guest: false }),
    'kc1.session': persisted({ session }),
  },
};

const ROUTES = [
  ['01-welcome', '/welcome', 'fresh'],
  ['02-home', '/home', 'member'],
  ['03-match-fixtures', '/match', 'member'],
  ['04-match-squad', '/match?view=squad', 'member'],
  ['05-match-centre', '/match/demo-fx-1', 'member'],
  ['06-fan', '/fan', 'member'],
  ['07-fan-new', '/fan/new', 'member'],
  ['08-fan-moment', '/fan/demo-fm-1', 'member'],
  ['09-tickets', '/tickets', 'member'],
  ['10-ticket-detail', '/tickets/demo-ticket-1', 'member'],
  ['11-membership', '/membership', 'member'],
  ['12-rewards', '/rewards', 'member'],
  ['13-reward-detail', '/rewards/demo-rw-1', 'member'],
  ['14-shop', '/shop', 'member'],
  ['15-notifications', '/notifications', 'member'],
  ['16-profile', '/profile', 'member'],
  ['17-privacy', '/settings/privacy', 'member'],
  ['18-notification-prefs', '/settings/notifications', 'member'],
  ['19-article', '/news/demo-matchday-guide', 'member'],
  ['20-sign-in', '/sign-in', 'guest'],
  ['21-register', '/register', 'guest'],
  ['22-tickets-guest', '/tickets', 'guest'],
  ['23-profile-guest', '/profile', 'guest'],
  ['24-about', '/about', 'member'],
  ['25-community-rules', '/legal/community', 'member'],
  ['26-player', '/squad/demo-first-team-midfielder-1', 'member'],
  ['27-account', '/settings/account', 'member'],
  ['28-help', '/help', 'member'],
  ['29-saved', '/saved', 'member'],
  ['30-fan-mine', '/fan/mine', 'member'],
];

await mkdir(out, { recursive: true });
// A project-pinned Playwright may not match the machine's browser build; fall
// back to the system Chromium (CHROMIUM_PATH, or the CI image's default).
const browser = await chromium
  .launch()
  .catch(() =>
    chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }),
  );
const failures = [];
for (const width of [390, 320]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: scale,
    isMobile: true,
    hasTouch: true,
  });
  for (const [name, route, state] of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/`);
    await page.evaluate((entries) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
    }, STATES[state]);
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      text: document.body.innerText.trim().length,
    }));
    if (width === 390) {
      await page.screenshot({ path: join(out, `${name}.png`) });
      // Long screens: also capture further down the main scroll view.
      for (const [suffix, y] of [
        ['b', 760],
        ['c', 1520],
      ]) {
        const moved = await page.evaluate((top) => {
          const el = [...document.querySelectorAll('div')].find(
            (d) =>
              d.scrollHeight > d.clientHeight + 40 &&
              /(auto|scroll)/.test(getComputedStyle(d).overflowY),
          );
          if (!el || el.scrollHeight - el.clientHeight < top - 300) return false;
          el.scrollTo(0, top);
          return true;
        }, y);
        if (!moved) break;
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(out, `${name}-${suffix}.png`) });
      }
    }
    const problems = [];
    if (errors.length) problems.push(`console: ${errors.slice(0, 2).join(' | ')}`);
    if (m.overflow > 1) problems.push(`horizontal overflow ${m.overflow}px`);
    if (m.text < 20) problems.push('blank screen');
    const status = problems.length ? 'FAIL' : 'ok  ';
    console.log(
      `${status} ${width}pt ${name.padEnd(24)} ${route}${problems.length ? `  ${problems.join('; ')}` : ''}`,
    );
    if (problems.length) failures.push(`${width}pt ${name}: ${problems.join('; ')}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(
  `\n${ROUTES.length * 2 - failures.length}/${ROUTES.length * 2} passed. Screenshots in ${out}`,
);
process.exit(failures.length ? 1 : 0);
