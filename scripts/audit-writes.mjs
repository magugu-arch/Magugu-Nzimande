#!/usr/bin/env node
/**
 * A write the server refuses.
 *
 * `queryPhase` exists because screens were written to a pattern with a hole in
 * it, and swept against a dead API host eleven of fourteen claimed something
 * false rather than admitting they could not reach the server. Reads were
 * fixed. **Writes were never swept at all.**
 *
 * They are easy to miss precisely because a failed write renders nothing. A
 * failed read produces a wrong empty state, which is visible; a failed write
 * produces a screen that sits there, which looks like a screen that has not
 * been tapped yet. `audit:wire` bends responses and reads what the customer is
 * told, but every one of its cases is a GET.
 *
 * So this drives the writes. The app is built with the mock layer off against
 * a stub that answers reads normally and refuses every mutating request, and
 * each case presses the button and reads the screen. A case passes only if the
 * customer is told something — and a case that cannot even reach its button
 * fails loudly rather than passing for the emptiest possible reason, which is
 * the mistake `audit:wire` recorded making.
 *
 * Two refusal modes per case, because they are different promises:
 *
 *   `403`   the server answered, so it decided, so nothing changed — and the
 *           app may say so.
 *   `drop`  the connection dies with no reply, so the write may well have been
 *           carried out. The app must NOT claim nothing changed. This is the
 *           same distinction `safeToRetry` draws for a payment, and getting it
 *           backwards is how an app talks somebody into deleting a card twice.
 *
 * ## What it found, and what the counterfactual can and cannot show
 *
 * Against the previous code, all twelve cells fail. Only one of them fails
 * cleanly, and that is worth stating rather than glossing.
 *
 * `marking a notification read` reports exactly the finding — *"the write
 * failed and the customer was told nothing"* — because its control already
 * carried a `testID`. The other four report *"could not press its own
 * control"*, because the per-row testIDs this sweep needs went in alongside
 * the fix. They are real failures of the old build and they are not evidence
 * of the defect; the sweep can only prove a screen said nothing if it can
 * reach the button.
 *
 * The sixth case was not found by this sweep at all. Fixture 10 in
 * `__tests__/writeFailure.test.ts` asserts that the writes already handled
 * stay handled, and `checkout/address.tsx` turned out not to be one of them:
 * it awaited `createAddress.mutateAsync` with no `catch` anywhere in the file,
 * so a refused save left a fully typed street address on screen with nothing
 * said. A test looking for a regression found an original.
 *
 * Run: npm run audit:writes
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-writes');
const APP_PORT = 8221;
const API_PORT = 8222;

/** A Monday lunchtime, so nothing here turns on the clock. */
const LUNCHTIME = '2026-09-07T12:00:00+02:00';

const pinClock = (iso) => `
  const fixed = new Date('${iso}').getTime();
  const Real = Date;
  Date = class extends Real {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  };
  Date.parse = Real.parse;
  Date.UTC = Real.UTC;
`;

const SIGNED_IN = JSON.stringify({
  state: {
    user: {
      id: 'user-writes',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'writes@example.co.za',
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

/*
  Checked before the build, because it cannot be checked after the load.

  This sweep was re-run with the stamp deliberately set to 0 — the original
  bug — and came back green twelve times over. Correctly: `migrateByRevalidating`
  re-validates the slice and the store writes it back under the current number,
  so by the time a page can be read the stamp has been corrected. The only
  place a wrong one is still visible is here.
*/
assertSeeds({ 'bbq.auth': SIGNED_IN });

/**
 * The reads the screens need before there is anything to press.
 *
 * A card list with two cards, an address list with one, one unread
 * notification and the support topics. Written to the field names in
 * `src/types`, for the reason `audit:wire` records at length: its first run
 * reported five crashed screens that were entirely its stub's invention.
 *
 * It happened here too, on the first run, in spite of that warning. This stub
 * sent a notification with `createdAt` where the type says `receivedAt`, and
 * the notifications screen came back showing "Something broke". Two things
 * came out of it and only one was mine: the field name, fixed above — and the
 * fact that `/v1/account/notifications` is one of the endpoints with no
 * `parse`, so a backend that gets that field name wrong takes the screen down
 * instead of failing honestly at the fetch. See `wireChecks`.
 */
const PAYMENT_METHODS = [
  {
    id: 'pm-visa',
    type: 'card',
    label: 'Visa ending 4242',
    last4: '4242',
    expiry: '09/29',
    isDefault: true,
  },
  {
    id: 'pm-mc',
    type: 'card',
    label: 'Mastercard ending 5100',
    last4: '5100',
    expiry: '11/28',
    isDefault: false,
  },
];

const ADDRESSES = [
  {
    id: 'addr-1',
    label: 'Home',
    line1: '12 Oxford Road',
    suburb: 'Rosebank',
    city: 'Johannesburg',
    province: 'Gauteng',
    postalCode: '2196',
    isDefault: true,
  },
];

const NOTIFICATIONS = [
  {
    id: 'note-1',
    title: 'Your order is on its way',
    body: 'BBQ-4823 has left the kitchen.',
    receivedAt: '2026-09-07T09:00:00.000Z',
    read: false,
    category: 'order',
  },
];

const SUPPORT_TOPICS = [
  { id: 'topic-order', label: 'A problem with an order' },
  { id: 'topic-account', label: 'My account' },
];

const READS = {
  '/v1/account/payment-methods': PAYMENT_METHODS,
  '/v1/account/addresses': ADDRESSES,
  '/v1/account/notifications': NOTIFICATIONS,
  '/v1/support/topics': SUPPORT_TOPICS,
};

/**
 * The cases.
 *
 * `reaches` is the request the case is actually about, and a case that never
 * makes it fails rather than passing quietly — `audit:wire` learned that the
 * hard way when reachability tracking was silently dropped by a reformat and
 * every money case reported "asked for nothing" while showing green.
 *
 * `expect` is what the customer must be told. `forbidOnDrop` is the sentence
 * the app must NOT say when nobody knows whether the write happened.
 */
const CASES = [
  {
    name: 'deleting a saved card',
    route: '/account/payment-methods',
    reaches: 'DELETE /v1/account/payment-methods/pm-mc',
    press: async (page) => {
      await page.locator('[data-testid="payment-delete-pm-mc"]').first().click({ timeout: 8000 });
      await page.locator('[data-testid="dialog-confirm"]').first().click({ timeout: 8000 });
    },
    expect: /couldn’t delete that card/i,
  },
  {
    name: 'changing the default card',
    route: '/account/payment-methods',
    reaches: 'POST /v1/account/payment-methods/pm-mc/default',
    press: async (page) => {
      await page.locator('[data-testid="payment-default-pm-mc"]').first().click({ timeout: 8000 });
    },
    expect: /couldn’t change your default card/i,
  },
  {
    name: 'removing a saved address',
    route: '/checkout/address',
    reaches: 'DELETE /v1/account/addresses/addr-1',
    press: async (page) => {
      await page.locator('[data-testid="address-delete-addr-1"]').first().click({ timeout: 8000 });
      await page.locator('[data-testid="dialog-confirm"]').first().click({ timeout: 8000 });
    },
    expect: /couldn’t remove that address/i,
  },
  {
    /*
      Added after the fact. This round's own fixtures found it — fixture 10
      asserts that the writes already handled stay handled, and
      `checkout/address.tsx` turned out to have no `catch` anywhere in it. The
      save is on the checkout path and the customer has just typed a full
      street address into it.
    */
    name: 'saving a new address',
    route: '/checkout/address',
    reaches: 'POST /v1/account/addresses',
    press: async (page) => {
      await page.locator('[data-testid="address-add"]').first().click({ timeout: 8000 });
      const fill = async (field, value) =>
        page.locator(`[data-testid="address-field-${field}"]`).first().fill(value);
      await fill('label', 'Work');
      await fill('line1', '30 Baker Street');
      await fill('suburb', 'Rosebank');
      await fill('city', 'Johannesburg');
      await fill('postalCode', '2196');
      await fill('province', 'Gauteng');
      await page.locator('[data-testid="address-save"]').first().click({ timeout: 8000 });
    },
    expect: /couldn’t save that address/i,
  },
  {
    name: 'marking a notification read',
    route: '/account/notifications',
    reaches: 'POST /v1/account/notifications/note-1/read',
    press: async (page) => {
      await page.locator('[data-testid="notification-note-1"]').first().click({ timeout: 8000 });
    },
    expect: /couldn’t mark that as read/i,
  },
  {
    name: 'sending a support message',
    route: '/account/contact',
    reaches: 'POST /v1/support/messages',
    press: async (page) => {
      // A subject is required, so the form must be filled properly or the
      // case never reaches the network and passes for the wrong reason.
      await page.locator('[data-testid="contact-subject-0"]').first().click({ timeout: 8000 });
      await page.locator('[data-testid="contact-message"]').first().fill('My order never arrived.');
      await page.locator('[data-testid="contact-submit"]').first().click({ timeout: 8000 });
    },
    expect: /couldn’t send your message/i,
  },
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

function serveApp() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(APP_PORT, '127.0.0.1', () => resolve(server)));
}

let mode = '403';
let seen = [];

function serveApi() {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
      });
      res.end();
      return;
    }

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Date',
      'Content-Type': 'application/json',
    };

    // Reads answer normally: the point is a write that fails, not a screen
    // that never loads.
    if (req.method === 'GET' || req.method === 'HEAD') {
      const match = Object.keys(READS).find(
        (key) => pathname === key || pathname.startsWith(key + '/'),
      );
      res.writeHead(200, cors);
      res.end(JSON.stringify(match ? READS[match] : []));
      return;
    }

    seen.push(`${req.method} ${pathname}`);

    if (mode === 'drop') {
      // No reply at all — the case the app must not describe as "nothing has
      // changed", because the write may have been carried out.
      req.socket.destroy();
      return;
    }

    res.writeHead(403, cors);
    res.end(JSON.stringify({ code: 'forbidden', message: 'That is not allowed right now.' }));
  });
  return new Promise((resolve) => server.listen(API_PORT, '127.0.0.1', () => resolve(server)));
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

console.log('Building with the mock layer off, pointed at a stub that refuses every write…');
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

/** The one sentence a `drop` may never produce. */
const CLAIMS_NOTHING_CHANGED = /nothing has changed/i;

const findings = [];
const rows = [];

try {
  for (const testCase of CASES) {
    const result = { name: testCase.name };

    for (const refusal of ['403', 'drop']) {
      mode = refusal;
      seen = [];

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
          window.localStorage.setItem('bbq.auth.accessToken', 'at_writes');
          window.localStorage.setItem('bbq.auth.refreshToken', 'rt_writes');
        } catch {
          // A context that refuses storage is a browser problem, not an app one.
        }
      }, SIGNED_IN);

      const page = await context.newPage();
      const crashes = [];
      page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

      await page.goto(`http://localhost:${APP_PORT}${testCase.route}`, {
        waitUntil: 'networkidle',
        timeout: 45000,
      });
      await page.waitForTimeout(3000);

      /*
        Every one of these writes is a signed-in customer changing something.
        A seed that did not arrive turns all six into a tour of sign-in walls
        where no control is pressable — which this sweep would have reported as
        "could not press its own control", six times, without ever saying why.
      */
      const wrongState = await preconditionFailures(page, {
        where: `${testCase.name} (${refusal})`,
        signedIn: true,
      });
      for (const failure of wrongState) findings.push(failure);

      let pressed = true;
      await testCase.press(page).catch(() => {
        pressed = false;
      });
      await page.waitForTimeout(4000);

      const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
      const caught = await page.evaluate(() =>
        Boolean(document.querySelector('[data-testid="error-boundary"]')),
      );

      const reached = seen.some((request) => request === testCase.reaches);
      const told = testCase.expect.test(text);
      const overclaims = refusal === 'drop' && CLAIMS_NOTHING_CHANGED.test(text);

      if (!pressed) {
        findings.push(
          `${testCase.name} (${refusal}): could not press its own control, so this case ` +
            `proved nothing. Screen reads: ${text.slice(0, 120)}`,
        );
      } else if (!reached) {
        findings.push(
          `${testCase.name} (${refusal}): never sent ${testCase.reaches}, so the refusal was ` +
            `never exercised. The app sent: ${seen.join(', ') || '(nothing)'}`,
        );
      }

      if (crashes.length > 0 || caught) {
        findings.push(
          `${testCase.name} (${refusal}): crashed the screen — ${crashes[0] ?? 'caught by the error boundary'}`,
        );
      }

      if (pressed && reached && !told) {
        findings.push(
          `${testCase.name} (${refusal}): the write failed and the customer was told nothing. ` +
            `Screen reads: ${text.slice(0, 160)}`,
        );
      }

      if (overclaims) {
        findings.push(
          `${testCase.name} (drop): said "nothing has changed" about a write whose reply never ` +
            `came back — it may well have happened, and the app does not know`,
        );
      }

      result[refusal] =
        wrongState.length === 0 &&
        pressed &&
        reached &&
        told &&
        !overclaims &&
        crashes.length === 0 &&
        !caught;
      await context.close();
    }

    rows.push(result);
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log('\ncase                                  refused(403)  no reply(drop)');
for (const row of rows) {
  const mark = (value) => (value ? '     ✓      ' : '     ✗      ');
  console.log(`  ${row.name.padEnd(36)}${mark(row['403'])}${mark(row.drop)}`);
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(
    `\n${findings.length} write${findings.length === 1 ? '' : 's'} the customer was not told about.`,
  );
  process.exit(1);
}

console.log(
  `${CASES.length} writes refused two ways each, and the customer was told about every one.`,
);
