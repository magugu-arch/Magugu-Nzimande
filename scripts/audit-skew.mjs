#!/usr/bin/env node
/**
 * A phone whose clock is simply wrong.
 *
 * Every sweep in this repository pins the browser's clock to a chosen instant
 * so the run is repeatable. To the app, a pinned clock is indistinguishable
 * from a correct one — so in the whole history of this project the app has
 * never once been driven on a device that was lying about the time. It is a
 * state the code has always supported: a phone's clock is a setting, not a
 * fact. It resets when the battery dies, it can be set by hand, and a device
 * that has lost its network time source drifts.
 *
 * This drives the same build against the same stub server, at the same true
 * instant, from four phones — one right, three wrong — and asserts that they
 * are all told the same thing. The server's `Date` header is the truth, and it
 * is a header the response was already carrying; see `utils/appClock`.
 *
 * ## The instant, and why this one
 *
 * The true time is a Monday at 12:00 SAST, when every branch is trading. The
 * broken phones are nine hours behind (03:00 — the middle of the night, every
 * kitchen shut) and thirteen hours ahead (01:00 the next morning, likewise).
 * Both land on "closed" if the app believes them, which is order BBQ-4823 for
 * the third time and through a third door: first a stale `isOpenNow` flag,
 * then the device's timezone, now the device's clock.
 *
 * The third phone is only forty minutes out — not enough to change whether a
 * branch is open, but more than enough to move which slots the scheduler
 * offers and to push a card in its final month over the line at the end of a
 * month. It is there because a defect that only shows at nine hours is one
 * nobody meets.
 *
 * ## What it found
 *
 * Three things, and two of them were in the app rather than in this script.
 *
 * 1. **`Date` is not a CORS-safelisted response header.** Documented in full
 *    beside the stub below. A web build talking to an API on another origin
 *    sees `null` unless the server sends `Access-Control-Expose-Headers:
 *    Date`. Native is unaffected. Recorded in RELEASE_READINESS as a backend
 *    requirement rather than worked around here.
 *
 * 2. **The correction arrived and nothing re-rendered.** `/checkout/store`
 *    passed while `/checkout/schedule` did not, and the difference is that the
 *    store list arrives *after* the response carrying the correction. The
 *    schedule screen builds its slot grid in a `useMemo` over `useNow`'s
 *    clock, and `useNow` ticked on an interval and on foregrounding — neither
 *    of which is "the clock was corrected". So a phone thirteen hours out
 *    rendered a grid for the wrong day with the right time already in memory.
 *    The same defect `useNow` exists to prevent, one level up.
 *
 * 3. **The one request the app never observed was the one it makes most.**
 *    With the re-render fixed, `/checkout/schedule` still never corrected —
 *    and the reason was that it fetches nothing at all. Its three requests per
 *    page load were all `HEAD /health`, the connectivity probe, which does not
 *    go through `apiClient` and so never reached the clock. That probe runs on
 *    every screen on a timer whether or not anything else is loading; it is
 *    the earliest and most reliable sight of the server's clock the app gets,
 *    and it was the single request being thrown away.
 *
 * Run: npm run audit:skew
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-skew');
const APP_PORT = 8201;
const API_PORT = 8202;

/** The true instant: Monday 7 September 2026, 12:00 SAST. Every branch trading. */
const TRUE_NOW = Date.parse('2026-09-07T12:00:00+02:00');

const PHONES = [
  { name: 'a correct clock', driftMs: 0, notice: false },
  { name: 'nine hours behind', driftMs: -9 * 3_600_000, notice: true },
  { name: 'thirteen hours ahead', driftMs: 13 * 3_600_000, notice: true },
  { name: 'forty minutes fast', driftMs: 40 * 60_000, notice: true },
];

const ROUTES = ['/checkout/store', '/checkout/schedule'];

/**
 * The device clock, moved — and `Date.now` with it.
 *
 * `appNow()` reads `Date.now()`, and the API client stamps `sentAt` and
 * `receivedAt` from it too, so moving only the constructor would leave the
 * measurement reading a clock the app does not use and the whole sweep would
 * prove nothing.
 */
const skewClock = (driftMs) => `
  (function () {
    var drift = ${driftMs};
    var base = ${TRUE_NOW} + drift;
    var Real = Date;
    var started = Real.now();
    function deviceNow() { return base + (Real.now() - started); }
    var Fake = class extends Real {
      constructor(...args) { super(...(args.length ? args : [deviceNow()])); }
      static now() { return deviceNow(); }
    };
    Fake.parse = Real.parse;
    Fake.UTC = Real.UTC;
    Date = Fake;
  })();
`;

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

/**
 * A stub backend whose only interesting property is that its clock is right.
 *
 * It answers every path with the seeded shapes the app needs to render these
 * two screens, and stamps `Date` from `TRUE_NOW` — which is what a real server
 * does for free and what the app had been discarding.
 *
 * Node sets a `Date` header automatically from the machine's clock; that is
 * overridden here, because the machine running this sweep is not pretending to
 * be 2026 and the app would then measure a two-year skew and be right about it.
 *
 * ## `Access-Control-Expose-Headers`, which this sweep found the hard way
 *
 * The first run reported twelve findings and every one of them was real —
 * three broken phones being shown three different worlds — with the correction
 * doing nothing at all. The cause was not in the app.
 *
 * **`Date` is not a CORS-safelisted response header.** The safelist is
 * `Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`,
 * `Expires`, `Last-Modified` and `Pragma`; everything else is invisible to
 * `headers.get()` on a cross-origin response unless the server names it in
 * `Access-Control-Expose-Headers`. The app is served from one port and the
 * stub from another, so the browser was hiding the header and
 * `noteServerTime` was correctly doing nothing with the `null` it got.
 *
 * That is a real deployment requirement rather than a quirk of this script,
 * and it does not apply evenly:
 *
 *   - **native iOS and Android** are not subject to CORS at all, so the
 *     header is readable and the correction works with no server change.
 *   - **the web build** needs the API to send
 *     `Access-Control-Expose-Headers: Date` whenever the API is on a
 *     different origin from the app.
 *
 * Recorded in RELEASE_READINESS as a backend requirement rather than worked
 * around here: there is no client-side substitute, and inventing one — an
 * endpoint that returns the time in its body — would be designing somebody
 * else's API.
 */
const STORES = [
  {
    id: 'store-rosebank',
    name: 'bb.q Chicken Rosebank',
    addressLine: 'The Zone @ Rosebank, 177 Oxford Rd',
    suburb: 'Rosebank',
    city: 'Johannesburg',
    province: 'Gauteng',
    phone: '011 447 2200',
    latitude: -26.1465,
    longitude: 28.0436,
    distanceKm: 2,
    openingHours: Array.from({ length: 7 }, (_, day) => ({
      day,
      opensAt: '10:00',
      closesAt: '22:00',
    })),
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 20,
    isOpenNow: true,
  },
];

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

    if (process.env.SKEW_DEBUG) console.log(`      -> ${req.method} ${pathname}`);
    const body = pathname.startsWith('/v1/stores') ? STORES : [];

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Without this the browser hides `Date` from the app and the whole
      // correction silently does nothing. See the note above.
      'Access-Control-Expose-Headers': 'Date',
      // The whole point of the sweep.
      Date: new Date(TRUE_NOW).toUTCString(),
    });
    res.end(JSON.stringify(body));
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

console.log('Building with the mock layer off, pointed at a stub backend…');
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

const NOTICE = /device’s clock is about/;

const findings = [];
const seen = new Map();

try {
  for (const phone of PHONES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Johannesburg',
    });
    await context.addInitScript(skewClock(phone.driftMs));
    const page = await context.newPage();

    /*
      Counted per page load, on the browser side.

      The first version of this counted on the server and never reset, so after
      the very first request the guard could not fire again and the check was
      decorative — which is how the schedule screen's real problem stayed
      hidden behind a passing guard for two runs.
    */
    let apiCalls = 0;
    page.on('request', (request) => {
      if (request.url().startsWith(`http://localhost:${API_PORT}`)) apiCalls += 1;
    });

    for (const route of ROUTES) {
      apiCalls = 0;
      await page.goto(`http://localhost:${APP_PORT}${route}`, {
        waitUntil: 'networkidle',
        timeout: 45000,
      });
      await page.waitForTimeout(4000);

      const body = await page.evaluate(() => document.body.innerText);
      const noticed = NOTICE.test(body);

      /*
        Structured rather than body text, and for the reason `audit:clock`
        records: a `FlatList` is virtualised, the notice is one more line of
        layout, and a phone that shows it mounts a few fewer rows. Comparing
        the rendered text between phones would report that as a disagreement
        about the time, which it is not.
      */
      const shown = await page.evaluate(() => {
        const textOf = (prefix) =>
          Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`)).map((node) =>
            node.innerText.replace(/\s+/g, ' ').trim(),
          );
        return {
          days: textOf('schedule-day-'),
          slots: textOf('schedule-slot-'),
          cards: textOf('store-card-'),
        };
      });

      if (noticed !== phone.notice) {
        findings.push(
          `${phone.name} on ${route}: ${noticed ? 'showed' : 'did not show'} the clock notice, ` +
            (phone.notice
              ? 'so a customer is reading times that do not match their own phone with no explanation'
              : 'so a customer whose clock is fine is being told it is wrong'),
        );
      }

      /*
        A route that never spoke to the server cannot have been corrected, and
        comparing it across phones would be measuring the device clock and
        calling it a finding. Said out loud rather than assumed: the first run
        of this sweep could not tell "the correction is broken" from "there was
        nothing to correct from".
      */
      if (apiCalls === 0) {
        findings.push(
          `${route} on ${phone.name}: reached the screen without a single request, so ` +
            `nothing on it could have been corrected — this case proves nothing`,
        );
      }

      if (process.env.SKEW_DEBUG) {
        console.log(`    [${phone.name}] ${route}: ${apiCalls} api calls, notice=${noticed}`);
      }

      const previous = seen.get(route);
      if (previous === undefined) {
        seen.set(route, { phone: phone.name, shown });
        continue;
      }

      const disagree = (what, mine, theirs) => {
        const at = mine.findIndex((value, index) => value !== theirs[index]);
        findings.push(
          `${route}: ${phone.name} and ${previous.phone} disagree (${what}).\n` +
            `      ${previous.phone.padEnd(22)} ${theirs.slice(Math.max(0, at - 1), at + 3).join(' | ') || '(nothing)'}\n` +
            `      ${phone.name.padEnd(22)} ${mine.slice(Math.max(0, at - 1), at + 3).join(' | ') || '(nothing)'}`,
        );
      };

      for (const what of ['days', 'cards']) {
        if (shown[what].join(' ') !== previous.shown[what].join(' ')) {
          disagree(what, shown[what], previous.shown[what]);
        }
      }

      const common = Math.min(shown.slots.length, previous.shown.slots.length);
      if (
        shown.slots.slice(0, common).join(' ') !== previous.shown.slots.slice(0, common).join(' ')
      ) {
        disagree('slots', shown.slots, previous.shown.slots);
      }
    }

    console.log(`  ✓ ${phone.name}`);
    await context.close();
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(
    `\n${findings.length} thing${findings.length === 1 ? '' : 's'} a wrong clock changed.`,
  );
  process.exit(1);
}

console.log(
  `${PHONES.length} device clocks, ${ROUTES.length} routes, one true instant — ` +
    `and the three broken phones were told what the right one was told.`,
);
