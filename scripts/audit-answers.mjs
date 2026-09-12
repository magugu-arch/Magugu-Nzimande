#!/usr/bin/env node
/**
 * How many times the app asks after it has been told.
 *
 * `_layout.tsx` reasons about this exactly right, for one status:
 *
 *     Two retries for a transient failure, none for a 404. A not-found is an
 *     answer, not a hiccup: asking three times cannot make a delisted item or
 *     a closed campaign exist, and it costs the customer the backoff — seconds
 *     of spinner before a screen that was ready to tell them straight away.
 *
 * Every word of that is true of a **403** as well, and last round taught the
 * screens to read one. The retry policy still asks only `isNotFound`, so a
 * customer opening somebody else's order link waits through two pointless
 * round trips and their backoff before being told.
 *
 * And it is worse than pointless for a **429**. A rate limit is the server
 * asking the app to stop; answering it with two more requests is the one
 * response guaranteed to make the situation worse, and it happens at exactly
 * the moment the backend is least able to absorb it.
 *
 * So this counts. Each case refuses one path with one status and the stub
 * counts how many times the app asks for it:
 *
 *   404   1 — the case the policy was written for
 *   403   1 — the same answer, and the policy has never seen it
 *   429   1 — asking again is the thing the server just asked you not to do
 *   500   3 — the control. Transient, and the next attempt might work.
 *
 * The 500 is what keeps the others honest: this is not "stop retrying", it is
 * "stop retrying an answer".
 *
 * Run: npm run audit:answers
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-answers');
const APP_PORT = 8291;
const API_PORT = 8292;
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

const BASE_BODIES = {
  '/v1/menu': MENU,
  '/v1/loyalty/rewards': [],
  '/v1/loyalty/tiers': [
    { tier: 'bronze', name: 'Bronze', threshold: 0, pointsPerRand: 1, perks: [] },
  ],
  '/v1/loyalty/account': { memberId: 'm', pointsBalance: 9000, history: [] },
  '/v1/loyalty/vouchers': [],
  '/v1/promotions': [],
  '/v1/stores': [],
  '/v1/orders': [],
  '/v1/account/addresses': [],
  '/v1/account/payment-methods': [],
  '/v1/account/favourites': [],
  '/v1/account/notifications': [],
};

/** The path under test, the status it gets, and how often it was asked. */
let watched = null;
let status = 500;
let asked = 0;

/** The server's own words, which a screen is entitled to pass on. */
const MESSAGES = {
  403: 'That is not yours.',
  404: 'No such thing.',
  429: 'Too many requests. Wait a minute and try again.',
  500: 'Something broke on our side.',
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

    req.resume();

    if (watched !== null && pathname === watched) {
      asked += 1;
      const headers = { ...cors };
      // What a real rate limiter sends, so the app has something to quote if
      // it ever wants to. Exposed, or a browser hides it like it hides `Date`.
      if (status === 429) {
        headers['Retry-After'] = '60';
        headers['Access-Control-Expose-Headers'] = 'Date, Retry-After';
      }
      res.writeHead(status, headers);
      res.end(JSON.stringify({ code: String(status), message: MESSAGES[status] ?? 'No.' }));
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
      id: 'user-answers',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      email: 'answers@example.co.za',
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

/*
  One screen, four answers.

  The same route every time so the only thing that varies is the status —
  otherwise a difference in attempts could be a difference in how many queries
  a screen happens to run.
*/
const ROUTE = '/order/order-answers';
const WATCHED = '/v1/orders/order-answers';

const CASES = [
  {
    name: 'a 404 — the case the policy was written for',
    status: 404,
    attempts: 1,
    control: true,
  },
  {
    name: 'a 403 — the same kind of answer',
    status: 403,
    attempts: 1,
    why: 'asking three times cannot make somebody else’s order yours',
  },
  {
    name: 'a 429 — the server asking the app to stop',
    status: 429,
    attempts: 1,
    why: 'two more requests is the one response guaranteed to make it worse',
  },
  {
    name: 'a 500 — transient, and worth asking again',
    status: 500,
    attempts: 3,
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
    watched = WATCHED;
    status = testCase.status;
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
        window.localStorage.setItem('bbq.auth.accessToken', 'at_answers');
        window.localStorage.setItem('bbq.auth.refreshToken', 'rt_answers');
      } catch {
        // A context that refuses storage is a browser problem, not an app one.
      }
    }, SIGNED_IN);

    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle', timeout: 45000 });
    /*
      Long enough for both retries and their backoff to have happened.

      TanStack's default backoff doubles from a second, so two retries land
      inside about three seconds; ten is generous and the cost of being wrong
      here is a case that reports one attempt because it stopped watching.
    */
    await page.waitForTimeout(10000);

    const wrongState = await preconditionFailures(page, {
      where: testCase.name,
      signedIn: true,
    });
    for (const failure of wrongState) findings.push(failure);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const caught = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="error-boundary"]')),
    );

    if (crashes.length > 0 || caught) {
      findings.push(
        `${testCase.name}: crashed the screen — ${crashes[0] ?? 'caught by the error boundary'}`,
      );
    }
    if (asked !== testCase.attempts) {
      findings.push(
        `${testCase.name}: asked ${asked} time(s), should be ${testCase.attempts}` +
          (testCase.why ? ` — ${testCase.why}` : ''),
      );
    }

    rows.push({
      name: testCase.name,
      asked,
      want: testCase.attempts,
      control: testCase.control === true,
      ok: asked === testCase.attempts && crashes.length === 0 && !caught,
    });
    if (process.env.ANSWERS_TEXT) console.log(`\n— ${testCase.name}\n  ${text.slice(0, 200)}`);
    await context.close();
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log('\ncase                                            asked  wanted');
for (const row of rows) {
  console.log(
    `  ${row.ok ? '✓' : '✗'} ${row.name.padEnd(44)} ${String(row.asked).padStart(3)}` +
      `   ${String(row.want).padStart(3)}${row.control ? '   (control)' : ''}`,
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} answer(s) the app argues with.`);
  process.exit(1);
}

console.log(`${CASES.length} answers, and the app asked again only where that could help.`);
