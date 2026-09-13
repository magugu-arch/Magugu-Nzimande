#!/usr/bin/env node
/**
 * The app nobody is looking at.
 *
 * Two queries in this app poll: live order tracking every 15 seconds, and the
 * active-order banner every 30. On a phone that is battery and prepaid data,
 * and `useAppFocus` exists because of it — it was written after the app was
 * found refetching both "while backgrounded, on the customer's mobile data,
 * indefinitely".
 *
 * That fix wired React Native's `AppState` to TanStack's focus manager, and it
 * is guarded by a platform check with a claim attached:
 *
 *     // On web the focus manager already listens for visibilitychange itself,
 *     // and AppState never reports anything but 'active'.
 *     if (Platform.OS === 'web') return;
 *
 * The first half of that sentence is an assertion about a third-party library's
 * behaviour, in the one build where nothing had ever tested it — and the web
 * build is every preview, every demo and every desktop customer. If it is
 * wrong, the defect the hook was written to fix is still live on web, and the
 * hook's own comment is the reason nobody looked.
 *
 * So this counts. A stub backend records every request for one order while the
 * tab is watched, hidden, and watched again:
 *
 *   watched   the poll runs — several requests, or the sweep is not measuring
 *             a polling screen at all
 *   hidden    none. A tab nobody is looking at should cost nothing.
 *   watched   it comes back, or the app is quiet until a reload
 *
 * The middle phase is the finding. The two either side are what make it one:
 * a screen that never polled would report zero while hidden and prove nothing,
 * and a poll that never resumed would be a different bug shipped as a fix.
 *
 * ── How the tab is hidden, and what that is worth ──
 *
 * Not by bringing another tab to the front. That was tried first, headless and
 * again headed under a virtual display, and neither moved `visibilityState` a
 * millimetre: Playwright opens each page in its own window, so nothing ever
 * occludes anything. The sweep's own precondition caught it and refused to
 * report, which is the only reason this note is accurate rather than hopeful.
 *
 * So the sweep supplies the signal the browser would supply. `visibilityState`
 * and `document.hidden` are overridden and a real `visibilitychange` event is
 * dispatched — which is the entire interface the platform gives a page for
 * this. TanStack's focus manager listens for exactly that event and reads
 * exactly those properties, so the app cannot tell the difference, and the
 * thing under test — whether the poll stops — is measured for real against a
 * real stub backend.
 *
 * What is stipulated rather than proven is one step further out: that a browser
 * fires `visibilitychange` and reports `hidden` when a tab goes to the back.
 * That is specified behaviour, and it is not verified here. If it ever stopped
 * being true, this sweep would not notice.
 *
 * Run: npm run audit:away
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-away');
const APP_PORT = 8341;
const API_PORT = 8342;
const BASE = `http://localhost:${APP_PORT}`;

const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

/**
 * How long each phase watches.
 *
 * The tracking poll is 15 seconds, so 40 gives two clear opportunities with
 * room for one to land late. Shorter than that and a zero would be ambiguous
 * between "it stopped" and "it had not come round yet", which is the whole
 * measurement.
 */
const PHASE_MS = 40_000;

const ORDER_ID = 'order-away';

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

/**
 * An order that is on its way and will stay that way.
 *
 * `useOrder` stops polling by itself once the status reaches `completed` or
 * `cancelled`, which is correct and would quietly end this measurement. An
 * order stuck on `out_for_delivery` keeps the poll running for as long as the
 * sweep needs it.
 */
const ORDER = {
  id: ORDER_ID,
  reference: 'BBQ-AWAY',
  placedAt: new Date(LUNCHTIME - 20 * 60_000).toISOString(),
  fulfilmentType: 'delivery',
  status: 'out_for_delivery',
  etaMinutes: 12,
  lines: [
    {
      id: 'golden-original',
      productId: 'golden-original',
      name: 'Golden Original Chicken',
      assetKey: 'goldenOriginal',
      quantity: 1,
      selectedOptions: [],
      unitBasePrice: 149,
      unitPrice: 149,
      lineTotal: 149,
    },
  ],
  totals: {
    subtotal: 149,
    deliveryFee: 0,
    serviceFee: 0,
    discount: 0,
    rewardsDiscount: 0,
    total: 149,
  },
  timeline: [
    { status: 'received', label: 'Order received', occurredAt: new Date(LUNCHTIME - 18 * 60_000).toISOString() },
    { status: 'preparing', label: 'In the kitchen', occurredAt: new Date(LUNCHTIME - 14 * 60_000).toISOString() },
    { status: 'out_for_delivery', label: 'On the way', occurredAt: new Date(LUNCHTIME - 6 * 60_000).toISOString() },
    { status: 'completed', label: 'Delivered', occurredAt: null },
  ],
};

const BASE_BODIES = {
  '/v1/menu': { categories: [], products: [] },
  '/v1/loyalty/rewards': [],
  '/v1/loyalty/tiers': [{ tier: 'bronze', name: 'Bronze', threshold: 0, pointsPerRand: 1, perks: [] }],
  '/v1/loyalty/account': { memberId: 'm', pointsBalance: 0, history: [] },
  '/v1/loyalty/vouchers': [],
  '/v1/promotions': [],
  '/v1/stores': [],
  '/v1/account/addresses': [],
  '/v1/account/payment-methods': [],
  '/v1/account/favourites': [],
  '/v1/account/notifications': [],
};

/** Every request for the tracked order, by the phase it arrived in. */
let phase = 'setup';
const asked = { setup: 0, watched: 0, hidden: 0, again: 0 };
const WATCHED_PATH = `/v1/orders/${ORDER_ID}`;

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

    if (pathname === WATCHED_PATH) {
      asked[phase] += 1;
      res.writeHead(200, cors);
      res.end(JSON.stringify(ORDER));
      return;
    }

    // Exact before prefix — a lesson this repository has learned five times.
    const exact = Object.hasOwn(BASE_BODIES, pathname) ? BASE_BODIES[pathname] : undefined;
    const body =
      exact ?? Object.entries(BASE_BODIES).find(([route]) => pathname.startsWith(route))?.[1] ?? [];

    if (pathname === '/v1/orders/active' || pathname === '/v1/orders') {
      res.writeHead(200, cors);
      res.end(JSON.stringify(pathname === '/v1/orders' ? [ORDER] : ORDER));
      return;
    }

    res.writeHead(200, cors);
    res.end(JSON.stringify(body));
  });
  return new Promise((resolve) => server.listen(API_PORT, '127.0.0.1', () => resolve(server)));
}

/* -------------------------------------------------------------------------- */

const SIGNED_IN = JSON.stringify({
  state: {
    user: {
      id: 'user-away',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'away@example.co.za',
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

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building with the mock layer off, pointed at a stub that counts…');
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

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await context.addInitScript(pinClock(LUNCHTIME));
  /*
    The browser's own visibility interface, made drivable.

    `configurable: true` so the override can be defined over the native getter,
    and the event is a real `Event` dispatched on `document` — the same object,
    the same type, the same order a browser uses.
  */
  await context.addInitScript(() => {
    let state = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      get: () => state,
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', {
      get: () => state === 'hidden',
      configurable: true,
    });
    Object.assign(window, {
      __setVisibility(next) {
        state = next;
        document.dispatchEvent(new Event('visibilitychange'));
      },
    });
  });
  await context.addInitScript((session) => {
    try {
      window.localStorage.setItem('bbq.auth', session);
      window.localStorage.setItem('bbq.auth.accessToken', 'at_away');
      window.localStorage.setItem('bbq.auth.refreshToken', 'rt_away');
    } catch {
      // A context that refuses storage is a browser problem, not an app one.
    }
  }, SIGNED_IN);

  const page = await context.newPage();
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

  await page.goto(`${BASE}/order/${ORDER_ID}`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  await page.waitForTimeout(2500);

  const wrongState = await preconditionFailures(page, {
    where: 'the tracking screen',
    signedIn: true,
  });
  for (const failure of wrongState) findings.push(failure);

  const visibility = () => page.evaluate(() => document.visibilityState);

  // --- watched ------------------------------------------------------------

  if ((await visibility()) !== 'visible') {
    console.error('The tracking tab is not visible at the start; this sweep cannot measure.');
    process.exit(2);
  }
  phase = 'watched';
  await page.waitForTimeout(PHASE_MS);

  // --- hidden -------------------------------------------------------------

  phase = 'hidden';
  await page.evaluate(() => window.__setVisibility('hidden'));
  await page.waitForTimeout(1200);

  /*
    The precondition this sweep cannot do without.

    Every number below means the opposite of what it looks like if the tab did
    not actually go hidden: zero requests would read as "the poll stopped" when
    it would really be "nothing changed and the poll happened to be between
    ticks". Headless browsers do not always honour a front/back switch, so this
    is checked rather than assumed, and the sweep stops rather than report.
  */
  const hiddenState = await visibility();
  if (hiddenState !== 'hidden') {
    console.error(
      `This sweep could not hide the tab — it reports '${hiddenState}'. Nothing below ` +
        `would mean anything, so nothing is reported.`,
    );
    process.exit(2);
  }

  await page.waitForTimeout(PHASE_MS);

  // --- watched again ------------------------------------------------------

  phase = 'again';
  await page.evaluate(() => window.__setVisibility('visible'));
  await page.waitForTimeout(1200);
  if ((await visibility()) !== 'visible') {
    console.error('The tracking tab did not come back to the front; the last phase is void.');
    process.exit(2);
  }
  await page.waitForTimeout(PHASE_MS);

  if (crashes.length > 0) findings.push(`the tracking screen crashed — ${crashes[0]}`);

  // --- what it means ------------------------------------------------------

  if (asked.watched === 0) {
    findings.push(
      'the tracking screen made no requests at all while it was being watched, so this ' +
        'sweep was not measuring a polling screen. Every count below is meaningless.',
    );
  }
  if (asked.hidden > 0) {
    findings.push(
      `the app polled ${asked.hidden} time(s) while nobody was looking at it — on a phone ` +
        `that is battery and data spent on a screen the customer cannot see.`,
    );
  }
  if (asked.watched > 0 && asked.again === 0) {
    findings.push(
      'the poll never came back after the customer returned to the tab, so live tracking ' +
        'is dead until they reload.',
    );
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

const secs = PHASE_MS / 1000;
console.log(`\nphase                       requests in ${secs}s   expected`);
console.log(`  ${asked.watched > 0 ? '✓' : '✗'} watched                  ${String(asked.watched).padStart(4)}       2 or more`);
console.log(`  ${asked.hidden === 0 ? '✓' : '✗'} hidden behind another tab ${String(asked.hidden).padStart(3)}       none`);
console.log(`  ${asked.again > 0 ? '✓' : '✗'} watched again            ${String(asked.again).padStart(4)}       2 or more`);

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) the app does when nobody is looking.`);
  process.exit(1);
}

console.log('The app polls while it is watched, stops when it is not, and starts again.');
