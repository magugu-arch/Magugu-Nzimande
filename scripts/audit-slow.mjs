#!/usr/bin/env node
/**
 * A connection that is not gone, only slow.
 *
 * Every sweep about the network in this repository cuts it dead. `audit:offline`
 * kills the host, `audit:writes` drops the socket, `audit:wire` answers wrongly
 * but instantly. None of them is the ordinary South African Tuesday: a cell
 * that is congested rather than absent, where every request arrives — eventually.
 *
 * The client gives a request 15 seconds and aborts it. The query client then
 * retries a timeout twice, each on a fresh 15-second budget. So a connection
 * that would have delivered in eighteen seconds produces:
 *
 *   three full requests, three payloads, forty-five seconds of spinner, and an
 *   error — for a connection that works.
 *
 * Retrying a timeout on the same budget is asking the same question the same
 * way and expecting a different answer. It cannot succeed, it costs the
 * customer their data three times over, and on a metered South African
 * prepaid bundle that is money.
 *
 * So this measures, at four speeds, what the customer actually gets:
 *
 *   fast          the control — one request, and the screen fills
 *   slow, inside  8s: one request, and the screen fills. A slow connection
 *                 that works must not be retried.
 *   slow, outside 18s: what a customer on a bad cell actually meets
 *   hopeless      never answers at all
 *
 * Run: npm run audit:slow
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-slow');
const APP_PORT = 8301;
const API_PORT = 8302;
const BASE = `http://localhost:${APP_PORT}`;

const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

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

function serveApp() {
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

/* -------------------------------------------------------------------------- */

const ORDER = {
  id: 'order-slow',
  reference: 'BBQ-5150',
  status: 'preparing',
  fulfilmentType: 'delivery',
  placedAt: new Date(LUNCHTIME - 10 * 60_000).toISOString(),
  etaMinutes: 40,
  storeId: 'store-slow',
  storeName: 'bb.q Chicken Rosebank',
  lines: [
    {
      id: 'line-slow',
      productId: 'golden-original',
      name: 'Golden Original Chicken',
      quantity: 1,
      unitPrice: 149,
      lineTotal: 149,
      selectedOptions: [],
    },
  ],
  totals: {
    subtotal: 149,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 186,
  },
  timeline: [],
  paymentMethodLabel: 'Visa ending 4821',
};

const BASE_BODIES = {
  '/v1/menu': { categories: [], products: [] },
  '/v1/loyalty/rewards': [],
  '/v1/loyalty/tiers': [],
  '/v1/loyalty/account': { memberId: 'm', pointsBalance: 0, history: [] },
  '/v1/loyalty/vouchers': [],
  '/v1/promotions': [],
  '/v1/stores': [],
  '/v1/orders': [],
  '/v1/account/addresses': [],
  '/v1/account/payment-methods': [],
  '/v1/account/favourites': [],
  '/v1/account/notifications': [],
};

/** The one path under test: how slowly it answers, and how often it was asked. */
const WATCHED = '/v1/orders/order-slow';
let latencyMs = 0;
let asked = 0;
/** Held open so a hopeless case is slow rather than refused. */
const pending = new Set();

function serveApi() {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;

    const cors = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Date',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
      });
      res.end();
      return;
    }

    req.resume();

    if (pathname === WATCHED) {
      asked += 1;
      if (latencyMs === Number.POSITIVE_INFINITY) {
        // Never answered, never refused — which is what a dead cell looks like
        // to a socket that is still open.
        pending.add(res);
        return;
      }
      setTimeout(() => {
        res.writeHead(200, cors);
        res.end(JSON.stringify(ORDER));
      }, latencyMs);
      return;
    }

    const exact = Object.hasOwn(BASE_BODIES, pathname) ? BASE_BODIES[pathname] : undefined;
    const body =
      exact ?? Object.entries(BASE_BODIES).find(([route]) => pathname.startsWith(route))?.[1] ?? [];

    res.writeHead(200, cors);
    res.end(JSON.stringify(body));
  });
  return new Promise((resolve) => server.listen(API_PORT, '127.0.0.1', () => resolve(server)));
}

/* -------------------------------------------------------------------------- */

const SIGNED_IN = JSON.stringify({
  state: {
    user: {
      id: 'user-slow',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'slow@example.co.za',
      phone: '+27821234567',
      avatarInitials: 'TM',
      isGuest: false,
      emailVerified: true,
      phoneVerified: true,
      createdAt: '2026-01-18T00:00:00.000Z',
    },
    isAuthenticated: true,
    isGuest: false,
    hasCompletedOnboarding: true,
    notificationPreferences: {
      orderUpdates: true,
      promotions: true,
      rewards: true,
      newProducts: false,
      channelPush: true,
      channelEmail: true,
      channelSms: false,
    },
    preferences: { defaultFulfilment: 'delivery', marketingConsent: false, preferMildFirst: false },
  },
  version: PERSIST_VERSION,
});

assertSeeds({ 'bbq.auth': SIGNED_IN });

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

const ROUTE = '/order/order-slow';

/** What the screen shows once the order has arrived. */
const ARRIVED = /BBQ-5150/;

const CASES = [
  {
    name: 'a fast connection',
    latency: 200,
    asked: 1,
    arrives: true,
    control: true,
  },
  {
    name: 'slow, but inside the budget (8s)',
    latency: 8_000,
    asked: 1,
    arrives: true,
    why: 'a slow connection that works must not be asked again',
  },
  {
    name: 'slow, just outside the budget (18s)',
    latency: 18_000,
    /*
      One request, and the customer gets their order.

      Three attempts at fifteen seconds is strictly worse for this customer
      than one attempt at a longer budget: the same wait, three times the data,
      and it fails for every connection between 15 and 45 seconds — which is
      the band a congested cell actually sits in.
    */
    asked: 1,
    arrives: true,
    why: 'three attempts on the same budget cannot succeed where one did not',
  },
  {
    name: 'a connection that never answers',
    latency: Number.POSITIVE_INFINITY,
    asked: 1,
    arrives: false,
    why: 'the app has to give up, and once is enough to know',
    /*
      Watched for less than one poll past the budget, and that is a correction
      rather than a convenience.

      The first version watched for sixty seconds and reported two requests as
      a finding. The second one is the tracking screen's own fifteen-second
      poll, which fires again once the aborted attempt is out of the way — and
      a live-tracking screen that stopped asking would be the defect, not this.
      So the window ends before the poll can legitimately fire, and what is
      measured is the one thing this sweep is about: how many times a *single*
      attempt becomes.
    */
    watchMs: 34_000,
  },
];

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building with the mock layer off, pointed at a stub that dawdles…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {
    ...process.env,
    EXPO_PUBLIC_USE_MOCK_API: '0',
    EXPO_PUBLIC_API_BASE_URL: `http://localhost:${API_PORT}`,
  },
});

const appServer = await serveApp();
const apiServer = await serveApi();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const findings = [];
const rows = [];

/** Long enough for three attempts at the old budget, plus their backoff. */
const WATCH_MS = 60_000;

try {
  for (const testCase of CASES) {
    latencyMs = testCase.latency;
    asked = 0;

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Johannesburg',
    });
    await context.addInitScript(pinClock(LUNCHTIME));
    await context.addInitScript((session) => {
      try {
        window.localStorage.setItem('bbq.auth', session);
        window.localStorage.setItem('bbq.auth.accessToken', 'at_slow');
        window.localStorage.setItem('bbq.auth.refreshToken', 'rt_slow');
      } catch {
        // A context that refuses storage is a browser problem, not an app one.
      }
    }, SIGNED_IN);

    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

    /*
      `domcontentloaded`, not `networkidle`: a case whose whole point is a
      request that never settles would never reach network idle, and the goto
      would time out before anything was measured.
    */
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const startedAt = Date.now();
    const watchMs = testCase.watchMs ?? WATCH_MS;
    let arrivedAfterMs = null;
    while (Date.now() - startedAt < watchMs) {
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (ARRIVED.test(text)) {
        arrivedAfterMs = Date.now() - startedAt;
        break;
      }
      await page.waitForTimeout(500);
    }

    const wrongState = await preconditionFailures(page, {
      where: testCase.name,
      signedIn: true,
    });
    for (const failure of wrongState) findings.push(failure);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const caught = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="error-boundary"]')),
    );
    const arrived = arrivedAfterMs !== null;

    if (crashes.length > 0 || caught) {
      findings.push(
        `${testCase.name}: crashed the screen — ${crashes[0] ?? 'caught by the error boundary'}`,
      );
    }
    if (asked !== testCase.asked) {
      findings.push(
        `${testCase.name}: asked ${asked} time(s), should be ${testCase.asked}` +
          (testCase.why ? ` — ${testCase.why}` : ''),
      );
    }
    if (arrived !== testCase.arrives) {
      findings.push(
        testCase.arrives
          ? `${testCase.name}: the order never arrived on screen. Reads: ${text.slice(0, 140)}`
          : `${testCase.name}: showed an order the stub never sent`,
      );
    }

    rows.push({
      name: testCase.name,
      asked,
      want: testCase.asked,
      arrived,
      after: arrivedAfterMs,
      control: testCase.control === true,
      ok:
        asked === testCase.asked && arrived === testCase.arrives && crashes.length === 0 && !caught,
    });

    for (const held of pending) held.destroy();
    pending.clear();
    await context.close();
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log('\ncase                                        asked  wanted  arrived');
for (const row of rows) {
  const when = row.after === null ? '—' : `${(row.after / 1000).toFixed(1)}s`;
  console.log(
    `  ${row.ok ? '✓' : '✗'} ${row.name.padEnd(40)} ${String(row.asked).padStart(3)}` +
      `   ${String(row.want).padStart(3)}    ${when.padStart(6)}${row.control ? '  (control)' : ''}`,
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) wrong on a connection that is only slow.`);
  process.exit(1);
}

console.log(`${CASES.length} connection speeds, and the app asked once and waited.`);
