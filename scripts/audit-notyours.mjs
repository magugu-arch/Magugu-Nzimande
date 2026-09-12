#!/usr/bin/env node
/**
 * The link that is not yours.
 *
 * Order links get shared. Push notifications go stale. Ids are short enough to
 * mistype and, in a URL bar, short enough to change on purpose. So every deep
 * link in this app has three endings and the app has only ever been driven
 * down one of them: the id exists and is yours.
 *
 * The other two are answered by the server, and they are different sentences:
 *
 *   404  there is no such thing
 *   403  there is, and it is somebody else's
 *
 * `isNotFound` reads 404 and every detail screen branches on it. **Nothing in
 * this app reads 403 at all.** A customer opening a friend's order link meets
 * the generic error state — "Something went wrong", with a Try again button
 * that will be refused every time it is pressed, because nothing went wrong
 * and trying again cannot change whose order it is.
 *
 * That is the same rule this repository keeps arriving at from a new
 * direction: **an error state is a claim about the app, and this is a claim
 * about the app that is false.** The server behaved perfectly.
 *
 * What the screen should say is already written — the 404 copy reads "It may
 * be too old to show, or it belonged to another account", which is exactly the
 * 403 case. The wording exists; the status routes around it.
 *
 * Cases, per subject and per ending:
 *
 *   1. an order that does not exist
 *   2. an order that belongs to somebody else
 *   3. a reward that is gone
 *   4. an offer that has ended
 *   5. an item that is off the menu
 *   6. access withdrawn *after* the screen has already drawn it
 *   7. a server that is genuinely broken — the control, where "something went
 *      wrong" is the honest answer and a finding would be noise
 *
 * Case 6 is the one with a customer's data in it, and case 7 is what keeps the
 * other six honest.
 *
 * Run: npm run audit:notyours
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-notyours');
const APP_PORT = 8281;
const API_PORT = 8282;
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

/**
 * Somebody else's order, written in full.
 *
 * Every field a screen might print, so that if any of it reaches the DOM the
 * sweep can say exactly which. A stub that answered thinly here could not tell
 * "the app showed nothing" from "there was nothing to show".
 */
const THEIR_ORDER = {
  id: 'order-theirs',
  reference: 'BBQ-7781',
  status: 'out_for_delivery',
  fulfilmentType: 'delivery',
  placedAt: new Date(LUNCHTIME - 30 * 60_000).toISOString(),
  etaMinutes: 40,
  storeId: 'store-notyours',
  storeName: 'bb.q Chicken Rosebank',
  customerName: 'Sipho Dlamini',
  deliveryAddressLine: '9 Jan Smuts Avenue, Parktown',
  lines: [
    {
      id: 'line-theirs',
      productId: 'golden-original',
      name: 'Golden Original Chicken',
      quantity: 2,
      unitPrice: 149,
      lineTotal: 298,
      selectedOptions: [],
    },
  ],
  totals: {
    subtotal: 298,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 335,
  },
  timeline: [],
  paymentMethodLabel: 'Visa ending 9915',
};

/** Anything of theirs that must never reach a screen. */
const THEIRS = [
  ['BBQ-7781', 'their order reference'],
  ['Sipho Dlamini', 'their name'],
  ['Jan Smuts', 'their address'],
  ['9915', 'their card'],
  ['335', 'what they paid'],
];

const MENU = {
  categories: [{ id: 'chicken', name: 'Chicken', description: 'Fried chicken' }],
  products: [
    {
      id: 'golden-original',
      slug: 'golden-original-chicken',
      name: 'Golden Original Chicken',
      description: 'The original.',
      categoryId: 'chicken',
      assetKey: 'goldenOriginal',
      basePrice: 149,
      available: true,
      tags: ['popular'],
      optionGroups: [],
      allergens: [],
      termsAndConditions: [],
    },
  ],
};

const LOYALTY = {
  memberId: 'member-notyours',
  pointsBalance: 9000,
  tier: 'bronze',
  tierName: 'Bronze',
  pointsToNextTier: 0,
  tierProgress: 0,
  lifetimePoints: 9000,
  history: [],
};

const BASE_BODIES = {
  '/v1/menu': MENU,
  '/v1/loyalty/rewards': [],
  '/v1/loyalty/tiers': [
    { tier: 'bronze', name: 'Bronze', threshold: 0, pointsPerRand: 1, perks: [] },
  ],
  '/v1/loyalty/account': LOYALTY,
  '/v1/loyalty/vouchers': [],
  '/v1/promotions': [],
  '/v1/stores': [],
  '/v1/orders': [],
  '/v1/account/addresses': [],
  '/v1/account/payment-methods': [],
  '/v1/account/favourites': [],
  '/v1/account/notifications': [],
};

/**
 * How the stub answers the one path under test. Set per case.
 *
 * `refusals` maps an exact path to a status; `grantOnce` serves the order
 * successfully the first time it is asked for and refuses afterwards, which is
 * the access-withdrawn case.
 */
let refusals = {};
let grantOnce = false;
let served = 0;

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

    if (pathname === '/v1/orders/order-theirs' && grantOnce) {
      served += 1;
      if (served === 1) {
        res.writeHead(200, cors);
        res.end(JSON.stringify(THEIR_ORDER));
        return;
      }
      res.writeHead(403, cors);
      res.end(JSON.stringify({ code: 'forbidden', message: 'That order is not yours.' }));
      return;
    }

    const refused = refusals[pathname];
    if (refused !== undefined) {
      res.writeHead(refused, cors);
      res.end(
        JSON.stringify({
          code: refused === 403 ? 'forbidden' : refused === 404 ? 'not_found' : 'server_error',
          message: refused === 403 ? 'That is not yours.' : 'No.',
        }),
      );
      return;
    }

    /*
      A product path nobody serves is a 404, which is what a real backend
      answers and what `fetchProduct` is written against.

      Without this the prefix match below handed `GET /v1/menu/products/x` the
      whole menu object, `checkedProduct` rejected it as malformed, and the
      case reported that the screen "never said no longer on the menu" — a
      finding about this file wearing the clothes of a finding about the app.
      The fifth time a stub in this repository has been wrong in exactly that
      way; each one is written up where it happened.
    */
    if (pathname.startsWith('/v1/menu/products/')) {
      res.writeHead(404, cors);
      res.end(JSON.stringify({ code: 'not_found', message: 'No such item.' }));
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
      id: 'user-notyours',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'notyours@example.co.za',
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

/** The app's own crash screen, never an acceptable answer here. */
const CRASHED = /Something broke/i;

/**
 * The generic "we could not load this" state, with its retry.
 *
 * Correct for a server that is broken and wrong for one that has answered.
 * Matched by the button rather than the sentence: the copy could be reworded
 * and the invitation to retry a refusal would still be there.
 */
const OFFERS_A_RETRY = /Try again/i;

const CASES = [
  {
    name: 'an order that does not exist',
    route: '/order/order-missing',
    refuse: { '/v1/orders/order-missing': 404 },
    expect: /can't find that order/i,
    forbidRetry: true,
  },
  {
    name: 'an order that belongs to somebody else',
    route: '/order/order-theirs',
    refuse: { '/v1/orders/order-theirs': 403 },
    // The wording already written for exactly this, on the 404 branch.
    expect: /can't find that order/i,
    forbidRetry: true,
    leaks: true,
  },
  {
    name: 'a reward that is gone',
    route: '/rewards/reward-missing',
    refuse: { '/v1/loyalty/rewards': 404 },
    expect: /can't find that reward|no longer available/i,
  },
  {
    name: 'a reward that is not yours',
    route: '/rewards/reward-missing',
    refuse: { '/v1/loyalty/rewards': 403 },
    expect: /can't find that reward|no longer available/i,
    forbidRetry: true,
  },
  {
    name: 'an offer that has ended',
    route: '/offers/promo-missing',
    refuse: { '/v1/promotions': 404 },
    expect: /offer has ended|can't find/i,
  },
  {
    name: 'an item that is off the menu',
    route: '/product/gone-forever',
    refuse: {},
    expect: /no longer on the menu|can't find/i,
  },
  {
    /*
      The one with a customer's data in it.

      The order loads, and then access is withdrawn — a session that has moved
      on, an order handed back, a token that now belongs to somebody else. The
      query keeps the data it already has beside the new error, so a screen
      that renders `data` whenever it is present would go on showing a
      stranger's address and card to whoever is holding the phone.
    */
    name: 'access withdrawn after the screen has drawn it',
    route: '/order/order-theirs',
    grantOnce: true,
    refresh: true,
    forbidRetry: true,
    leaks: true,
  },
  {
    /*
      The control. A 500 is the app not knowing, and "something went wrong ·
      Try again" is exactly right for it — the next attempt genuinely might
      work. If this case ever reports a finding, the rule above has been
      applied too widely.
    */
    name: 'a server that is genuinely broken',
    route: '/order/order-broken',
    refuse: { '/v1/orders/order-broken': 500 },
    expect: OFFERS_A_RETRY,
    control: true,
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

console.log('Building with the mock layer off, pointed at a stub that refuses…');
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

try {
  for (const testCase of CASES) {
    refusals = testCase.refuse ?? {};
    grantOnce = testCase.grantOnce === true;
    served = 0;

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
        window.localStorage.setItem('bbq.auth.accessToken', 'at_notyours');
        window.localStorage.setItem('bbq.auth.refreshToken', 'rt_notyours');
      } catch {
        // A context that refuses storage is a browser problem, not an app one.
      }
    }, SIGNED_IN);

    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

    await page.goto(`${BASE}${testCase.route}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(4000);

    const wrongState = await preconditionFailures(page, {
      where: testCase.name,
      signedIn: true,
    });
    for (const failure of wrongState) findings.push(failure);

    /*
      The second visit, for the withdrawn case: the same screen re-entered, so
      the query refetches and meets the refusal with the first answer still in
      hand. Navigating away and back rather than reloading, because a reload
      would throw the cache away and test nothing.
    */
    if (testCase.refresh) {
      await page.goto(`${BASE}/menu`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1500);
      await page.goto(`${BASE}${testCase.route}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(4000);
    }

    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const caught = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="error-boundary"]')),
    );

    const told = testCase.expect ? testCase.expect.test(text) : true;
    const retried = OFFERS_A_RETRY.test(text);
    const leaked = testCase.leaks
      ? THEIRS.filter(([needle]) => text.includes(needle)).map(([, what]) => what)
      : [];

    if (crashes.length > 0 || caught || CRASHED.test(text)) {
      findings.push(
        `${testCase.name}: crashed the screen — ${crashes[0] ?? 'caught by the error boundary'}`,
      );
    }
    if (leaked.length > 0) {
      findings.push(
        `${testCase.name}: showed ${leaked.join(', ')} to somebody the server had just refused`,
      );
    }
    if (!told) {
      findings.push(
        `${testCase.name}: never said ${testCase.expect} — screen reads: ${text.slice(0, 170)}`,
      );
    }
    if (testCase.forbidRetry === true && retried) {
      findings.push(
        `${testCase.name}: offered "Try again" for an answer that will not change. ` +
          `The server was right and the screen is blaming the app.`,
      );
    }

    rows.push({
      name: testCase.name,
      control: testCase.control === true,
      ok:
        told &&
        leaked.length === 0 &&
        !(testCase.forbidRetry === true && retried) &&
        crashes.length === 0 &&
        !caught,
    });
    if (process.env.NOTYOURS_TEXT) console.log(`\n— ${testCase.name}\n  ${text.slice(0, 240)}`);
    await context.close();
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log('\ncase');
for (const row of rows) {
  console.log(`  ${row.ok ? '✓' : '✗'} ${row.name}${row.control ? '  (control)' : ''}`);
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) wrong about a link that is not yours.`);
  process.exit(1);
}

console.log(`${CASES.length} refused links, and the app was honest about every one.`);
