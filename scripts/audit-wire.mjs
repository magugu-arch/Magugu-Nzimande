#!/usr/bin/env node
/**
 * What the app does with a backend that answers slightly differently.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The backend does not exist yet. Thirty endpoints are declared, typed and
 * called, and every one of them is served today by a mock written in the same
 * repository as the code that consumes it. A mock and its caller agree by
 * construction — they were written by the same hand, on the same afternoon,
 * from the same type.
 *
 * The real one will be written by somebody else, and the first thing it will
 * do is answer *nearly* right. Money as a string, because that is the ordinary
 * way to keep float precision off a wire. A list where an object was expected,
 * because the endpoint grew a wrapper. A field renamed. None of that is a
 * failure a customer would recognise as one: `request<T>` casts the parsed
 * JSON to `T` and every type in `src/types` is a promise about the wire that
 * nothing checks.
 *
 * `wireChecks.ts` is the boundary version of that check and it exists — for
 * ten of the forty-eight `request<T>` calls. This drives the other side of the
 * line: a real Chromium, a real production bundle with the mock off, pointed
 * at a server that answers with exactly the shapes a new backend produces.
 *
 * Each case is one endpoint bent one way. What is measured is not whether the
 * app crashes — that would be a mercy — but whether the customer is shown
 * something false with a number attached.
 *
 * Needs Playwright's Chromium. Point CHROMIUM_PATH at an existing one.
 *
 * Run: npm run audit:wire
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-wire');
const APP_PORT = 8171;
const API_PORT = 8172;
const API = `http://localhost:${API_PORT}`;

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
 * A backend that is right about everything except one thing.
 *
 * The baseline is deliberately *correct* — a plausible, complete answer for
 * every endpoint the screen under test touches — so that whatever the app then
 * shows is caused by the one field being bent and nothing else. A stub that
 * answered badly everywhere would prove only that the app dislikes rubbish.
 */
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
    },
  ],
};

const REWARD = {
  id: 'reward-r20',
  name: 'R20 off your order',
  description: 'Twenty rand off.',
  pointsCost: 400,
  discountValue: 20,
  category: 'discount',
  redeemable: true,
  assetKey: 'goldenOriginal',
};

/*
  Written against `types/rewards.ts`, field for field.

  The first draft of this file invented plausible-looking shapes — `id` and
  `minPoints` on a tier, no `perks`, no `memberId` — and every case then failed
  for the baseline's reasons rather than the case's. A stub that is wrong
  everywhere proves only that the app dislikes rubbish, which is exactly what
  this file's own comment says it must not be. Caught by adding a check that
  then failed on the baseline as loudly as on the bent value.
*/
const TIER = {
  tier: 'bronze',
  name: 'Bronze',
  threshold: 0,
  pointsPerRand: 1,
  perks: ['Birthday treat'],
};

const LOYALTY = {
  memberId: 'member-wire',
  pointsBalance: 9000,
  tier: 'bronze',
  tierName: 'Bronze',
  pointsToNextTier: 0,
  tierProgress: 0,
  lifetimePoints: 9000,
  history: [],
};

/** Endpoint → body, before any case bends one of them. */
const baseline = () => ({
  '/v1/menu': MENU,
  '/v1/loyalty/rewards': [REWARD],
  '/v1/loyalty/tiers': [TIER],
  '/v1/loyalty/account': LOYALTY,
  '/v1/loyalty/vouchers': [],
  '/v1/promotions': [],
  '/v1/stores': [],
  '/v1/orders': [],
  '/v1/account/addresses': [],
  '/v1/account/payment-methods': [],
  '/v1/account/favourites': [],
  '/v1/account/notifications': [],
});

/**
 * What a screen is allowed to say when the wire disagreed with it.
 *
 * One honest, recoverable error state — the screen's own, not the app's crash
 * screen. That distinction is the whole finding: before `wireChecks` covered
 * the loyalty endpoints, five of the seven cases below put "Something broke"
 * in front of the customer, which is the boundary catching a render throw
 * three components downstream of a number it should never have been handed.
 */
const HONEST = /went wrong|couldn't load|can't reach|Try again/i;

/** The app's own crash screen, which is never an acceptable answer here. */
const CRASHED = /Something broke/i;

/**
 * The shapes a new backend actually produces.
 *
 * Every one of these is a thing a competent team ships on purpose. None is
 * malice and none is a typo; that is what makes them worth driving.
 */
const CASES = [
  {
    name: 'points cost as a string',
    why: 'a backend that keeps numbers out of JSON floats',
    route: '/rewards',
    bend: (bodies) => {
      bodies['/v1/loyalty/rewards'] = [{ ...REWARD, pointsCost: '400' }];
    },
    // 400 of 9 000 points is affordable. The screen must not say otherwise,
    // and must not print the cost as anything but 400.
    expect: HONEST,
    forbid: /NaN|R 0\.00/,
  },
  {
    name: 'reward value as a string',
    why: 'the same, one field over — this one is money',
    route: '/rewards',
    bend: (bodies) => {
      bodies['/v1/loyalty/rewards'] = [{ ...REWARD, discountValue: '20.00' }];
    },
    expect: HONEST,
    forbid: /NaN|R 0\.00/,
  },
  {
    name: 'an earn rate as a string',
    why: 'the number every points figure in the app is multiplied by',
    route: '/rewards',
    bend: (bodies) => {
      bodies['/v1/loyalty/tiers'] = [{ ...TIER, pointsPerRand: '1' }];
    },
    /*
      The one case that must *not* become an error screen, and the expectation
      is written that way on purpose.

      A failed tier fetch drops the perks block and claims nothing in its
      place. Taking a working rewards list away from a member over a missing
      perks list is the trade in the wrong direction, so `(tabs)/rewards.tsx`
      deliberately leaves tiers out of its gate — and this is where that
      decision is checked rather than remembered.

      What it must not do is quote an earn rate it could not read. "1 point per
      R1 spent" is derived from `pointsPerRand`, and printing it from a value
      the boundary refused would be the app advertising a rate it does not pay
      — the exact drift `TierDefinition.pointsPerRand` was introduced to end.
    */
    expect: /reward you can claim/i,
    forbid: /point per R1|points per R1|NaN|undefined/,
  },
  {
    name: 'a points balance as a string',
    why: 'the figure a customer checks before spending',
    route: '/rewards',
    bend: (bodies) => {
      bodies['/v1/loyalty/account'] = { ...LOYALTY, pointsBalance: '9000' };
    },
    expect: HONEST,
    forbid: /NaN|undefined/,
  },
  {
    name: 'a rewards list wrapped in an envelope',
    why: '{ data: [...] } is how half the world paginates',
    route: '/rewards',
    bend: (bodies) => {
      bodies['/v1/loyalty/rewards'] = { data: [REWARD] };
    },
    expect: HONEST,
    forbid: /NaN|undefined/,
  },
  {
    name: 'a menu price as a string',
    why: 'already covered by wireChecks — this run proves the check fires',
    route: '/menu',
    bend: (bodies) => {
      bodies['/v1/menu'] = {
        ...MENU,
        products: [{ ...MENU.products[0], basePrice: '149.00' }],
      };
    },
    // The check is supposed to turn this into one honest failure at the fetch.
    expect: HONEST,
    forbid: /R 0\.00/,
  },
  {
    name: 'a null where a list was promised',
    why: 'an endpoint with nothing to return, written the lazy way',
    route: '/rewards',
    bend: (bodies) => {
      bodies['/v1/loyalty/rewards'] = null;
    },
    expect: HONEST,
    forbid: /NaN|undefined/,
  },
];

/* -------------------------------------------------------------------------- */

console.log('Building with the mock layer off, pointed at a stub backend…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {
    ...process.env,
    EXPO_PUBLIC_USE_MOCK_API: '0',
    EXPO_PUBLIC_API_BASE_URL: API,
  },
});

/** Mutable so a case can bend one endpoint between page loads. */
let bodies = baseline();

const api = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const match = Object.keys(bodies).find(
    (key) => pathname === key || pathname.startsWith(key + '/'),
  );
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(match ? bodies[match] : null));
});

const appServer = await serveApp();
await new Promise((resolve) => api.listen(API_PORT, '127.0.0.1', resolve));

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

/** A customer who signed in before any of this. */
const SIGNED_IN = JSON.stringify({
  state: {
    user: {
      id: 'user-wire',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'wire@example.co.za',
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
  version: 1,
});

const findings = [];
const rows = [];

try {
  for (const testCase of CASES) {
    bodies = baseline();
    testCase.bend(bodies);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript((session) => {
      try {
        window.localStorage.setItem('bbq.auth', session);
      } catch {
        // A context that refuses storage is a browser problem, not an app one.
      }
    }, SIGNED_IN);
    const page = await context.newPage();

    /*
      Uncaught errors, and the ones that never become uncaught.

      The first run of this watched `pageerror` alone and reported the
      rewards screen as clean while it was showing "Something broke" — a
      React error boundary catches a render throw, so nothing ever reaches
      the page. An audit that cannot see the app's own failure screen is
      measuring the wrong thing, which is the failure mode this repository
      keeps finding in its own sweeps.
    */
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

    await page.goto(`http://localhost:${APP_PORT}${testCase.route}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    await page.waitForTimeout(6000);

    const text = (
      await page.evaluate(() => {
        const banner = document.querySelector('[data-testid="offline-banner"]');
        const hidden = banner instanceof HTMLElement ? banner : null;
        const previous = hidden?.style.display ?? null;
        if (hidden) hidden.style.display = 'none';
        const body = document.body.innerText;
        if (hidden) hidden.style.display = previous ?? '';
        return body;
      })
    ).replace(/\n+/g, ' | ');

    const caughtByBoundary = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="error-boundary"]')),
    );

    // "Something broke" satisfies neither HONEST nor a crash-free run on its
    // own, so it is named explicitly rather than left to the boundary probe.
    const showedNonsense = (testCase.forbid?.test(text) ?? false) || CRASHED.test(text);
    const missingExpected = testCase.expect ? !testCase.expect.test(text) : false;
    const crashed = crashes.length > 0 || caughtByBoundary;

    rows.push({ name: testCase.name, crashed, showedNonsense, missingExpected, text });

    if (crashed) {
      findings.push(
        `${testCase.name}: crashed the screen — ${crashes[0] ?? 'caught by the error boundary'}`,
      );
    }
    if (showedNonsense) {
      /*
        Named from whichever rule fired. Quoting `forbid`'s match when the
        crash screen is what tripped it printed `showed "undefined" to the
        customer`, which is a sentence about this script rather than about the
        app — and it read exactly like a real finding.
      */
      const bad = testCase.forbid?.exec(text)?.[0] ?? 'the app’s own crash screen';
      findings.push(`${testCase.name}: showed ${bad} to the customer (${testCase.why})`);
    }
    if (missingExpected) {
      findings.push(
        `${testCase.name}: never said ${testCase.expect} — screen reads: ${text.slice(0, 140)}`,
      );
    }

    await context.close();
  }
} finally {
  await browser.close();
  appServer.close();
  api.close();
}

console.log('\ncase                                    crashed  nonsense  missing');
for (const row of rows) {
  const mark = (value) => (value ? '   ✗   ' : '   ✓   ');
  console.log(
    `  ${row.name.padEnd(38)}${mark(row.crashed)}${mark(row.showedNonsense)}${mark(row.missingExpected)}`,
  );
}

/*
  What the customer actually read, for every case and not only the failing
  ones. A pass here is a claim about a screen nobody looked at otherwise, and
  the first run of this passed five cases whose screens nobody had read.
*/
if (process.env.WIRE_VERBOSE) {
  for (const row of rows) {
    console.log(`\n--- ${row.name} ---\n  ${row.text.slice(0, 300)}`);
  }
}

if (findings.length === 0) {
  console.log(`\n${CASES.length} bent responses, and the app told the truth about every one.`);
  process.exit(0);
}

console.log(`\n${findings.length} finding(s):\n`);
for (const finding of findings) console.log(`  ✗ ${finding}`);
console.log(
  '\nA mock and its caller agree by construction. The backend that has not been\n' +
    'written yet will not.',
);
process.exit(1);
