#!/usr/bin/env node
/**
 * Every gated screen, opened cold by somebody with no account.
 *
 * `audit:screens` signs in before it sweeps, and says why: "an account screen
 * swept in its signed-out state is not the screen anybody uses." True of the
 * screens, and it left a gap underneath. Nothing drove the app from a cold
 * start with empty storage — which is what a push notification, a shared link
 * and a browser bookmark all produce, and what every first-time visitor is.
 *
 * What that gap hid was not a broken screen. It was a **broken detector**.
 *
 * `lib/preconditions.mjs` decides whether a sweep is looking at a signed-out
 * app with one selector:
 *
 *     [data-testid="account-required"], [data-testid$="-signed-out"]
 *
 * and its comment claimed "a seventh screen is covered whichever convention it
 * picks". The seventh screen existed. Profile was the sign-in wall
 * `AccountRequired` was modelled on — the component's own doc says "Profile
 * had it right and the others had nothing" — and the round that built the
 * component gave it to the six screens with no gate and left the original
 * standing under `profile-guest`, which that selector does not match.
 *
 * So the component written to stop seven copies of a block shipped with one
 * copy left, it was the block it was copied from, and the detector that every
 * seeded sweep leans on could not see it. A sweep asserting `signedIn: true`
 * on that screen would have passed its own precondition and measured a
 * signed-out app: the one failure `lib/preconditions.mjs` exists to prevent.
 *
 * This opens every gated route with nothing in storage and asks the detector,
 * not the copy, whether the wall is there — the same selector the other sweeps
 * trust, used the way they use it. A route that answers no is either
 * ungated or spelled in a way nothing can find.
 *
 * The ungated routes are swept too, as the control: the menu, a product and
 * the sign-in screen must **not** report a wall, or the selector is matching
 * something that is not one and every green above it is worthless.
 *
 * Run: npm run audit:cold
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { SIGN_IN_WALL } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-cold');
const APP_PORT = 8351;
const BASE = `http://localhost:${APP_PORT}`;

const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

/**
 * The routes that hold account data, and the ones that do not.
 *
 * `gated: true` must show a sign-in wall the shared selector can find.
 * `gated: false` is the control and must show no wall at all — a selector that
 * fires on an ordinary screen would make every line above it meaningless.
 */
const ROUTES = [
  { route: '/orders', gated: true },
  { route: '/rewards', gated: true },
  { route: '/rewards/vouchers', gated: true },
  { route: '/account/notifications', gated: true },
  { route: '/account/payment-methods', gated: true },
  { route: '/account/profile', gated: true },
  { route: '/checkout/address', gated: true },
  { route: '/menu', gated: false },
  { route: '/product/golden-original', gated: false },
  { route: '/sign-in', gated: false },
  { route: '/offers', gated: false },
];

const TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.resolve(OUT, '.' + pathname);
    if (file !== OUT && !file.startsWith(OUT + path.sep)) file = path.join(OUT, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(APP_PORT, '127.0.0.1', () => resolve(server)));
}

const pinClock = (fixed) => `
  (() => {
    const Real = Date;
    const fixed = ${fixed};
    class Pinned extends Real {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() { return fixed; }
    }
    globalThis.Date = Pinned;
  })();
`;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
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
  for (const { route, gated } of ROUTES) {
    /*
      A fresh context per route, which is the point of the word "cold".

      Reusing one context would carry whatever the previous route left in
      storage, and the second route onwards would no longer be a first visit.
    */
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Johannesburg',
    });
    await context.addInitScript(pinClock(LUNCHTIME));

    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1800);

    const seen = await page.evaluate((selector) => {
      const wall = document.querySelector(selector);
      return {
        wall: wall === null ? null : (wall.getAttribute('data-testid') ?? 'account-required'),
        caught: document.querySelector('[data-testid="error-boundary"]') !== null,
        text: document.body.innerText.trim().length,
      };
    }, SIGN_IN_WALL);

    /*
      Storage really is empty, checked rather than assumed.

      A context that had somehow carried a session would make every gated route
      below look ungated, and the sweep would report seven findings about
      itself.
    */
    const leftovers = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith('bbq.auth')),
    );
    if (leftovers.length > 0) {
      findings.push(
        `${route}: opened with ${leftovers.join(', ')} already in storage, so this was not a ` +
          `cold start and its result means nothing.`,
      );
    }

    if (crashes.length > 0 || seen.caught) {
      findings.push(
        `${route}: crashed on a cold open — ${crashes[0] ?? 'caught by the error boundary'}`,
      );
    }
    if (seen.text < 20) {
      findings.push(`${route}: rendered almost no text at all on a cold open`);
    }
    if (gated && seen.wall === null) {
      findings.push(
        `${route}: needs an account and shows no sign-in wall the shared selector can find. ` +
          `Either it is not gated, or its wall is spelled in a way no sweep can detect.`,
      );
    }
    if (!gated && seen.wall !== null) {
      findings.push(
        `${route}: is an ordinary screen and reports a sign-in wall (${seen.wall}). The ` +
          `selector is matching something that is not one, so every line above is worthless.`,
      );
    }

    rows.push({
      route,
      gated,
      wall: seen.wall,
      ok: gated ? seen.wall !== null : seen.wall === null,
    });

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\nroute                        needs an account   wall found');
for (const row of rows) {
  console.log(
    `  ${row.ok ? '✓' : '✗'} ${row.route.padEnd(28)} ${(row.gated ? 'yes' : 'no').padEnd(16)} ` +
      `${row.wall ?? '—'}${row.gated ? '' : '   (control)'}`,
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) a cold visitor meets.`);
  process.exit(1);
}

console.log(
  `${ROUTES.length} routes opened cold, and every gate is one the sweeps can actually see.`,
);
