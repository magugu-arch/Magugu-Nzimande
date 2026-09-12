#!/usr/bin/env node
/**
 * The backend that sends exactly what it promised.
 *
 * `wireChecks.ts` is the contract this app enforces at the boundary, and its
 * opening paragraph says what it deliberately is not: a schema. It checks "the
 * numbers it does arithmetic on, the ids it looks things up by" and nothing
 * else, on the argument that a value the app only prints cannot do arithmetic
 * wrong. That argument is sound and it has a gap — a value the app only prints
 * can still be *absent*, and a screen that maps over an absent list does not
 * print nothing, it throws.
 *
 * Found by accident. `audit:double-tap` needed a reward, wrote one with the
 * fields its own check demands, and the reward screen rendered "Something
 * broke" — because nothing had sent `termsAndConditions`. Three more had the
 * same shape, including both of order tracking's.
 *
 * Accident is not a method. This is the method: serve every endpoint the
 * *minimum* body `wireChecks` accepts — every field it demands, not one more —
 * and render every screen against it. What crashes is what the app assumes
 * beyond the contract it actually enforces.
 *
 * The rule being measured is this repository's own, and it is not "the app
 * must work with no data":
 *
 *     a missing field is a gap in the data; a crash screen is a claim about
 *     the app.
 *
 * So a screen may show an empty state, a dash, a partial card. It may not show
 * "Something broke". Anything a customer cannot get past is a finding; a thin
 * screen is not.
 *
 * Run: npm run audit:sparse
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-sparse');
const APP_PORT = 8271;
const API_PORT = 8272;
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

/*
  Every body below carries exactly the fields `wireChecks` demands of it and
  not one more. They are written next to the check they satisfy so a reader can
  hold the two side by side — and so that a future field added to a check has
  an obvious place to appear here.

  The ids are the exception: a route like `/order/order-sparse` looks its
  subject up by id, so the id has to match the URL or the screen is testing
  "not found" instead. That is the same concession `wireChecks` itself makes —
  ids are one of the two things it checks.
*/

/** `checkProduct`: id, name, basePrice. */
const PRODUCT = { id: 'golden-original', name: 'Golden Original Chicken', basePrice: 149 };

/** `checkedMenu`: a record with a products list, each checked as above. */
const MENU = { products: [PRODUCT] };

/** `checkOrder`: id, the five totals, etaMinutes. */
const ORDER = {
  id: 'order-sparse',
  etaMinutes: 40,
  totals: { subtotal: 149, deliveryFee: 32, serviceFee: 5, discount: 0, total: 186 },
};

/** `checkStore`: id, name, latitude, longitude, deliveryRadiusKm. */
const STORE = {
  id: 'store-sparse',
  name: 'bb.q Chicken Sparse Street',
  latitude: -26.1446,
  longitude: 28.0417,
  deliveryRadiusKm: 10,
};

/** `checkedLoyaltyAccount`: pointsBalance. */
const LOYALTY = { pointsBalance: 9000 };

/** `checkReward`: id, pointsCost, discountValue. */
const REWARD = { id: 'reward-sparse', pointsCost: 400, discountValue: 20 };

/** `checkedTiers`: name, threshold, pointsPerRand. */
const TIER = { name: 'Bronze', threshold: 0, pointsPerRand: 1 };

/** `checkVoucher`: code, discountValue, minimumSpend. */
const VOUCHER = { code: 'SPARSE20', discountValue: 20, minimumSpend: 100 };

/** `checkedPromotions`: id, validFrom, validUntil. */
const PROMOTION = {
  id: 'promo-sparse',
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2027-01-01T00:00:00.000Z',
};

/** `checkedAddresses`: id, line1. */
const ADDRESS = { id: 'address-sparse', line1: '14 Acacia Road' };

/** `checkedPaymentMethods`: id, label. */
const CARD = { id: 'payment-sparse', label: 'Visa ending 4821' };

/** `checkedNotifications`: id, receivedAt. */
const NOTIFICATION = { id: 'notification-sparse', receivedAt: '2026-09-09T08:00:00.000Z' };

/** `checkedSupportTopics`: id. */
const TOPIC = { id: 'topic-sparse' };

const BODIES = {
  '/v1/menu': MENU,
  '/v1/orders': [ORDER],
  '/v1/orders/order-sparse': ORDER,
  '/v1/stores': [STORE],
  '/v1/loyalty/account': LOYALTY,
  '/v1/loyalty/rewards': [REWARD],
  '/v1/loyalty/tiers': [TIER],
  '/v1/loyalty/vouchers': [VOUCHER],
  '/v1/promotions': [PROMOTION],
  '/v1/account/addresses': [ADDRESS],
  '/v1/account/payment-methods': [CARD],
  '/v1/account/notifications': [NOTIFICATION],
  '/v1/account/favourites': ['golden-original'],
  '/v1/support/topics': [TOPIC],
};

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

    // Exact before prefix: a prefix match alone answers a single-resource read
    // with the collection, which is a different shape and a different bug.
    const exact = Object.hasOwn(BODIES, pathname) ? BODIES[pathname] : undefined;
    const body =
      exact ?? Object.entries(BODIES).find(([route]) => pathname.startsWith(route))?.[1] ?? [];

    req.resume();
    res.writeHead(200, cors);
    res.end(JSON.stringify(body));
  });
  return new Promise((resolve) => server.listen(API_PORT, '127.0.0.1', () => resolve(server)));
}

/* -------------------------------------------------------------------------- */

const SIGNED_IN = JSON.stringify({
  state: {
    user: {
      id: 'user-sparse',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'sparse@example.co.za',
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

const BASKET = JSON.stringify({
  state: {
    lines: [
      {
        id: 'golden-original__sparse',
        productId: 'golden-original',
        name: 'Golden Original Chicken',
        assetKey: 'goldenOriginal',
        unitBasePrice: 149,
        quantity: 1,
        selectedOptions: [],
        unitPrice: 149,
        lineTotal: 149,
      },
    ],
    fulfilmentType: 'delivery',
  },
  version: PERSIST_VERSION,
});

assertSeeds({ 'bbq.auth': SIGNED_IN, 'bbq.cart': BASKET });

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

/**
 * Every screen that renders something the server sent.
 *
 * The detail routes name the ids the stub serves, because a screen looking up
 * an id nothing answers for is testing "not found" — which is a real state and
 * is not this one.
 */
const ROUTES = [
  '/home',
  '/menu',
  '/product/golden-original',
  '/offers',
  '/offers/promo-sparse',
  '/cart',
  '/checkout',
  '/checkout/store',
  '/checkout/address',
  '/checkout/schedule',
  '/orders',
  '/order/order-sparse',
  '/order/order-sparse/confirmation',
  '/order/order-sparse/rate',
  '/rewards',
  '/rewards/reward-sparse',
  '/rewards/vouchers',
  '/account/payment-methods',
  '/account/notifications',
  '/account/profile',
  '/account/help',
  '/account/contact',
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

console.log('Building with the mock layer off, pointed at a stub that sends the minimum…');
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

/** The app's own crash screen, which is never an acceptable answer here. */
const CRASHED = /Something broke/i;

const findings = [];
const rows = [];

try {
  for (const route of ROUTES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Johannesburg',
    });
    await context.addInitScript(pinClock(LUNCHTIME));
    await context.addInitScript(
      (session) => {
        try {
          window.localStorage.setItem('bbq.auth', session.auth);
          window.localStorage.setItem('bbq.auth.accessToken', 'at_sparse');
          window.localStorage.setItem('bbq.auth.refreshToken', 'rt_sparse');
          window.localStorage.setItem('bbq.cart', session.cart);
        } catch {
          // A context that refuses storage is a browser problem, not an app one.
        }
      },
      { auth: SIGNED_IN, cart: BASKET },
    );

    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));
    /*
      Console errors as well as uncaught ones, because the error boundary is
      the thing being triggered: React logs the render throw and then the
      boundary catches it, so nothing ever reaches `pageerror`. The first run
      of this reported five crashed screens and could not say why any of them
      crashed — a finding with no cause in it is a bug report nobody can act
      on, including me.
    */
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const said = message.text();
      if (said.includes('Failed to load resource')) return;
      crashes.push(said.slice(0, 200));
    });

    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(4000);

    const wrongState = await preconditionFailures(page, {
      where: route,
      signedIn: true,
      seeded: ['bbq.cart'],
    });
    for (const failure of wrongState) findings.push(failure);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const caught = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="error-boundary"]')),
    );

    const broke = crashes.length > 0 || caught || CRASHED.test(text);

    if (broke) {
      findings.push(
        `${route}: crashed against a backend that sent everything wireChecks asks for — ` +
          `${crashes[0] ?? 'caught by the error boundary'}`,
      );
    }
    if (process.env.SPARSE_TEXT) console.log(`\n— ${route}\n  ${text.slice(0, 240)}`);

    rows.push({ route, ok: !broke && wrongState.length === 0, why: crashes[0] ?? '' });
    await context.close();
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log('\nroute                              survived the minimum');
for (const row of rows) {
  console.log(`  ${row.ok ? '✓' : '✗'} ${row.route.padEnd(34)}${row.why.slice(0, 80)}`);
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} screen(s) assume more than the app's own contract requires.`);
  process.exit(1);
}

console.log(`${ROUTES.length} screens rendered against a backend that sent only what it promised.`);
