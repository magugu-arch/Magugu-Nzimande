import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const here = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(here);
    return /\.tsx?$/.test(entry.name) ? [here] : [];
  });
}

/*
  ───────────────────────────────────────────────────────────────────────────
  A customer whose phone is not on the kitchen's clock.

  Every sweep in this repository pinned `timezoneId: 'Africa/Johannesburg'`.
  The right default, and it meant no sweep had ever seen the app from anywhere
  else — which is not a rare place to be: a South African abroad ordering
  dinner for their parents, somebody tracking an order from a work trip, and
  every desktop browser whose machine was set up in UTC and never changed.

  `npm run audit:abroad` drives the same journey from three devices. It was
  written to find one thing and found a better one.

  ── What it was looking for ──

  Every time the app shows is the store's time, and there is a sentence for
  saying so — `clockNotice`. Nothing had checked *where* it appears. From
  Johannesburg it appeared nowhere, correctly. From London and Auckland it
  appeared on one screen of three: the orders list and the notifications drew
  `Scheduled · Thu, 10 Sep · 18:30` with nothing to place it.

  ── What it found instead ──

  The two foreign devices reported **different clock times for the same order**
  at the same pinned instant — 19:30 in London, 08:30 in Auckland. Which is
  impossible if everything is store time, and it was not: three places built or
  read a calendar on the *device's* clock.

  The one that mattered is `cardHasExpired`. It built "the first instant of the
  month after the one on the card" with `new Date(year, month, 1)` — local — so
  a phone in Auckland put the boundary ten hours early and **refused a card
  marked 09/26 from two in the afternoon on the 30th of September**. The app's
  own `storeClock` note names that exact consequence for a device whose clock
  is *wrong*; nobody had asked about the wrong *zone*.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * Run an expression in a real subprocess under a chosen `TZ`.
 *
 * Jest fixes the process timezone before any test runs and `process.env.TZ`
 * cannot be changed usefully afterwards — Node caches the zone on first use.
 * A fixture that re-implemented the date maths to "simulate" another zone
 * would be a mock agreeing with itself, which is the failure this repository
 * keeps finding. So the real module runs in a real process in a real zone.
 */
function inZone(tz: string, expression: string): unknown {
  const program = [
    "import { cardHasExpired } from './src/features/checkout/cardExpiry';",
    "import { inBirthdayMonth } from './src/features/rewards/birthday';",
    `process.stdout.write(JSON.stringify(${expression}));`,
  ].join('\n');

  const out = execFileSync('npx', ['tsx', '-e', program], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: tz },
  });
  return JSON.parse(out) as unknown;
}

/**
 * FIXTURE 1 — a card runs out on the kitchen's calendar, not the customer's.
 */
describe('1 — when a card expires', () => {
  /*
    23:30 SAST on the last day of September 2026 — half an hour of validity
    left on a card marked 09/26, wherever the customer is standing.

    In Auckland that instant is 09:30 on the 1st of October local, so the old
    `new Date(year, month, 1)` boundary had already passed and the card was
    refused. In Los Angeles it is 14:30 on the 30th of September, and the card
    stayed valid for another nine hours after it should have died.
  */
  const HALF_HOUR_LEFT = Date.UTC(2026, 8, 30, 21, 30);
  const HALF_HOUR_GONE = Date.UTC(2026, 8, 30, 22, 30);

  const ZONES = ['Africa/Johannesburg', 'Pacific/Auckland', 'America/Los_Angeles', 'UTC'];

  it.each(ZONES)('is still good half an hour before midnight SAST, in %s', (tz) => {
    const answer = inZone(tz, `cardHasExpired('09/26', new Date(${HALF_HOUR_LEFT}))`);
    expect(answer).toBe(false);
  });

  it.each(ZONES)('has run out half an hour after midnight SAST, in %s', (tz) => {
    const answer = inZone(tz, `cardHasExpired('09/26', new Date(${HALF_HOUR_GONE}))`);
    expect(answer).toBe(true);
  });

  it('is the same answer in every zone, which is the whole point', () => {
    const answers = ZONES.map((tz) =>
      inZone(tz, `cardHasExpired('09/26', new Date(${HALF_HOUR_LEFT}))`),
    );
    expect(new Set(answers).size).toBe(1);
  });

  it('asks the store clock rather than building a local Date', () => {
    const source = code('src/features/checkout/cardExpiry.ts');

    expect(source).toMatch(/instantAtStoreTime\(\{ year, month, date: 1 \}\)/);
    expect(source).not.toMatch(/new Date\(year, month, 1/);
  });

  it('still refuses to guess at an expiry it cannot read', () => {
    // The rule that was already right and must stay right: an unparseable or
    // absent expiry is not an expired card, because refusing a payment over a
    // format nobody anticipated is worse than letting the gateway decide.
    expect(inZone('Pacific/Auckland', `cardHasExpired('nonsense', new Date(0))`)).toBe(false);
    expect(inZone('Pacific/Auckland', `cardHasExpired(undefined, new Date(0))`)).toBe(false);
  });
});

/**
 * FIXTURE 2 — the birthday month, where the file had already made the argument.
 */
describe('2 — whose month it is', () => {
  /* 23:30 SAST on 31 August: still August in Johannesburg, already September
     in Auckland. The reward belongs to whoever the programme says it does. */
  const LAST_HALF_HOUR_OF_AUGUST = Date.UTC(2026, 7, 31, 21, 30);

  it.each(['Africa/Johannesburg', 'Pacific/Auckland', 'America/Los_Angeles'])(
    'is August for an August birthday, in %s',
    (tz) => {
      const answer = inZone(
        tz,
        `inBirthdayMonth('1994-08-14', new Date(${LAST_HALF_HOUR_OF_AUGUST}))`,
      );
      expect(answer).toBe(true);
    },
  );

  it('completes an argument the file had already written', () => {
    /*
      The doc above `inBirthdayMonth` is careful that the *birth date* must not
      be read through a local getter — and then read `now` through one. So the
      customer's side was zone-proof and the calendar's side was not.
    */
    const source = code('src/features/rewards/birthday.ts');

    expect(source).toMatch(/month === storeClockAt\(now\)\.month/);
    expect(source).not.toMatch(/now\.getMonth\(\)/);
  });
});

/**
 * FIXTURE 3 — the exception, named so it does not read as an oversight.
 */
describe('3 — the one clock that is the device’s', () => {
  it('greets the person holding the phone, on their clock', () => {
    expect(code('src/store/authStore.ts')).toMatch(/const hour = now\.getHours\(\);/);
  });

  it('says why, beside it', () => {
    const source = read('src/store/authStore.ts');

    expect(source).toMatch(/deliberately reads the \*\*device's\*\* clock/);
    expect(source).toMatch(/"Good evening" is not a fact about the\s+\* kitchen/);
  });

  it('is the only one left in the app', () => {
    /*
      Derived, so a fourth device-clock read cannot appear quietly. `storeClock`
      owns two by design — they are questions *about* the device — and the
      greeting is the third and last.
    */
    const LOCAL_READ =
      /\.(getHours|getMinutes|getDate|getMonth|getFullYear|getDay)\(\)|\.(setHours|setDate|setMonth)\(/;

    const offenders = sourceFiles()
      .filter((file) => file !== 'src/utils/storeClock.ts')
      .filter((file) => LOCAL_READ.test(code(file).replace(/getUTC\w+\(\)/g, '')));

    expect(offenders.sort()).toEqual(['src/store/authStore.ts']);
  });
});

/**
 * FIXTURE 4 — where the app says whose clock it is.
 */
describe('4 — saying so, once, in one voice', () => {
  it('is a component rather than a copy of the sentence per screen', () => {
    // The wording is a promise about how the whole app reports time. Three
    // screens each writing their own version is three chances to differ.
    const note = code('src/components/system/StoreTimeNote.tsx');

    expect(note).toMatch(/clockNotice\(/);
    expect(note).toMatch(/if \(notice === null\) return null;/);
  });

  it('appears on every screen that draws a clock time', () => {
    for (const file of [
      'src/app/(tabs)/orders.tsx',
      'src/app/account/notifications.tsx',
      'src/app/checkout/schedule.tsx',
    ]) {
      expect(code(file)).toMatch(/<StoreTimeNote/);
    }
  });

  it('leaves no screen writing the sentence out by hand', () => {
    const inline = sourceFiles()
      .filter((file) => file !== 'src/components/system/StoreTimeNote.tsx')
      .filter((file) => code(file).includes('clockNotice'));

    // `checkout/store.tsx` is the one remaining direct caller: it shows the
    // notice beside a trading-hours card rather than beside a clock time, so
    // it is a different sentence in a different place.
    expect(inline.sort()).toEqual(['src/app/checkout/store.tsx', 'src/utils/storeClock.ts']);
  });

  it('shows nothing at all in South Africa', () => {
    // The control case, and the opposite mistake: an app apologising to
    // somebody in Cape Town for a difference that does not exist.
    expect(code('src/utils/storeClock.ts')).toMatch(/deviceIsOnStoreTime\(now\)\s*\?\s*null/);
  });
});

/**
 * FIXTURE 5 — the sweep, and the baseline it exposed.
 */
describe('5 — audit:abroad', () => {
  const audit = read('scripts/audit-abroad.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:abroad']).toBe('node scripts/audit-abroad.mjs');
  });

  it('carries the kitchen’s own zone as the control', () => {
    expect(audit).toMatch(/zone: 'Africa\/Johannesburg', onStoreTime: true/);
    expect(audit).toMatch(/apologises for a timezone difference that does/);
  });

  it('pins the instant and varies only the zone', () => {
    // Otherwise a difference in what is drawn could be a difference in when.
    expect(audit).toMatch(/only the device's zone\s*\n \* varies between runs/);
  });

  it('reports the line, not the bare number', () => {
    /*
      The correction this sweep needed, and the reason it found anything. Its
      first version returned `19:30` and `08:30` with no context — a puzzle it
      could not answer. The line around them named the order, and the order
      named the bug.
    */
    expect(audit).toMatch(/const withTime = lines\.filter/);
    expect(audit).toMatch(/cannot\s*\n \* be checked; one that says/);
  });

  it('refuses to call an empty screen a pass', () => {
    expect(audit).toMatch(/Its result is an absence, not a pass/);
  });
});

/**
 * FIXTURE 7 — a sweep that was intermittently wrong about itself.
 */
describe('7 — the flake this round found by accident', () => {
  const screens = read('scripts/audit-screens.mjs');

  it('waits for what a route is expected to show before judging it', () => {
    /*
      `audit:screens` reported "shows no Live position reported" on
      `/order/order-4854`, once, and was green on the next two runs with the
      same code. 700ms after `networkidle` is enough for every screen except
      the one with the deepest chain — order, then courier job, each with the
      mock's deliberate latency — and on a busy machine that lands late.

      A finding about the sweep's own timing is the worst kind it can produce:
      a red run that goes green when you look again teaches everybody to look
      again, and the next real finding is the one nobody believes.
    */
    expect(screens).toMatch(/const expecting = MUST_SHOW\[route\];/);
    expect(screens).toMatch(/const deadline = Date\.now\(\) \+ 4000;/);
    expect(screens).toMatch(/report it missing only when it genuinely never arrives/);
  });

  it('still fails when the text never arrives at all', () => {
    // The bound matters as much as the wait. A poll with no deadline would
    // turn a real missing-content finding into a hang.
    expect(screens).toMatch(/if \(expecting\.test\(text\) \|\| Date\.now\(\) > deadline\) break;/);
  });
});

/**
 * FIXTURE 6 — the warning that survived two rounds.
 */
describe('6 — a baseline nothing was holding', () => {
  it('fails the build on a warning, not only on an error', () => {
    /*
      This repository has claimed a zero-warning lint baseline for several
      rounds, and `eslint .` exits 0 with warnings — so when round 30 left two
      `react-hooks/exhaustive-deps` warnings behind, the gate passed, and two
      audits reported "lint clean" because the gate said so.

      The warnings were real: an effect had been changed to read `lines` while
      its dependency array still named `lines.length`. Both are fixed. This is
      the reason they were able to survive.
    */
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['lint']).toContain('--max-warnings=0');
  });

  it('has the effects depending on what they actually read', () => {
    // The two *effects*. The purchase event further down `checkout` calls
    // `cartItemCount(lines)` inside a callback, where there is no dependency
    // array to disagree with and nothing to fix.
    expect(code('src/app/cart/index.tsx')).toMatch(/\}, \[itemCount, totals\.total\]\);/);
    expect(code('src/app/checkout/index.tsx')).toMatch(
      /\}, \[announcedItemCount, totals\.total, fulfilmentType\]\);/,
    );
  });
});
