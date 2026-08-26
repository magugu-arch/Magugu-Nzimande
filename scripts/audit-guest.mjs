#!/usr/bin/env node
/**
 * Look around the app as somebody who tapped "Continue as guest".
 *
 * The app offers that on the sign-in screen and then took them to screens
 * built entirely out of account data. Only Profile ever checked. Driven as a
 * guest against the mock — which is what a demo build runs on:
 *
 *     /rewards                  BBQ-SA-004182 | 1 840 points | Silver member
 *     /checkout/address         Home | 14 Acacia Road, Unit 3 | Melrose Arch…
 *     /account/payment-methods  Visa ending 4821 | Mastercard ending 7702
 *
 * A stranger's home address and card last-fours, shown to somebody with no
 * account at all. Against a real API those calls 401 instead, so the data
 * itself is a mock artefact — but the missing gate is not, and the demo is
 * where anybody would first see it.
 *
 * Two things are checked on every route: that none of the seeded customer's
 * details appear, and that the screen offers a way in rather than an error.
 * The first alone would pass on a screen that merely failed to load.
 *
 * Run: npm run audit:guest
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-guest');
const PORT = 8201;
const BASE = `http://localhost:${PORT}`;

/** Screens whose contents belong to an account. */
const ROUTES = [
  '/orders',
  '/rewards',
  '/rewards/vouchers',
  '/checkout/address',
  '/account/payment-methods',
  '/account/notifications',
  '/account/profile',
];

/**
 * Details of the seeded customer. None of these belongs on a guest's screen,
 * and each is the kind of thing that is unmistakable when it appears.
 */
const SOMEBODY_ELSES = [
  [/BBQ-SA-\d+/, 'a membership number'],
  [/Acacia Road|Alice Lane/i, 'a home or work address'],
  [/ending \d{4}/i, 'a card'],
  [/Silver member|Gold member|lifetime/i, 'a points balance and tier'],
  [/thandi@/i, 'an email address'],
];

/** Copy that offers a way in rather than an error or a blank. */
const INVITES = /Sign in/i;

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

const findings = [];
const rows = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('[data-testid="sign-in-guest"]').first().click({ timeout: 15000 });
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.getByText('Not now', { exact: false }).first().click({ timeout: 5000 }).catch(() => {});

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const leaks = SOMEBODY_ELSES.filter(([pattern]) => pattern.test(text)).map(([, what]) => what);
    const invites = INVITES.test(text);

    rows.push({ route, leaks, invites });
    for (const what of leaks) findings.push(`${route}: shows ${what} belonging to somebody else`);
    if (leaks.length === 0 && !invites) {
      findings.push(`${route}: offers a guest no way to sign in — only whatever it failed with`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\nroute                          asks a guest to sign in');
for (const row of rows) {
  const mark = row.leaks.length === 0 && row.invites ? '✓' : '✗';
  console.log(`  ${mark} ${row.route.padEnd(28)} ${row.leaks.join(', ')}`);
}

console.log('');
if (findings.length > 0) {
  console.log(`${findings.length} problem(s) on a guest's screens:\n`);
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(
    '\nSomebody who has not signed in has no account, so there is nothing of\n' +
      'theirs to show. Anything on these screens belongs to whoever was seeded.',
  );
  process.exit(1);
}
console.log("A guest is asked to sign in, and shown nobody else's details.");
process.exit(0);
