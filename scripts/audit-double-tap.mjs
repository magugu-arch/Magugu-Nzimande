#!/usr/bin/env node
/**
 * The second tap.
 *
 * A phone that is thinking looks exactly like a phone that missed the tap, so
 * people tap again. It is the single most common thing a customer does that no
 * designer draws, and in this app one control has ever been protected against
 * it: `checkout/index.tsx` keeps an `inFlight` ref and returns early, with a
 * comment explaining why the button's own disabled state was not enough.
 *
 * Every other write in the app relies on `loading={mutation.isPending}`, which
 * is a *rendered* guard: it only refuses the second tap once React has painted
 * the first one. That is usually fast enough and "usually" is not a property
 * you want on a control that spends money or points.
 *
 * So rather than reason about it, count. Each case presses one control twice —
 * once as fast as the DOM can deliver two clicks, once at a human's 70ms —
 * against a stub that counts every request it is asked for. One request is
 * right. Two is the finding, and what two costs depends on the case:
 *
 *   redeem a reward       two redemptions, points taken twice, one discount
 *                         applied — the customer pays double and sees single
 *   save an address       two identical addresses in their address book
 *   send a support note   two tickets, and an agent answering both
 *   rate an order         two ratings for one meal
 *   place an order        the control, which has the guard and must stay at 1
 *
 * The last one is a control rather than a test: if it ever reports 2, this
 * sweep is broken rather than the app.
 *
 * Run: npm run audit:double-tap
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-double-tap');
const APP_PORT = 8261;
const API_PORT = 8262;
const BASE = `http://localhost:${APP_PORT}`;

/** Lunchtime on a Wednesday, so every branch is open. */
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

/** A customer who signed in before any of this. */
const SIGNED_IN = JSON.stringify({
  state: {
    user: {
      id: 'user-double',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'double@example.co.za',
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
        id: 'golden-original__double',
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

/* -------------------------------------------------------------------------- */

/** A backend that is right about everything and slow enough to be tapped twice. */
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

const TIER = {
  tier: 'bronze',
  name: 'Bronze',
  threshold: 0,
  pointsPerRand: 1,
  perks: ['Birthday treat'],
};

const LOYALTY = {
  memberId: 'member-double',
  pointsBalance: 9000,
  tier: 'bronze',
  tierName: 'Bronze',
  pointsToNextTier: 0,
  tierProgress: 0,
  lifetimePoints: 9000,
  history: [],
};

const STORE = {
  id: 'store-double',
  name: 'bb.q Chicken Double Street',
  addressLine: '1 Double Street',
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
  id: 'address-double',
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
  id: 'payment-double',
  type: 'card',
  label: 'Visa ending 4821',
  last4: '4821',
  expiry: '09/28',
  brand: 'Visa',
  isDefault: true,
};

const ORDER = {
  id: 'order-double',
  reference: 'BBQ-9001',
  status: 'delivered',
  fulfilmentType: 'delivery',
  placedAt: new Date(LUNCHTIME - 60 * 60_000).toISOString(),
  etaMinutes: 40,
  storeId: STORE.id,
  storeName: STORE.name,
  lines: [
    {
      id: 'line-double',
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

const TOPICS = [
  { id: 'topic-order', title: 'A problem with an order', description: 'Something went wrong.' },
];

/*
  Endpoint → body, matched exactly before it is matched by prefix.

  The first version of this stub prefix-matched only, so `GET
  /v1/orders/order-double` was answered with the *list* `[ORDER]`. `checkedOrder`
  rejected it, the rating screen rendered its error state, and the case reported
  that it "could not fill its own form" — a finding about this file wearing the
  clothes of a finding about the app. The fourth time a stub in this repository
  has been wrong that way; each one is written up where it happened.
*/
const bodies = {
  '/v1/menu': {
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
  },
  '/v1/loyalty/rewards': [REWARD],
  '/v1/loyalty/tiers': [TIER],
  '/v1/loyalty/account': LOYALTY,
  '/v1/loyalty/vouchers': [],
  '/v1/promotions': [],
  '/v1/stores': [STORE],
  '/v1/orders': [ORDER],
  '/v1/orders/order-double': ORDER,
  '/v1/account/addresses': [ADDRESS],
  '/v1/account/payment-methods': [CARD],
  '/v1/account/favourites': [],
  '/v1/account/notifications': [],
  '/v1/support/topics': TOPICS,
};

/**
 * Every write the stub is asked for, in order.
 *
 * The whole measurement. A slow reply is what gives the second tap somewhere to
 * land, so writes answer after a deliberate pause — without it the first
 * request would be finished before a human could possibly tap again, and every
 * case would pass for the emptiest reason there is.
 */
let asked = [];
const WRITE_DELAY_MS = 1500;

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

    if (req.method === 'GET' || req.method === 'HEAD') {
      // Exact first. A prefix match on its own answers a single-resource read
      // with the collection, which is a different shape and a different bug.
      const exact = Object.hasOwn(bodies, pathname) ? bodies[pathname] : undefined;
      const body =
        exact ?? Object.entries(bodies).find(([route]) => pathname.startsWith(route))?.[1] ?? [];
      res.writeHead(200, cors);
      res.end(JSON.stringify(body));
      return;
    }

    asked.push(`${req.method} ${pathname}`);

    let answer = {};
    if (pathname === '/v1/loyalty/redeem') answer = { reward: REWARD, discount: 20 };
    else if (pathname === '/v1/account/addresses') answer = { ...ADDRESS, id: 'address-new' };
    else if (pathname === '/v1/support/messages') answer = { id: 'ticket-1', received: true };
    else if (pathname === '/v1/payments/authorise') answer = { success: true, intentId: 'pi_1' };
    else if (pathname.startsWith('/v1/orders')) answer = ORDER;

    // Drained, then answered. The body is read so the socket does not stall on
    // a request whose payload nobody consumed.
    req.resume();
    setTimeout(() => {
      res.writeHead(200, cors);
      res.end(JSON.stringify(answer));
    }, WRITE_DELAY_MS);
  });
  return new Promise((resolve) => server.listen(API_PORT, '127.0.0.1', () => resolve(server)));
}

/* -------------------------------------------------------------------------- */

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
 * Two taps, as close together as the case asks for.
 *
 * `same tick` dispatches both clicks inside one `evaluate`, so the second is
 * delivered before React can possibly have re-rendered — the harshest version,
 * and the one a rendered `isPending` guard cannot see. `70ms` is a person
 * double-tapping a phone that looks stuck, which is the case that actually
 * happens.
 */
const TAPS = {
  'same tick': async (page, selector) => {
    await page.evaluate((wanted) => {
      const node = document.querySelector(wanted);
      if (node === null) throw new Error(`nothing at ${wanted}`);
      node.click();
      node.click();
    }, selector);
  },
  '70ms': async (page, selector) => {
    /*
      Scrolled into view first, because this mode clicks a coordinate.

      The send button on the contact form sits below the fold, and the first
      run of this put both clicks on whatever happened to be at that point in
      the viewport — the case reported that two taps sent no request at all,
      which was true and was about this script.
    */
    await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 8000 });
    await page.waitForTimeout(300);
    const box = await page.locator(selector).first().boundingBox();
    if (box === null) throw new Error(`nothing at ${selector}`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.click(x, y);
    await page.waitForTimeout(70);
    await page.mouse.click(x, y);
  },
};

const CASES = [
  {
    name: 'redeeming a reward',
    route: '/rewards/reward-r20',
    selector: '[data-testid="reward-redeem"]',
    writes: 'POST /v1/loyalty/redeem',
    costs: 'the points are taken twice and one discount is applied',
  },
  {
    name: 'saving a new address',
    route: '/checkout/address',
    writes: 'POST /v1/account/addresses',
    costs: 'two identical addresses in their address book',
    selector: '[data-testid="address-save"]',
    fill: async (page) => {
      // The form is behind "Add a new address"; without this the fields are
      // not on the screen at all.
      await page.locator('[data-testid="address-add"]').first().click({ timeout: 8000 });
      await page.waitForTimeout(800);
      await page.locator('[data-testid="address-field-label"]').first().fill('Work');
      await page.locator('[data-testid="address-field-line1"]').first().fill('14 Acacia Road');
      await page.locator('[data-testid="address-field-suburb"]').first().fill('Rosebank');
      await page.locator('[data-testid="address-field-city"]').first().fill('Johannesburg');
      // Province and postal code are required too — `validateFields` refuses
      // the save without them and no request is ever sent.
      await page.locator('[data-testid="address-field-province"]').first().fill('Gauteng');
      await page.locator('[data-testid="address-field-postalCode"]').first().fill('2196');
    },
  },
  {
    name: 'sending a support message',
    route: '/account/contact',
    selector: '[data-testid="contact-submit"]',
    writes: 'POST /v1/support/messages',
    costs: 'two tickets, and somebody answering both',
    fill: async (page) => {
      const topic = await page.evaluate(
        () =>
          [...document.querySelectorAll('[data-testid]')]
            .map((node) => node.getAttribute('data-testid'))
            .find((id) => id?.startsWith('contact-subject-')) ?? null,
      );
      if (topic) await page.locator(`[data-testid="${topic}"]`).first().click({ timeout: 8000 });
      await page
        .locator('[data-testid="contact-message"]')
        .first()
        .fill('My order arrived cold and I would like somebody to look at it.');
    },
  },
  {
    name: 'rating an order',
    route: '/order/order-double/rate',
    selector: '[data-testid="rate-submit"]',
    writes: 'POST /v1/orders/order-double/rating',
    costs: 'two ratings for one meal',
    fill: async (page) => {
      // The stars are labelled rather than test-idded, which is the accessible
      // way round and is how a screen reader reaches them too.
      await page.getByLabel('Rate 5 stars').first().click({ timeout: 8000 });
    },
  },
  {
    /*
      The control. `checkout/index.tsx` has kept an `inFlight` ref since long
      before this sweep, with a comment saying the button's own disabled state
      was not enough. If this case ever reports two, the sweep is broken rather
      than the app.
    */
    name: 'placing an order',
    route: '/checkout',
    selector: '[data-testid="checkout-place-order"]',
    writes: 'POST /v1/payments/authorise',
    costs: 'the card is authorised twice',
    control: true,
    basket: true,
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
const rows = [];

try {
  for (const testCase of CASES) {
    const result = { name: testCase.name, control: testCase.control === true };

    for (const [how, tap] of Object.entries(TAPS)) {
      asked = [];

      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        timezoneId: 'Africa/Johannesburg',
      });
      await context.addInitScript(pinClock(LUNCHTIME));
      await context.addInitScript(
        ({ session, basket }) => {
          try {
            window.localStorage.setItem('bbq.auth', session);
            window.localStorage.setItem('bbq.auth.accessToken', 'at_double');
            window.localStorage.setItem('bbq.auth.refreshToken', 'rt_double');
            if (basket !== null) window.localStorage.setItem('bbq.cart', basket);
          } catch {
            // A context that refuses storage is a browser problem, not an app one.
          }
        },
        { session: SIGNED_IN, basket: testCase.basket ? BASKET : null },
      );

      const page = await context.newPage();
      const crashes = [];
      page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

      await page.goto(`${BASE}${testCase.route}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(3000);

      const wrongState = await preconditionFailures(page, {
        where: `${testCase.name} (${how})`,
        signedIn: true,
        seeded: testCase.basket ? ['bbq.cart'] : [],
      });
      for (const failure of wrongState) findings.push(failure);

      let ready = true;
      if (testCase.fill) {
        await testCase.fill(page).catch(() => {
          ready = false;
        });
        await page.waitForTimeout(800);
      }

      // Only the taps are counted, not the reads the screen did on its way in.
      asked = [];

      let tapped = true;
      if (ready) {
        await tap(page, testCase.selector).catch(() => {
          tapped = false;
        });
      }
      // Long enough for a second request to have been sent and answered.
      await page.waitForTimeout(WRITE_DELAY_MS + 3500);

      const sent = asked.filter((request) => request === testCase.writes).length;

      if (!ready) {
        findings.push(
          `${testCase.name} (${how}): could not fill its own form, so this case proved nothing`,
        );
      } else if (!tapped) {
        const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
        findings.push(
          `${testCase.name} (${how}): could not press ${testCase.selector}, so this case ` +
            `proved nothing. Screen reads: ${text.slice(0, 200)}`,
        );
      } else if (sent === 0) {
        findings.push(
          `${testCase.name} (${how}): two taps sent no ${testCase.writes} at all. ` +
            `The app sent: ${asked.join(', ') || '(nothing)'}`,
        );
      } else if (sent > 1) {
        findings.push(
          `${testCase.name} (${how}): two taps sent ${sent} × ${testCase.writes} — ` +
            `${testCase.costs}`,
        );
      }
      if (crashes.length > 0) {
        findings.push(`${testCase.name} (${how}): crashed the screen — ${crashes[0]}`);
      }

      result[how] = { sent, ok: ready && tapped && sent === 1 && crashes.length === 0 };
      await context.close();
    }

    rows.push(result);
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log('\ncontrol                          same tick   70ms apart');
for (const row of rows) {
  const cell = (result) => `${result.ok ? '✓' : '✗'} ${result.sent}×`.padEnd(11);
  console.log(
    `  ${row.name.padEnd(30)} ${cell(row['same tick'])} ${cell(row['70ms'])}` +
      (row.control ? '  (control)' : ''),
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) a second tap can do twice.`);
  process.exit(1);
}

console.log(`${CASES.length} controls tapped twice two ways each, and each one did its job once.`);
