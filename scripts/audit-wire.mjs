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

/*
  Everything checkout touches, so a case can be driven all the way to the
  button that takes money rather than stopping at a list screen.
*/
const STORE = {
  id: 'store-wire',
  name: 'bb.q Chicken Wire Street',
  addressLine: '1 Wire Street',
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  phone: '011 000 0000',
  latitude: -26.1446,
  longitude: 28.0417,
  openingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    opensAt: '00:00',
    closesAt: '23:59',
  })),
  supportsDelivery: true,
  supportsCollection: true,
  supportsDineIn: true,
  deliveryRadiusKm: 50,
  preparationMinutes: 18,
  isOpenNow: true,
};

const ADDRESS = {
  id: 'address-wire',
  label: 'Home',
  line1: '14 Acacia Road',
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2196',
  latitude: -26.1446,
  longitude: 28.0417,
  isDefault: true,
};

const CARD = {
  id: 'payment-wire',
  type: 'card',
  label: 'Visa ending 4821',
  last4: '4821',
  expiry: '09/28',
  brand: 'Visa',
  isDefault: true,
};

/** Endpoint → body, before any case bends one of them. */
const baseline = () => ({
  '/v1/menu': MENU,
  '/v1/loyalty/rewards': [REWARD],
  '/v1/loyalty/tiers': [TIER],
  '/v1/loyalty/account': LOYALTY,
  '/v1/loyalty/vouchers': [],
  '/v1/promotions': [],
  '/v1/stores': [STORE],
  '/v1/orders': [],
  '/v1/account/addresses': [ADDRESS],
  '/v1/account/payment-methods': [CARD],
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
  /*
    ── The money path ───────────────────────────────────────────────────────

    These three drive checkout with a seeded basket rather than a list screen,
    because the thing being measured is what happens at the button.
  */
  {
    name: 'authorised, said as a string',
    why: '"false" is truthy — the order goes through on a payment that did not',
    route: '/checkout',
    basket: true,
    reaches: '/v1/payments/authorise',
    bend: (bodies) => {
      bodies['/v1/payments/authorise'] = {
        success: 'false',
        intentId: 'pi_wire',
        message: 'Insufficient funds',
      };
    },
    // What must never appear is a confirmation. An order reference here is an
    // order placed against a declined card.
    expect: HONEST,
    forbid: /BBQ-\d|Order placed|Thanks for ordering/i,
  },
  {
    name: 'a payment method type nobody knows',
    why: 'type decides cash vs redirect vs charged inline, and falls through all three',
    route: '/checkout',
    basket: true,
    reaches: '/v1/account/payment-methods',
    bend: (bodies) => {
      bodies['/v1/account/payment-methods'] = [{ ...CARD, type: 'crypto' }];
    },
    forbid: /NaN|undefined/,
  },
  {
    name: 'an address with coordinates as strings',
    why: 'the delivery radius is measured from these',
    route: '/checkout',
    basket: true,
    reaches: '/v1/account/addresses',
    bend: (bodies) => {
      bodies['/v1/account/addresses'] = [
        { ...ADDRESS, latitude: '-26.1446', longitude: '28.0417' },
      ];
    },
    forbid: /NaN|undefined/,
  },
  /*
    Not a shape at all — a sequence. The card authorises, and the access token
    ages out before the order is created.

    `submitOrder` handles that: it releases the hold, and failing that returns
    `stranded`, whose message is the one sentence a customer with an
    unexplained hold on their card needs. What it could not handle was the
    session-expiry handler firing underneath it and replacing the route, which
    took that sentence off the screen before anybody read it.

    Both refresh and void are 401'd too, because an expired session cannot
    authenticate either — which is exactly what makes the hold stranded.
  */
  {
    name: 'the session dies between authorising and ordering',
    why: 'a card held, an order that does not exist, and a screen that navigated away',
    route: '/checkout',
    basket: true,
    reaches: '/v1/payments/authorise',
    bend: (bodies, statuses) => {
      bodies['/v1/payments/authorise'] = { success: true, intentId: 'pi_stranded' };
      statuses['/v1/orders'] = 401;
      statuses['/v1/auth/refresh'] = 401;
      /*
        The void endpoint by its full path, not by `/v1/payments`.

        The forced-status list is matched by prefix, so the broader key 401'd
        `/v1/payments/authorise` as well — the card never authorised, the
        sequence under test never ran, and the case reported a failure that was
        entirely this file's own. The third time a stub in this script has been
        wrong in a way that looked like an app defect; each one is written up
        where it happened.
      */
      statuses['/v1/payments/pi_stranded'] = 401;
    },
    // The customer must be told about the hold, and must still be standing
    // where they can read it — checked as a route, because "Sign in to finish
    // this" is a legitimate message *on* checkout and a word-match cannot tell
    // that apart from having been sent to the sign-in screen.
    expect: /card was authorised/i,
    staysOn: /\/checkout/,
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

/**
 * Endpoints answered with a status rather than a body.
 *
 * One case needs the *sequence* bent rather than a shape: the card authorises,
 * and then the token ages out before the order is created. That is a 401 on
 * `/v1/orders` after a 200 on `/v1/payments/authorise`, and nothing about a
 * response body can express it.
 */
let statuses = {};

/*
  Which endpoints the app actually asked for, per case.

  A case that bends `/v1/payments/authorise` and never causes that call proves
  nothing, and passes — which is the emptiest possible way for a sweep to be
  green, and the failure `audit:text-scale` had on its first run. So a case may
  declare the endpoint it is *about*, and the run fails if that endpoint was
  never reached.
*/
let asked = new Set();

const api = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname;
  // Recorded before the CORS short-circuit below, so a preflight counts as the
  // app having asked. The first version of this recorded after it and after a
  // reflow moved the line entirely — every case then reported "asked for
  // nothing" while the screens plainly showed stub data. See `reaches`.
  asked.add(pathname);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const forced = Object.keys(statuses).find(
    (key) => pathname === key || pathname.startsWith(key + '/'),
  );
  if (forced !== undefined) {
    res.writeHead(statuses[forced], { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 'unauthorised', message: 'Session expired' }));
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

/*
  A basket, for the cases that have to reach the button rather than a list.
  Seeded through storage because there is no mock layer in this build to add an
  item through, and the line is the one the stub menu serves.
*/
const BASKET = JSON.stringify({
  state: {
    lines: [
      {
        id: 'golden-original__wire',
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
  version: 1,
});

const findings = [];
const rows = [];

try {
  for (const testCase of CASES) {
    bodies = baseline();
    statuses = {};
    asked = new Set();
    testCase.bend(bodies, statuses);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(
      ({ session, basket }) => {
        try {
          window.localStorage.setItem('bbq.auth', session);
          /*
            The tokens as well as the profile, and they are not the same store.

            `secureStorage` puts tokens in the keychain on a device and falls
            back to AsyncStorage on web, under their own keys. Seeding only
            `bbq.auth` leaves every request without an `Authorization` header —
            and `execute` reads a 401 with no header as a *guest* who never had
            a session, not as one that expired. The session-expiry case was
            therefore driving the guest path under another name, and passing.
          */
          window.localStorage.setItem('bbq.auth.accessToken', 'at_wire');
          window.localStorage.setItem('bbq.auth.refreshToken', 'rt_wire');
          if (basket !== null) window.localStorage.setItem('bbq.cart', basket);
        } catch {
          // A context that refuses storage is a browser problem, not an app one.
        }
      },
      { session: SIGNED_IN, basket: testCase.basket ? BASKET : null },
    );
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

    /*
      A case about the money path has to press the button, or the endpoint it
      bends is never called at all — and a sweep that never reaches the code it
      is aiming at passes for the emptiest possible reason.

      Tolerant of a button that refuses: a blocked checkout is itself a
      finding-free outcome for some of these, and the text read below says
      which happened.
    */
    if (testCase.basket) {
      await page
        .locator('[data-testid="checkout-place-order"]')
        .first()
        .click({ timeout: 8000 })
        .catch(() => {});
      await page.waitForTimeout(5000);
    }

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

    const neverAsked = testCase.reaches !== undefined && !asked.has(testCase.reaches);
    const navigatedAway =
      testCase.staysOn !== undefined && !testCase.staysOn.test(new URL(page.url()).pathname);

    const caughtByBoundary = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="error-boundary"]')),
    );

    // "Something broke" satisfies neither HONEST nor a crash-free run on its
    // own, so it is named explicitly rather than left to the boundary probe.
    const showedNonsense = (testCase.forbid?.test(text) ?? false) || CRASHED.test(text);
    const missingExpected = testCase.expect ? !testCase.expect.test(text) : false;
    const crashed = crashes.length > 0 || caughtByBoundary;

    rows.push({
      name: testCase.name,
      crashed,
      showedNonsense: showedNonsense || navigatedAway,
      missingExpected,
      neverAsked,
      text,
    });

    if (navigatedAway) {
      findings.push(
        `${testCase.name}: left ${testCase.staysOn} for ${new URL(page.url()).pathname} — ` +
          `the message it was meant to show went with it`,
      );
    }

    if (neverAsked) {
      findings.push(
        `${testCase.name}: never reached ${testCase.reaches}, so this case proved nothing. ` +
          `The app asked for: ${[...asked].join(', ') || '(nothing)'}`,
      );
    }

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

console.log('\ncase                                    crashed  nonsense  missing  unreached');
for (const row of rows) {
  const mark = (value) => (value ? '   ✗   ' : '   ✓   ');
  console.log(
    `  ${row.name.padEnd(38)}${mark(row.crashed)}${mark(row.showedNonsense)}` +
      `${mark(row.missingExpected)}${mark(row.neverAsked)}`,
  );
}

/*
  What the customer actually read, for every case and not only the failing
  ones. A pass here is a claim about a screen nobody looked at otherwise, and
  the first run of this passed five cases whose screens nobody had read.
*/
if (process.env.WIRE_VERBOSE) {
  for (const row of rows) {
    /*
      The tail as well as the head for a case that presses the button: the
      screen's own failure notice sits under the order summary, so a head-only
      excerpt shows a perfectly ordinary checkout and says nothing about what
      the tap did.
    */
    console.log(`\n--- ${row.name} ---\n  ${row.text.slice(0, 300)}`);
    if (row.text.length > 300) console.log(`  …${row.text.slice(-320)}`);
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
