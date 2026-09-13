#!/usr/bin/env node
/**
 * A customer whose phone is not on the kitchen's clock.
 *
 * Every sweep in this repository pins `timezoneId: 'Africa/Johannesburg'`.
 * That is the right default and it means no sweep has ever seen the app from
 * anywhere else — which is not a rare place to be. A South African abroad
 * ordering dinner for their parents, somebody on a work trip tracking an order
 * they placed before the flight, and every desktop browser whose machine was
 * set up in UTC and never changed: all of them read this app on a clock that is
 * not SAST.
 *
 * The conversion itself is already right, and was done thoroughly. Every time
 * the app shows is the store's time: `storeClockAt` shifts by a fixed two
 * hours and reads the UTC fields, so `formatTime` gives a Johannesburg hour
 * wherever it runs. There is also a sentence for exactly this situation —
 * `clockNotice`, *"Times shown are South African time (SAST), not your
 * device's."*
 *
 * What nothing had checked is **where that sentence appears**. Seven surfaces
 * render an absolute clock time:
 *
 *     orders list · order tracking · confirmation · checkout
 *     notifications · the order timeline · the courier card
 *
 * and `clockNotice` is imported by two screens, neither of which is any of
 * them. `storeClock`'s own comment says "the scheduler and the order timeline
 * both show times a customer might otherwise check against their own phone" —
 * naming a surface it does not reach.
 *
 * So a customer in London opens their order and reads **"Ready at 18:00"**
 * while their own phone says 16:00, with nothing on the screen to say which of
 * the two is meant. They have an hour and a half to wonder about it.
 *
 * Three devices, one of them the control:
 *
 *   Africa/Johannesburg   the kitchen's own clock — the notice must appear
 *                         nowhere at all
 *   Europe/London         an hour or two out, which is the confusing amount
 *   Pacific/Auckland      ten hours and a different calendar day
 *
 * The control is what makes this measurable. A sweep that only visited foreign
 * zones could not tell "the notice is missing" from "this probe cannot see the
 * notice", and could not catch the opposite mistake either — a notice shown to
 * somebody in Cape Town, which would be the app apologising for nothing.
 *
 * Run: npm run audit:abroad
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-abroad');
const APP_PORT = 8331;
const BASE = `http://localhost:${APP_PORT}`;

/**
 * Lunchtime on a Wednesday in Johannesburg, fixed as an instant.
 *
 * The same moment everywhere, which is the point: only the device's zone
 * varies between runs, so any difference in what is drawn is about the zone
 * and nothing else.
 */
const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

/** The sentence, as `clockNotice` writes it. Matched loosely enough to survive
 *  a reword of the second half, tightly enough to mean this and not something
 *  else on the page. */
const NOTICE = /South African time \(SAST\)/i;

const DEVICES = [
  { name: 'Johannesburg', zone: 'Africa/Johannesburg', onStoreTime: true },
  { name: 'London', zone: 'Europe/London', onStoreTime: false },
  { name: 'Auckland', zone: 'Pacific/Auckland', onStoreTime: false },
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

function serve() {
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

/**
 * The clock is pinned to an instant, and the *zone* is left to the browser.
 *
 * This is the one sweep where that distinction matters. `timezoneId` on the
 * context is what varies; pinning `Date.now` keeps the moment fixed so the two
 * are not confounded. A version of this that also forced the zone would be
 * testing its own shim.
 */
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
 * What this screen says about time, and whether it says whose.
 *
 * The whole line, not the bare `HH:MM`. The first version returned just the
 * numbers, and the first run produced a puzzle it could not answer: London
 * reported 19:30 where Auckland reported 08:30, at the same pinned instant, on
 * what should be the same store time. A finding that says "shows 19:30" cannot
 * be checked; one that says "Scheduled · Thu, 3 Sep · 19:30" can.
 */
const TIME_PROBE = () => {
  const text = document.body.innerText;
  const lines = text.split('\n').map((line) => line.trim());
  const withTime = lines.filter((line) => /\b(?:[01]\d|2[0-3]):[0-5]\d\b/.test(line));
  return {
    text: text.slice(0, 4000),
    lines: [...new Set(withTime)].slice(0, 5),
    times: [
      ...new Set([...text.matchAll(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g)].map((m) => m[0])),
    ].slice(0, 4),
  };
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const findings = [];
const rows = [];

try {
  for (const device of DEVICES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: device.zone,
    });
    await context.addInitScript(pinClock(LUNCHTIME));

    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

    const go = (route) => page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });

    await go('/sign-in');
    await page.locator('[data-testid="sign-in-email"]').fill('thandi@example.co.za');
    await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
    await tap('sign-in-submit');
    await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });

    /*
      A real order, so the tracking screen and the timeline have something to
      draw. A seeded one would do for the list, and not for these two: the
      timeline only renders once an order has events, and a screen that draws
      nothing cannot be missing a notice.
    */
    await go('/product/golden-original');
    await page.waitForTimeout(900);
    await tap('product-add-to-cart');
    await page.waitForTimeout(500);

    await go('/checkout');
    await page.waitForTimeout(2000);
    const collection = page.locator('[data-testid="fulfilment-collection"]').first();
    if ((await collection.count()) > 0) {
      await collection.click({ timeout: 10000 });
      await page.waitForTimeout(1500);
    }

    // Checkout itself is one of the surfaces, so it is read before paying.
    const screens = [];
    const visit = async (where) => {
      await page.waitForTimeout(1400);
      const seen = await page.evaluate(TIME_PROBE);
      screens.push({
        where,
        lines: seen.lines,
        times: seen.times,
        notice: NOTICE.test(seen.text),
        showsTime: seen.times.length > 0,
      });
    };
    await visit('checkout');

    await tap('checkout-place-order');
    await page.waitForURL(/confirmation/, { timeout: 30000 });
    const orderPath = new URL(page.url()).pathname;
    const orderId = orderPath.split('/')[2] ?? '';

    await visit('confirmation');

    for (const [where, route] of [
      ['orders list', '/orders'],
      ['order tracking', `/order/${orderId}`],
      ['notifications', '/account/notifications'],
      ['schedule', '/checkout/schedule'],
    ]) {
      await go(route);
      await visit(where);
    }

    for (const failure of await preconditionFailures(page, {
      where: device.name,
      signedIn: true,
    })) {
      findings.push(failure);
    }
    if (crashes.length > 0) findings.push(`${device.name}: a screen crashed — ${crashes[0]}`);

    const withTime = screens.filter((s) => s.showsTime);
    if (withTime.length === 0) {
      findings.push(
        `${device.name}: not one screen showed a clock time, so this device measured ` +
          `nothing. Its result is an absence, not a pass.`,
      );
    }

    for (const screen of withTime) {
      if (!device.onStoreTime && !screen.notice) {
        findings.push(
          `${device.name} — ${screen.where}: never says whose clock these are —\n` +
            screen.lines.map((line) => `        “${line}”`).join('\n'),
        );
      }
      if (device.onStoreTime && screen.notice) {
        findings.push(
          `${device.name} — ${screen.where}: apologises for a timezone difference that does ` +
            `not exist on this device.`,
        );
      }
    }

    rows.push({
      name: device.name,
      onStoreTime: device.onStoreTime,
      withTime: withTime.length,
      explained: withTime.filter((s) => s.notice).length,
      screens,
    });

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\ndevice          screens showing a time   of those, saying whose');
for (const row of rows) {
  const want = row.onStoreTime ? 0 : row.withTime;
  const ok = row.explained === want;
  console.log(
    `  ${ok ? '✓' : '✗'} ${row.name.padEnd(14)} ${String(row.withTime).padStart(11)}` +
      `      ${String(row.explained).padStart(14)} of ${want}` +
      `${row.onStoreTime ? '   (control)' : ''}`,
  );
}

if (process.env.ABROAD_TEXT) {
  for (const row of rows) {
    console.log(`\n— ${row.name}`);
    for (const screen of row.screens) {
      if (screen.lines.length === 0) continue;
      console.log(`  ${screen.where}:`);
      for (const line of screen.lines) console.log(`    ${line}`);
    }
  }
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} screen(s) that show a time nobody can place.`);
  process.exit(1);
}

console.log('Every clock time this app shows says whose clock it is, and only when it has to.');
