#!/usr/bin/env node
/**
 * What every screen says when it cannot reach the server.
 *
 * This is not a hypothetical. It is the state the app is in if the API is not
 * ready on opening day, during any outage, and on any phone that has walked
 * into a dead spot — which in South Africa is an ordinary Tuesday.
 *
 * The first run of this found eleven of fourteen screens claiming something
 * false rather than admitting they could not reach the server:
 *
 *     /offers                   "No offers right now · Nothing running"
 *     /orders                   "No orders on the go"
 *     /account/payment-methods  "No payment methods saved"
 *     /rewards/vouchers         "No vouchers yet"
 *
 * Every one of those is a statement about the world made by an app that had
 * just failed to look at the world. The rule this enforces: **an empty state
 * is a claim about the world, an error state is a claim about the app, and a
 * screen that has not fetched anything is only entitled to the second.**
 *
 * Run: npm run audit:offline
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-nobackend');
const PORT = 8161;

/**
 * Screens whose whole job is to show fetched data. Each one, with no server,
 * must say so rather than describe an empty world.
 */
const ROUTES = [
  '/menu',
  '/offers',
  '/orders',
  '/rewards',
  '/rewards/vouchers',
  '/account/payment-methods',
  '/account/notifications',
  '/checkout/store',
  '/product/golden-original',
  '/order/order-4821',
  // The detail screen, not just the list. It answered a failed fetch with
  // "That offer has ended" — a claim about the promotions calendar made by an
  // app that had not reached the promotions calendar. Somebody who taps a push
  // notification on a train is the person who meets it.
  '/offers/promo-free-delivery',
  /**
   * The screen where the money is, and the one this sweep could not see.
   *
   * Checkout renders from the basket, so it needs one seeded before it is
   * anything but an empty state — and the route that takes setting up is the
   * route that goes unswept. Driven with a basket for the first time, against
   * this same dead host, it drew a completely ordinary checkout: "Choose a
   * store", "Add a delivery address", and a Payment section listing SnapScan,
   * Instant EFT and Cash on delivery. A customer with three saved cards was
   * shown the brand-new-customer screen with no hint that anything had failed.
   */
  '/checkout',
  /**
   * ── The routes this sweep had never visited ──────────────────────────────
   *
   * Worth stating plainly, because the pattern is the point: every screen in
   * this app that uses `isOfflinePending` is a screen this list already
   * contained, and every screen that does not is one it did not. The fix
   * followed the sweep. Wherever the sweep never went, the hole stayed open.
   *
   * `/home` is the worst of them — the front door, and the busiest screen in
   * the app. Against a dead host it drew itself in full and empty: "Popular
   * right now · What everyone else is ordering · See all" over an empty row,
   * Best sellers the same, no categories, and not one word about the server.
   *
   * `/account/help` drew the category chips and no topics, over "Still stuck?
   * Our team can look into your specific order and sort it out." Nobody is
   * stuck on the help centre; they are stuck on something else, and the app
   * had just told them nothing is written about it.
   *
   * `/rewards/reward-birthday` said "We can't find that reward. It may have
   * expired." — a claim about the rewards catalogue from an app that had not
   * reached the rewards catalogue, and the exact defect `/offers/[id]` was
   * fixed for one screen over.
   *
   * `/order/order-4610/rate` blamed itself with the generic error while
   * knowing perfectly well the device was offline.
   */
  '/home',
  '/account/help',
  '/rewards/reward-birthday',
  '/order/order-4610/rate',
];

/**
 * Routes that are nothing without a basket.
 *
 * Seeded through the same door as the session — straight into storage, because
 * there is no server here to add an item against. The line is a real one off
 * the menu, priced as the menu prices it.
 */
const NEEDS_BASKET = new Set(['/checkout']);

const BASKET = JSON.stringify({
  state: {
    lines: [
      {
        id: 'golden-original__offline',
        productId: 'golden-original',
        name: 'Golden Original Chicken',
        assetKey: 'goldenOriginal',
        // Golden Original's own base price. Restated here because a plain
        // .mjs script cannot import the menu, and bound to `menuData` by
        // `checkoutSupport.test.ts` so it cannot drift away from it.
        unitBasePrice: 149,
        quantity: 1,
        selectedOptions: [],
        unitPrice: 149,
        lineTotal: 149,
      },
    ],
    fulfilmentType: 'delivery',
  },
  version: 0,
});

/** Copy that admits the app could not reach the server. */
const HONEST = /Something went wrong|couldn't load|can't reach|You're offline|Try again/i;

/**
 * Copy that names the actual reason: this device has no connection.
 *
 * Stricter than `HONEST` on purpose, and checked separately. Every route here
 * is one where the app *knows* the query is paused for want of a network —
 * `isOfflinePending` can tell — so "Something went wrong" is honest but worse
 * than it needs to be: it reads as a fault in the app rather than a lift with
 * no signal.
 *
 * Two screens fell through to the generic error while nine others named it,
 * and the earlier version of this audit could not see the difference because
 * "Something went wrong" satisfied it. Order tracking was one of them, which
 * is the screen somebody is most likely to be staring at underground.
 */
const NAMES_THE_CAUSE = /You're offline|No connection|no internet/i;

/**
 * Copy that asserts a fact about the customer or the business. Harmless when
 * the data really did arrive and really was empty; a lie when it did not.
 *
 * A third element scopes a rule to one route. Most of these are safe to apply
 * everywhere — no screen has any business saying "No vouchers yet" here — but
 * checkout's two are ordinary summary-row prompts, and the same words are a
 * page's own name one screen over. `/checkout/store` is titled "Choose a
 * store" and shows an honest offline state underneath it; failing that is
 * nagging about a heading, and an audit that cries wolf is one people learn to
 * run with their eyes shut.
 */
const CLAIMS = [
  [/No offers right now|Nothing running/i, 'claims the business is running no offers'],
  [/No orders on the go|Nothing cooking/i, 'claims the customer has no orders'],
  [/No vouchers yet/i, 'claims the customer has no vouchers'],
  [/No payment methods saved/i, 'claims the customer has no saved cards'],
  [/came off the menu|can't find that item/i, 'blames the menu for a failed fetch'],
  [/offer has ended|no longer running/i, 'blames the promotions calendar for a failed fetch'],
  /*
    Checkout's two rows. Each is a perfectly good prompt when the data arrived
    and the customer simply has not chosen yet, and a lie here, where nothing
    arrived at all.

    "Choose a store" is the sharper of them: it is an instruction, and the
    picker it points at cannot load a list either, so the customer taps
    through, meets an error, comes back and reads the same instruction again.
  */
  [/Choose a store/i, 'tells the customer to pick a branch it cannot list', '/checkout'],
  [/Add a delivery address/i, 'claims the customer has no saved address', '/checkout'],
  /*
    The reward detail, which said the same thing `/offers/[id]` used to say
    about a promotion — that it had ended — on the strength of a fetch that
    never happened. Scoped, because "may have expired" is the right sentence
    for a reward that really has.
  */
  [
    /can't find that reward|may have expired/i,
    'blames the rewards catalogue for a failed fetch',
    '/rewards/reward-birthday',
  ],
  /*
    Home, where the lie is a shape rather than a sentence: the section headings
    are drawn over empty carousels, so the screen reads as a menu with nothing
    on it. "Still stuck?" on the help centre is the same trick — a footer
    offering to escalate, under a list that never loaded.
  */
  [
    /What everyone else is ordering|Tried, tested and repeatedly reordered/i,
    'draws its carousels with nothing in them',
    '/home',
  ],
  [/Still stuck\?/i, 'offers to escalate under a help list that never loaded', '/account/help'],
];

/**
 * Checkout's payment section, which cannot be caught by a phrase.
 *
 * The lie there was not something the screen said — it was something it drew.
 * `offeredPaymentMethods` falls back to the standing rails when the saved list
 * is empty, so a failed fetch rendered SnapScan, Instant EFT and Cash on
 * delivery under a plain "Payment" heading: the brand-new-customer screen,
 * shown to a customer with cards, with nothing on the page admitting it.
 *
 * So the rule is about the pairing rather than the words. Rails may be offered
 * — they are what a customer on a bad connection can still pay with — but not
 * silently.
 */
const RAILS_WITHOUT_A_WORD = {
  route: '/checkout',
  rails: /SnapScan|Instant EFT|Cash on delivery/i,
  admission: /couldn't load your saved cards/i,
  why: 'offers the standing rails as if they were the customer’s saved cards',
};

/**
 * A customer who signed in earlier and has since lost signal.
 *
 * Seeded straight into storage rather than typed into the sign-in screen,
 * because there is no server here to sign in against — and because that is the
 * honest scenario anyway. Nobody signs in underground; they sign in at home and
 * then walk into a lift.
 *
 * Without it, half the routes below render their signed-out state instead of
 * their offline one, and this audit stops measuring what it is named after.
 * That happened: gating account screens behind a sign-in silently turned five
 * of these ten into a check of the guest view, and the run still exited 0
 * because an unrecognised screen was a warning rather than a failure. Both
 * halves are fixed — this seeds the session, and an unrecognised screen now
 * fails.
 */
const SIGNED_IN = JSON.stringify({
  state: {
    user: {
      id: 'user-offline-example-co-za',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'offline@example.co.za',
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
    preferences: {
      defaultFulfilment: 'delivery',
      marketingConsent: false,
      preferMildFirst: false,
    },
  },
  version: 0,
});

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
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building with the mock layer off…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  // The point of this sweep: no mock, and a host that does not answer.
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '0' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const findings = [];
const rows = [];

try {
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(
      ({ session, basket }) => {
        try {
          window.localStorage.setItem('bbq.auth', session);
          if (basket !== null) window.localStorage.setItem('bbq.cart', basket);
        } catch {
          // A context that refuses storage is a browser problem, not an app one.
        }
      },
      { session: SIGNED_IN, basket: NEEDS_BASKET.has(route) ? BASKET : null },
    );
    const page = await context.newPage();

    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    // Long enough for the client timeout and its retries to run out.
    await page.waitForTimeout(14000);

    /**
     * The screen's own words, with the global offline banner cut out.
     *
     * The banner says "You're offline" on every route, so reading the whole
     * body makes any check for that phrase impossible to fail — which is
     * exactly what the first version of the `NAMES_THE_CAUSE` rule below did.
     * Removing the tracking screen's offline branch left the audit passing.
     */
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
    const honest = HONEST.test(text);
    const named = NAMES_THE_CAUSE.test(text);
    const lies = CLAIMS.filter(
      ([pattern, , only]) => (only === undefined || only === route) && pattern.test(text),
    ).map(([, why]) => why);
    if (
      route === RAILS_WITHOUT_A_WORD.route &&
      RAILS_WITHOUT_A_WORD.rails.test(text) &&
      !RAILS_WITHOUT_A_WORD.admission.test(text)
    ) {
      lies.push(RAILS_WITHOUT_A_WORD.why);
    }

    rows.push({ route, honest, named, lies });
    if (!honest && lies.length === 0) {
      findings.push(
        `${route}: says nothing about the server at all — is this still the screen it was?`,
      );
    }
    for (const why of lies) findings.push(`${route}: ${why}`);
    if (lies.length === 0 && honest && !named) {
      findings.push(
        `${route}: blames itself ("something went wrong") when it knows the device is offline`,
      );
    }
    await context.close();
  }
} finally {
  server.close();
}

/**
 * ── Phase two: coming back ─────────────────────────────────────────────────
 *
 * Everything above is about a connection that is *gone*, and it needs a build
 * with the mock off and a host that does not answer — which is exactly why it
 * could never show recovery. With `isInternetReachable` false forever, putting
 * the network back changes nothing: the app is still, correctly, offline.
 *
 * `audit:launch` has carried an item saying so — "could not be shown to detect
 * regaining it: driven in a browser it stayed offline with navigator.onLine
 * true again" — since before `useNetworkStatus` grew its recovery poll. The
 * poll went in, the note stayed, and nothing here could tell whether it worked.
 *
 * This is the missing half. A second build with the mock on, so the app is
 * genuinely usable from the device and `isOffline` reduces to `!isConnected` —
 * which on web is `navigator.onLine`, which Playwright can flip. Drop it, watch
 * the banner arrive; restore it, watch the banner clear on its own.
 *
 * Two builds in one script is the cost of asking two questions that need
 * opposite worlds. It is worth it: this is the half a customer actually meets,
 * because everybody who loses signal in a lift also comes out of it.
 */
const RECOVERY_OUT = path.join(root, '.audit-offline-mock');
const recoveryFindings = [];

console.log('\nBuilding again with the mock layer on, to watch it come back…');
execFileSync(
  'npx',
  ['expo', 'export', '--platform', 'web', '--output-dir', RECOVERY_OUT, '--clear'],
  {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
  },
);

const recoveryServer = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(RECOVERY_OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory())
      file = path.join(RECOVERY_OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  s.listen(PORT + 1, '127.0.0.1', () => resolve(s));
});

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  /*
    Measured, not merely present. The bar is a clip container that is always
    mounted and animates its height, so `querySelector` finds it whether or not
    anybody can see it — which is exactly how the first version of this check
    reported a working build as offline. Height is the only honest question.
  */
  const bannerUp = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="offline-banner"]');
      return el ? el.getBoundingClientRect().height > 1 : false;
    });

  await page.goto(`http://localhost:${PORT + 1}/menu`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  await page.waitForTimeout(2500);

  if (await bannerUp()) {
    recoveryFindings.push('the banner was already up on a working build, before anything was cut');
  }

  await context.setOffline(true);
  // The drop is event-driven, so it should be immediate. Given a second anyway.
  await page.waitForTimeout(1500);
  const droppedTo = await bannerUp();
  if (!droppedTo) recoveryFindings.push('losing the connection did not raise the banner');
  else console.log('  ✓ the banner arrives when the connection goes');

  await context.setOffline(false);
  /*
    Longer than the drop, deliberately. Recovery is the case the browser does
    *not* reliably report, which is the whole reason `useNetworkStatus` polls
    every 3s while it believes it is offline. Five seconds is one poll plus
    room; anything longer than that is a customer standing outside a lift
    watching a banner that is no longer true.
  */
  await page.waitForTimeout(5000);
  if (await bannerUp()) {
    recoveryFindings.push(
      'the banner was still up 5s after the connection came back — the recovery poll in ' +
        'useNetworkStatus is not firing, or NetInfo is not re-reading navigator.onLine',
    );
  } else {
    console.log('  ✓ the banner clears on its own when it comes back');
  }

  // And the app is usable again rather than merely quiet: the menu has to
  // still be there, which is what a paused query resuming looks like.
  const menuText = await page.evaluate(() => document.body.innerText);
  if (!/Golden Original|Chicken/i.test(menuText)) {
    recoveryFindings.push('the menu was gone after the connection came back');
  } else {
    console.log('  ✓ the menu is still there afterwards');
  }

  await context.close();
} finally {
  await browser.close();
  recoveryServer.close();
}

findings.push(...recoveryFindings);

console.log('\nroute                          says it could not reach the server');
for (const row of rows) {
  const mark = row.honest ? '✓' : '✗';
  const note = row.lies.length > 0 ? `  — ${row.lies.join('; ')}` : '';
  console.log(`  ${mark} ${row.route.padEnd(28)}${note}`);
}

if (findings.length > 0) {
  console.log(`\n${findings.length} screen(s) state something they could not have known:\n`);
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(
    '\nAn empty state is a claim about the world. A screen that has not fetched\n' +
      'anything is only entitled to say so about itself.',
  );
  process.exit(1);
}

console.log('\nNo screen claims a fact it could not have fetched.');
process.exit(0);
