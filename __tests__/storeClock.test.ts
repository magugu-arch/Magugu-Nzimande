import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { OpeningHours, Store } from '@/types';
import {
  buildScheduleDays,
  formatRelativeDay,
  formatShortDate,
  formatTime,
} from '@/utils/datetime';
import {
  clockNotice,
  deviceIsOnStoreTime,
  instantAtStoreTime,
  storeClockAt,
} from '@/utils/storeClock';
import { isStoreOpenAt, windowInForce } from '@/utils/tradingHours';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const HOURS: OpeningHours[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  opensAt: '10:00',
  closesAt: '22:00',
}));

const store = (overrides: Partial<Store> = {}): Store =>
  ({
    id: 'rosebank',
    name: 'bb.q Chicken Rosebank',
    addressLine: '177 Oxford Rd',
    suburb: 'Rosebank',
    city: 'Johannesburg',
    province: 'Gauteng',
    phone: '011 447 2200',
    latitude: -26.1465,
    longitude: 28.0436,
    distanceKm: 1,
    openingHours: HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 20,
    isOpenNow: true,
    ...overrides,
  }) as Store;

/**
 * Instants written the only way that means the same thing everywhere: as UTC.
 *
 * Deliberately not `instantAtStoreTime`, unlike the other suites. These
 * fixtures are here to check the converter, and a fixture built by the thing
 * under test proves the two agree with each other rather than with the world —
 * which is precisely the failure `tradingHours.test.ts` used to contain.
 */
const utc = (iso: string) => new Date(iso);

/**
 * A phone somewhere other than South Africa.
 *
 * `deviceIsOnStoreTime` is the one function here that reads the device at all,
 * through `getTimezoneOffset`, so it is the one that needs a device to be
 * moved. Everything else is instant arithmetic and does not care — which is
 * the property fixture 3 exists to prove rather than assume.
 */
function withDeviceOffset<T>(minutesAheadOfUtc: number, run: () => T): T {
  const original = Date.prototype.getTimezoneOffset;
  // eslint-disable-next-line no-extend-native
  Date.prototype.getTimezoneOffset = () => -minutesAheadOfUtc;
  try {
    return run();
  } finally {
    // eslint-disable-next-line no-extend-native
    Date.prototype.getTimezoneOffset = original;
  }
}

/*
  ───────────────────────────────────────────────────────────────────────────
  Ten states the app has always supported and nothing has ever put it in.

  Every sweep in this repository — `audit:screens`, `audit:offline`,
  `audit:wire`, the order smoke test — pins the browser to
  `timezoneId: 'Africa/Johannesburg'`, and every unit suite runs under a UTC
  runner. So the app has been exercised on exactly two clocks, one of which is
  the kitchen's and the other of which was silently wrong in the same direction
  as the code.

  What follows is the third: a phone that is somewhere else.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the label and the instant say the same hour.
 *
 * This is the defect in one line. A slot labelled `18:00` used to be built
 * from the device's wall clock and stamped as an instant from the same, so on
 * a phone an hour behind SAST the kitchen received an order due at 19:00 with
 * a receipt that said 18:00. Both halves were internally consistent and the
 * pair was a lie — the same shape as the "Open now · 11:00 – 22:00" card
 * written up in `utils/tradingHours`.
 */
describe('1 — a slot means the hour it is labelled with', () => {
  it('stamps 18:00 as 16:00Z, whatever clock the phone is on', () => {
    const days = buildScheduleDays(utc('2026-09-07T06:00:00.000Z'), store());
    const six = days[0]?.slots.find((slot) => slot.label === '18:00');

    expect(six).toBeDefined();
    expect(six!.iso).toBe('2026-09-07T16:00:00.000Z');
  });

  it('labels every slot with the hour the kitchen will read', () => {
    const days = buildScheduleDays(utc('2026-09-07T06:00:00.000Z'), store());

    for (const day of days) {
      for (const slot of day.slots) {
        expect(slot.label).toBe(formatTime(new Date(slot.iso)));
        expect(formatTime(new Date(slot.iso))).toBe(
          `${String(storeClockAt(new Date(slot.iso)).hour).padStart(2, '0')}:` +
            `${String(storeClockAt(new Date(slot.iso)).minute).padStart(2, '0')}`,
        );
      }
    }
  });
});

/**
 * FIXTURE 2 — Saturday evening in Los Angeles is Sunday morning in Rosebank.
 *
 * The grid used to be laid out with `new Date(y, m, d + offset)` on the
 * device's fields. At 20:00 on a Saturday in California it is 05:00 on Sunday
 * in Johannesburg, so the scheduler opened on **Saturday's** published hours
 * for a branch that had been on its Sunday shift for five hours — and for a
 * six-day branch that shuts on Sundays, offered a full grid of slots for a day
 * with nobody in the kitchen.
 */
describe('2 — the calendar is the kitchen’s', () => {
  const saturdayEveningInCalifornia = utc('2026-09-06T03:00:00.000Z');

  it('is already Sunday in the store’s week', () => {
    expect(storeClockAt(saturdayEveningInCalifornia).day).toBe(0);
    expect(storeClockAt(saturdayEveningInCalifornia).date).toBe(6);
  });

  it('offers no slots at all for a branch that shuts on Sundays', () => {
    const sixDay = store({ openingHours: HOURS.filter((hours) => hours.day !== 0) });
    const days = buildScheduleDays(saturdayEveningInCalifornia, sixDay);

    expect(days.every((day) => storeClockAt(new Date(day.dateIso)).day !== 0)).toBe(true);
  });

  it('opens the grid on the store’s day, not the phone’s', () => {
    const days = buildScheduleDays(saturdayEveningInCalifornia, store());
    expect(storeClockAt(new Date(days[0]!.dateIso)).day).toBe(0);
  });
});

/**
 * FIXTURE 3 — nothing on the path asks the device what time it is.
 *
 * The property, rather than a sample of timezones. A test that drives three
 * chosen offsets proves the code is right for three offsets; making the local
 * getters throw proves it never consults the device at all, which is the thing
 * that was actually wrong.
 *
 * Results are captured before the getters are restored, because the assertion
 * machinery reads dates itself.
 */
describe('3 — the device clock is not consulted', () => {
  const LOCAL_GETTERS = [
    'getHours',
    'getMinutes',
    'getDay',
    'getDate',
    'getMonth',
    'getFullYear',
  ] as const;

  function withLocalGettersPoisoned<T>(run: () => T): T {
    const originals = LOCAL_GETTERS.map((name) => [name, Date.prototype[name]] as const);
    for (const [name] of originals) {
      // eslint-disable-next-line no-extend-native
      Date.prototype[name] = () => {
        throw new Error(`${name} — the device clock, on a path that must not read it`);
      };
    }
    try {
      return run();
    } finally {
      for (const [name, fn] of originals) {
        (Date.prototype[name] as unknown) = fn;
      }
    }
  }

  it('answers openness, formatting and scheduling without one', () => {
    const at = utc('2026-09-07T12:00:00.000Z');

    const answers = withLocalGettersPoisoned(() => ({
      open: isStoreOpenAt(store(), at),
      window: windowInForce(store(), at),
      time: formatTime(at),
      date: formatShortDate(at),
      relative: formatRelativeDay(at, at),
      slots: buildScheduleDays(at, store()).length,
    }));

    expect(answers.open).toBe(true);
    expect(answers.window).toEqual({ opensAt: '10:00', closesAt: '22:00' });
    expect(answers.time).toBe('14:00');
    expect(answers.date).toBe('Mon, 7 Sep');
    expect(answers.relative).toBe('Today');
    expect(answers.slots).toBeGreaterThan(0);
  });

  /**
   * And the source says so too, because a local-time `Date` constructor is not
   * a getter and the poisoning above cannot see it. `new Date(y, m, d, h)`
   * builds an instant in the device's zone and was how the slot grid went
   * wrong in the first place.
   */
  it('builds no dates from local components either', () => {
    for (const file of ['src/utils/datetime.ts', 'src/utils/tradingHours.ts']) {
      expect(code(file)).not.toMatch(/new Date\([^)'"`]*,[^)'"`]*,/);
      expect(code(file)).not.toMatch(/\.getHours\(\)|\.getDay\(\)|\.getMinutes\(\)/);
    }
  });
});

/**
 * FIXTURE 4 — a branch is open or shut at a moment, not at a place.
 *
 * Openness is a property of the instant and the timetable. Asked from Nuku'alofa
 * or from Baker Island it has to come back the same, or two customers looking
 * at the same branch at the same second are told different things.
 *
 * The range covers the real span of device offsets, including the quarter-hour
 * ones — Kathmandu at +05:45 and the Chatham Islands at +12:45 — because a
 * conversion written in whole hours passes every test built from whole hours.
 */
describe('4 — the same second gives the same answer everywhere', () => {
  const OFFSETS = [-720, -420, -210, 0, 60, 120, 330, 345, 570, 765, 840];
  const at = utc('2026-09-07T08:30:00.000Z'); // 10:30 SAST — half an hour open.

  it('says open from every device offset there is', () => {
    for (const offset of OFFSETS) {
      expect(withDeviceOffset(offset, () => isStoreOpenAt(store(), at))).toBe(true);
    }
  });

  it('says shut from every one of them half an hour earlier', () => {
    const before = utc('2026-09-07T07:30:00.000Z'); // 09:30 SAST.
    for (const offset of OFFSETS) {
      expect(withDeviceOffset(offset, () => isStoreOpenAt(store(), before))).toBe(false);
    }
  });
});

/**
 * FIXTURE 5 — the late window, from a phone that has not reached midnight.
 *
 * A branch trading 11:00–00:30 on a Friday. At 20:00 SAST the customer is
 * inside Friday's window; a phone in London says it is 19:00, and a phone in
 * São Paulo says 15:00. All three are looking at the same open kitchen, and
 * the last slot on offer is the same 00:15.
 *
 * The first draft of this put the customer at 23:45, and got 21:45 back — the
 * lead time had pushed the earliest bookable slot past 00:15, Friday
 * contributed nothing, and `days[0]` was Saturday on its ordinary hours. A
 * correct answer to a question about a different day, which is worth recording
 * because it is what a wrong one would look like too.
 */
describe('5 — a window that runs past midnight', () => {
  const late = store({
    openingHours: HOURS.map((hours) =>
      hours.day === 5 ? { ...hours, opensAt: '11:00', closesAt: '00:30' } : hours,
    ),
  });

  const fridayLate = utc('2026-09-04T18:00:00.000Z'); // 20:00 SAST on the Friday.

  it('is trading, on Friday’s row rather than Saturday’s', () => {
    expect(isStoreOpenAt(late, fridayLate)).toBe(true);
    expect(windowInForce(late, fridayLate)).toEqual({ opensAt: '11:00', closesAt: '00:30' });
  });

  it('offers a last slot at 00:15, stamped on the Saturday morning', () => {
    const days = buildScheduleDays(fridayLate, late);
    const last = days[0]!.slots[days[0]!.slots.length - 1]!;

    expect(last.label).toBe('00:15');
    // 00:15 SAST on the 5th is 22:15Z on the 4th — the night it belongs to.
    expect(last.iso).toBe('2026-09-04T22:15:00.000Z');
  });

  it('still calls that slot part of Friday’s trading, not Saturday’s', () => {
    expect(isStoreOpenAt(late, utc('2026-09-04T22:15:00.000Z'))).toBe(true);
  });
});

/**
 * FIXTURE 6 — the sentence, and when it is not said.
 *
 * The app converts silently and correctly; a customer abroad still deserves to
 * know why the screen says 18:00 when their phone says 17:00. A customer in
 * Cape Town must never see it, which is the half that makes it a fixture
 * rather than a banner.
 */
describe('6 — telling the customer their phone disagrees', () => {
  it('says nothing at all on a South African phone', () => {
    expect(withDeviceOffset(120, () => deviceIsOnStoreTime())).toBe(true);
    expect(withDeviceOffset(120, () => clockNotice())).toBeNull();
  });

  it('speaks up an hour either side of it', () => {
    expect(withDeviceOffset(60, () => clockNotice())).toMatch(/South African time/);
    expect(withDeviceOffset(180, () => clockNotice())).toMatch(/South African time/);
  });

  it('names SAST rather than leaving the customer to guess the offset', () => {
    expect(withDeviceOffset(0, () => clockNotice())).toContain('SAST');
  });

  it('is shown on the schedule screen and only when there is something to say', () => {
    const screen = code('src/app/checkout/schedule.tsx');

    expect(screen).toMatch(/clockNotice\(now\)/);
    expect(screen).toMatch(/notice \? \(/);
    expect(screen).toMatch(/testID="schedule-clock-notice"/);
  });
});

/**
 * FIXTURE 7 — the two directions agree.
 *
 * `storeClockAt` and `instantAtStoreTime` are inverses, and every fixture in
 * the other suites now depends on it. A round trip over a year of instants is
 * cheap and catches the class of error — an offset applied the wrong way —
 * that would otherwise show up as a uniform two-hour lie nobody notices
 * because everything is wrong together.
 */
describe('7 — the conversion is reversible', () => {
  it('returns the instant it was given, across a year', () => {
    for (let dayOfYear = 0; dayOfYear < 365; dayOfYear += 7) {
      const original = new Date(Date.UTC(2026, 0, 1, 3, 17) + dayOfYear * 86_400_000);
      const parts = storeClockAt(original);

      expect(instantAtStoreTime(parts).getTime()).toBe(original.getTime());
    }
  });

  it('puts the store two hours ahead of UTC and not behind it', () => {
    // The direction, stated once. An offset applied the wrong way round is
    // self-consistent and four hours out.
    expect(storeClockAt(utc('2026-09-07T00:00:00.000Z')).hour).toBe(2);
  });
});

/**
 * FIXTURE 8 — out-of-range fields, which the scheduler depends on.
 *
 * `{ hour: 24, minute: 15 }` has to be a quarter past midnight the next
 * morning, because that is how the wrap window in fixture 5 is built. This is
 * `Date.UTC` behaviour rather than anything written here, which is exactly why
 * it is worth a test: it is load-bearing and invisible.
 */
describe('8 — fields that run past the end of their unit', () => {
  it('rolls hour 24 onto the next morning', () => {
    expect(
      instantAtStoreTime({ year: 2026, month: 8, date: 4, hour: 24, minute: 15 }).toISOString(),
    ).toBe('2026-09-04T22:15:00.000Z');
  });

  it('rolls a date past the end of the month', () => {
    const rolled = storeClockAt(instantAtStoreTime({ year: 2026, month: 8, date: 31 }));
    expect(rolled.month).toBe(9);
    expect(rolled.date).toBe(1);
  });

  it('handles a window that closes exactly at midnight', () => {
    const midnight = store({
      openingHours: HOURS.map((hours) => ({ ...hours, opensAt: '11:00', closesAt: '00:00' })),
    });
    // 23:45 SAST — inside an 11:00–24:00 window.
    expect(isStoreOpenAt(midnight, utc('2026-09-07T21:45:00.000Z'))).toBe(true);
    // 00:15 SAST — past it.
    expect(isStoreOpenAt(midnight, utc('2026-09-07T22:15:00.000Z'))).toBe(false);
  });
});

/**
 * FIXTURE 9 — "Today" turns over at the kitchen's midnight.
 *
 * Order history, the schedule day chips and every `Fri, 21 Aug` in the app
 * turn on this. Under a UTC runner the boundary was two hours late, so an
 * order placed at 01:00 SAST on a Sunday was filed under Saturday — and the
 * suite agreed, because the suite was reading the same clock.
 */
describe('9 — the day turns over at the store’s midnight', () => {
  const justBefore = utc('2026-09-06T21:30:00.000Z'); // 23:30 SAST, Sunday.
  const justAfter = utc('2026-09-06T22:30:00.000Z'); // 00:30 SAST, Monday.

  it('files the two sides of it on different days', () => {
    expect(formatShortDate(justBefore)).toBe('Sun, 6 Sep');
    expect(formatShortDate(justAfter)).toBe('Mon, 7 Sep');
  });

  it('calls the earlier one yesterday, once the later one is now', () => {
    expect(formatRelativeDay(justBefore, justAfter)).toBe('Yesterday');
    expect(formatRelativeDay(justAfter, justAfter)).toBe('Today');
  });

  it('does not turn over at UTC midnight', () => {
    const utcMidnight = utc('2026-09-07T00:00:00.000Z'); // 02:00 SAST, Monday.
    expect(formatRelativeDay(justAfter, utcMidnight)).toBe('Today');
  });
});

/**
 * FIXTURE 10 — the whole chain, which is the only assertion that matters.
 *
 * Every slot the scheduler offers is a slot the branch's own trading-hours
 * check agrees with. Before this round the two read the same wrong clock and
 * so agreed with each other; now they read the kitchen's and agree with the
 * kitchen. The test is the same either way — which is the point. It passes for
 * a different reason, and the reason is the fix.
 *
 * Driven from four instants that are the same second seen from four phones,
 * because the offered grid must not depend on which one asked.
 */
describe('10 — every slot offered is one the kitchen could cook', () => {
  const branches = [
    store(),
    store({
      openingHours: HOURS.filter((hours) => hours.day !== 0).map((hours) =>
        hours.day === 5 ? { ...hours, opensAt: '11:00', closesAt: '00:30' } : hours,
      ),
    }),
  ];

  const moments = [
    utc('2026-09-04T09:00:00.000Z'),
    utc('2026-09-06T03:00:00.000Z'),
    utc('2026-09-06T22:30:00.000Z'),
    utc('2026-09-07T19:45:00.000Z'),
  ];

  it('never offers a time the branch is shut', () => {
    for (const branch of branches) {
      for (const moment of moments) {
        for (const day of buildScheduleDays(moment, branch)) {
          for (const slot of day.slots) {
            expect({
              at: slot.iso,
              label: slot.label,
              open: isStoreOpenAt(branch, new Date(slot.iso)),
            }).toEqual({ at: slot.iso, label: slot.label, open: true });
          }
        }
      }
    }
  });

  it('never offers a time already gone', () => {
    for (const branch of branches) {
      for (const moment of moments) {
        for (const day of buildScheduleDays(moment, branch)) {
          for (const slot of day.slots) {
            expect(new Date(slot.iso).getTime()).toBeGreaterThan(moment.getTime());
          }
        }
      }
    }
  });
});
