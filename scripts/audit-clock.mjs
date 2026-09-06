#!/usr/bin/env node
/**
 * The same second, seen from six phones.
 *
 * Every browser sweep in this repository pins `timezoneId:
 * 'Africa/Johannesburg'`, and every unit suite runs under a UTC runner. So the
 * app had been driven on exactly two clocks: the kitchen's, and one that was
 * two hours out in the same direction as the code that read it. A customer
 * whose phone is set anywhere else is a state the app has always supported and
 * nothing has ever put it in.
 *
 * The invariant this checks is the whole of it:
 *
 *   **Two customers looking at the same branch at the same second must be
 *   shown the same times.**
 *
 * Not similar times, not converted times — the same string. Every time this
 * app displays is a claim about a South African kitchen: the hours it trades,
 * the fifteen-minute slot the customer picked, the day the order was placed.
 * None of those change with where the phone is, so none of them may.
 *
 * The clock is pinned to one instant and only `timezoneId` varies, so any
 * difference in what comes back is the timezone and nothing else. The one line
 * that is *allowed* to differ is the notice saying the phone and the kitchen
 * disagree, which is the point of it — see `utils/storeClock`.
 *
 * ## What it found, before the fix
 *
 * Run against the previous `utils/datetime` and `utils/tradingHours` — the
 * versions that read the device clock — at 03:00 on a Sunday in Johannesburg:
 *
 *   America/Los_Angeles   every branch badged **"Open now"**, at three in the
 *   Pacific/Auckland      morning, with the kitchens shut. That is order
 *                         BBQ-4823 exactly: the failure `isTradingNow` was
 *                         written to prevent, arriving again through the one
 *                         input nobody had varied.
 *
 *   America/Sao_Paulo     "Open now · 11:00 – 00:30" on the V&A card, and
 *                         Menlyn Park reported "Temporarily closed" where
 *                         Johannesburg said "Closed" — even the *reason* a
 *                         branch is shut changed with where the phone was.
 *
 *   the slot grid          opened at 18:45 in Los Angeles and 13:45 in
 *                          Auckland instead of 10:00, and Los Angeles was
 *                          offered a whole day fewer.
 *
 * Seven findings across three of the six zones. Every existing test and sweep
 * was green at the same time, because all of them were pinned to
 * `Africa/Johannesburg` or run under a UTC runner that the code agreed with.
 *
 * Run: npm run audit:clock
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-clock');
const PORT = 8199;
const BASE = `http://localhost:${PORT}`;

/**
 * A Sunday, at three in the morning in Johannesburg.
 *
 * Chosen so the phones disagree about the *day* and not merely the hour. At
 * this instant it is still Saturday evening in Los Angeles and São Paulo, and
 * already well into Sunday in Auckland — so a screen laid out on the device's
 * calendar reads a different row of the timetable for each of them, which is
 * the failure worth catching. An afternoon fixture would have every phone
 * agreeing on the weekday and would pass with the defect intact.
 */
const SUNDAY_SMALL_HOURS = '2026-09-06T03:00:00+02:00';

/**
 * The device zones, picked for the ways they break arithmetic rather than for
 * variety: one behind by a whole day boundary, one ahead of it, one at a
 * quarter-hour offset, one that observes daylight saving, and the kitchen's
 * own as the control.
 */
const ZONES = [
  { id: 'Africa/Johannesburg', why: 'the control — must show no notice at all' },
  { id: 'Europe/London', why: 'an hour behind, and on summer time at this date' },
  { id: 'America/Los_Angeles', why: 'nine behind — still Saturday evening there' },
  { id: 'America/Sao_Paulo', why: 'five behind — also still Saturday' },
  { id: 'Asia/Kathmandu', why: '+05:45, which whole-hour arithmetic gets wrong' },
  { id: 'Pacific/Auckland', why: 'ten ahead — Sunday afternoon already' },
];

/**
 * The routes that state a time, and nothing else.
 *
 * `/checkout/schedule` is the slot grid and the day chips; `/checkout/store`
 * is the branch cards, whose "Open now" badge and printed hours are the pair
 * that has to agree — see the write-up in `utils/tradingHours` about a card
 * reading "Open now · 11:00 – 22:00" fifteen minutes before last orders.
 */
const ROUTES = ['/checkout/schedule', '/checkout/store'];

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

/** The one line that is allowed to differ between zones, and must. */
const NOTICE = /South African time \(SAST\)/;

const findings = [];
const seen = new Map();

try {
  for (const zone of ZONES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: zone.id,
    });
    await context.addInitScript(pinClock(SUNDAY_SMALL_HOURS));
    const page = await context.newPage();

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2500);

      const body = await page.evaluate(() => document.body.innerText);
      const noticed = NOTICE.test(body);

      /*
        Structured, not the body text — because a `FlatList` is virtualised.

        The first version compared `document.body.innerText` between zones and
        reported five disagreements that were entirely this script's own. The
        notice is one more line of layout, so on a phone abroad the slot list
        had a little less room and rendered a few fewer rows; the two strings
        shared an identical prefix and the shorter one simply stopped. Every
        time on screen agreed. The sweep was measuring how much of a scrolling
        list happened to be mounted.

        So the day chips and the branch cards are compared exactly — there are
        few enough of those that all of them render — and the slot grid is
        compared as a sequence, where the shorter must be a prefix of the
        longer. A slot that differed would break the prefix at that point; a
        slot that is merely not mounted yet cannot.
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

      /*
        The notice, checked as a fact about the device rather than as a string
        the app happens to print. `Intl` is the browser's own answer to "where
        is this phone", so it cannot agree with the app by construction the way
        a hardcoded list of zones would.
      */
      const offsetMinutes = await page.evaluate(() => -new Date().getTimezoneOffset());
      const onStoreTime = offsetMinutes === 120;

      if (noticed !== !onStoreTime) {
        findings.push(
          `${zone.id} on ${route}: ${noticed ? 'showed' : 'did not show'} the SAST notice, ` +
            `but the device is at UTC${offsetMinutes >= 0 ? '+' : ''}${offsetMinutes / 60}h — ` +
            (onStoreTime
              ? 'a customer in South Africa is being told their own clock is wrong'
              : 'a customer abroad is reading store times as if they were their own'),
        );
      }

      const previous = seen.get(route);
      if (previous === undefined) {
        if (shown.days.length + shown.slots.length + shown.cards.length === 0) {
          findings.push(
            `${route}: rendered nothing this sweep can read on ${zone.id}, so every ` +
              `later zone is being compared against an empty screen`,
          );
        }
        seen.set(route, { zone: zone.id, shown });
        continue;
      }

      /*
        Reported as the first place two zones part company, rather than as two
        walls of text: these screens are long, a real difference is one hour in
        one chip, and a diff nobody reads is a finding nobody acts on.
      */
      const disagree = (what, mine, theirs) => {
        const at = mine.findIndex((value, index) => value !== theirs[index]);
        findings.push(
          `${route}: ${zone.id} and ${previous.zone} disagree about the same second (${what}).\n` +
            `      ${previous.zone.padEnd(20)} ${theirs.slice(Math.max(0, at - 2), at + 4).join(' | ')}\n` +
            `      ${zone.id.padEnd(20)} ${mine.slice(Math.max(0, at - 2), at + 4).join(' | ')}`,
        );
      };

      for (const what of ['days', 'cards']) {
        if (shown[what].join(' ') !== previous.shown[what].join(' ')) {
          disagree(what, shown[what], previous.shown[what]);
        }
      }

      // The prefix rule, for the one list long enough to be virtualised.
      const mine = shown.slots;
      const theirs = previous.shown.slots;
      const common = Math.min(mine.length, theirs.length);
      if (mine.slice(0, common).join(' ') !== theirs.slice(0, common).join(' ')) {
        disagree('slots', mine, theirs);
      }
    }

    console.log(`  ✓ ${zone.id.padEnd(22)} ${zone.why}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(
    `\n${findings.length} disagreement${findings.length === 1 ? '' : 's'} about what time it is.`,
  );
  process.exit(1);
}

console.log(
  `${ZONES.length} device timezones, ${ROUTES.length} routes, one instant — ` +
    `and the app told all six phones the same thing.`,
);
