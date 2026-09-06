import {
  addMinutes,
  buildScheduleDays,
  dayName,
  formatEtaWindow,
  formatRelativeDay,
  formatShortDate,
  formatTime,
} from '@/utils/datetime';
import { businessRules } from '@/constants/config';
import { instantAtStoreTime, storeClockAt } from '@/utils/storeClock';

/**
 * Fixtures on the store's clock.
 *
 * `new Date(2026, 0, 5, 9, 5)` builds an instant in whatever zone the process
 * is running in — UTC, under this suite's runner — and every assertion below
 * is about a South African kitchen. While the code read the device clock too
 * the two mistakes cancelled and the suite passed; they do not cancel any more.
 * See `utils/storeClock`.
 */
const sast = (year: number, month: number, date: number, hour = 0, minute = 0) =>
  instantAtStoreTime({ year, month, date, hour, minute });

describe('formatTime', () => {
  it('formats 24-hour time with zero padding', () => {
    expect(formatTime(sast(2026, 0, 5, 9, 5))).toBe('09:05');
    expect(formatTime(sast(2026, 0, 5, 14, 35))).toBe('14:35');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatTime('not a date')).toBe('');
  });
});

/**
 * Built by hand rather than through `toLocaleDateString`, for the same reason
 * `groupDigits` exists in utils/money: Hermes ships without full ICU on some
 * builds, and the locale is then quietly ignored — `8/21/2026` where the
 * design says `Fri, 21 Aug`. Day-month and month-day are the same digits with
 * opposite meanings, so an order dated wrongly is worse than one dated ugly.
 */
describe('formatShortDate', () => {
  it('puts the day before the month, South African style', () => {
    expect(formatShortDate(sast(2026, 7, 21))).toBe('Fri, 21 Aug');
  });

  it('does not pad the day', () => {
    expect(formatShortDate(sast(2026, 0, 5))).toBe('Mon, 5 Jan');
  });

  it('handles every month', () => {
    const months = Array.from({ length: 12 }, (_, m) => formatShortDate(new Date(2026, m, 15)));
    expect(months.map((m) => m.split(' ').at(-1))).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
  });

  it('gives nothing back for an invalid date rather than "Invalid Date"', () => {
    expect(formatShortDate('not-a-date')).toBe('');
  });

  it('never renders a US-style numeric date', () => {
    // The failure mode being guarded: a fallback that ignores the locale.
    for (let month = 0; month < 12; month += 1) {
      expect(formatShortDate(new Date(2026, month, 21))).not.toMatch(/\d+\/\d+/);
    }
  });
});

describe('formatRelativeDay', () => {
  const now = sast(2026, 0, 5, 12, 0);

  it('names today, yesterday and tomorrow', () => {
    expect(formatRelativeDay(sast(2026, 0, 5, 8, 0), now)).toBe('Today');
    expect(formatRelativeDay(sast(2026, 0, 4, 22, 0), now)).toBe('Yesterday');
    expect(formatRelativeDay(sast(2026, 0, 6, 8, 0), now)).toBe('Tomorrow');
  });

  it('falls back to a short date further out', () => {
    expect(formatRelativeDay(sast(2026, 0, 1, 8, 0), now)).not.toBe('Today');
  });
});

describe('formatEtaWindow', () => {
  it('brackets the estimate by five minutes each way', () => {
    expect(formatEtaWindow(40)).toBe('35 – 45 min');
  });

  it('never drops the lower bound below five minutes', () => {
    expect(formatEtaWindow(2)).toBe('5 – 10 min');
  });
});

describe('addMinutes', () => {
  it('advances the clock', () => {
    const base = sast(2026, 0, 5, 12, 0);
    expect(formatTime(addMinutes(base, 45))).toBe('12:45');
  });
});

describe('dayName', () => {
  it('names weekdays and wraps out-of-range input', () => {
    expect(dayName(0)).toBe('Sunday');
    expect(dayName(6)).toBe('Saturday');
    expect(dayName(7)).toBe('Sunday');
    expect(dayName(-1)).toBe('Saturday');
  });
});

describe('buildScheduleDays', () => {
  it('only offers slots after the minimum lead time', () => {
    const now = sast(2026, 0, 5, 12, 0);
    const days = buildScheduleDays(now);
    const earliest = addMinutes(now, businessRules.minScheduleLeadMinutes).getTime();

    days.forEach((day) => {
      day.slots.forEach((slot) => {
        expect(new Date(slot.iso).getTime()).toBeGreaterThanOrEqual(earliest);
      });
    });
  });

  it('stays within the scheduling horizon and drops empty days', () => {
    const days = buildScheduleDays(sast(2026, 0, 5, 12, 0));
    expect(days.length).toBeGreaterThan(0);
    expect(days.length).toBeLessThanOrEqual(businessRules.maxScheduleDays);
    days.forEach((day) => expect(day.slots.length).toBeGreaterThan(0));
  });

  it('labels the first day relative to now', () => {
    const days = buildScheduleDays(sast(2026, 0, 5, 12, 0));
    expect(days[0]?.label).toBe('Today');
  });

  it('offers no same-day slots after trading hours', () => {
    const days = buildScheduleDays(sast(2026, 0, 5, 23, 30));
    expect(days[0]?.label).not.toBe('Today');
  });
});

/**
 * Slots used to be a hardcoded 10:00–21:45, every day, for every branch — the
 * seeded standard hours baked into a date utility that never saw a store.
 * Invisible while all seven seeded branches kept the same shift; not invisible
 * once two real branches have real hours.
 */
describe('buildScheduleDays against a branch', () => {
  const hours = (opensAt: string, closesAt: string, days = [0, 1, 2, 3, 4, 5, 6]) =>
    days.map((day) => ({ day, opensAt, closesAt }));

  // 09:00 on a Monday, so today's whole window is still ahead.
  const monday9am = sast(2026, 7, 24, 9, 0);
  const today = (store?: { openingHours: { day: number; opensAt: string; closesAt: string }[] }) =>
    buildScheduleDays(monday9am, store)[0];

  it('offers the branch its own window, not the seeded one', () => {
    const late = today({ openingHours: hours('11:00', '23:00') });

    expect(late?.slots[0]?.label).toBe('11:00');
    // Last orders before closing, never at it.
    expect(late?.slots.at(-1)?.label).toBe('22:45');
  });

  /**
   * The direction that costs money: a branch trading until 23:00 was never
   * offered the last two hours it would gladly have cooked.
   */
  it('reaches later than the old fixed grid for a late branch', () => {
    const late = today({ openingHours: hours('11:00', '23:00') });
    expect(late?.slots.some((slot) => slot.label === '22:30')).toBe(true);
  });

  /** And the direction that costs trust. */
  it('offers nothing on a day the branch does not trade', () => {
    // Trades every day except Monday.
    const shutMondays = { openingHours: hours('10:00', '22:00', [0, 2, 3, 4, 5, 6]) };
    const days = buildScheduleDays(monday9am, shutMondays);

    expect(days.some((day) => day.label === 'Today')).toBe(false);
    expect(days[0]?.label).toBe('Tomorrow');
  });

  it('keeps the old window for a branch that publishes no hours', () => {
    const bare = today({ openingHours: [] });

    expect(bare?.slots[0]?.label).toBe('10:00');
    expect(bare?.slots.at(-1)?.label).toBe('21:45');
  });

  it('keeps the old window when no branch has been chosen yet', () => {
    expect(today()?.slots[0]?.label).toBe('10:00');
    expect(today()?.slots.at(-1)?.label).toBe('21:45');
  });

  /**
   * Every slot it offers has to survive the checkout guard, or the scheduler
   * is handing out times that will be refused at the till.
   */
  it('offers only times inside the branch window', () => {
    const branch = { openingHours: hours('11:00', '23:00') };
    for (const day of buildScheduleDays(monday9am, branch)) {
      for (const slot of day.slots) {
        const at = new Date(slot.iso);
        const minutes = storeClockAt(at).minutesIntoDay;
        expect(minutes).toBeGreaterThanOrEqual(11 * 60);
        expect(minutes).toBeLessThan(23 * 60);
      }
    }
  });
});

/**
 * The scheduler and checkout have to agree about which branch can cook.
 *
 * They did not. The weekly timetable says nothing about whether a branch has
 * opened — one opening in November has the same Tuesday hours as one open
 * since March — so the scheduler offered 41 slots today and 205 across the
 * week for bb.q Chicken Gateway, which opens on 1 November, and checkout
 * refused every one of them: "bb.q Chicken Gateway opens on Sun, 1 Nov".
 *
 * Not reachable through the store picker, which will not let a branch that has
 * not opened be chosen. Reachable through checkout, which falls back to naming
 * *some* branch when none can take the order — which is the app's state for
 * the whole run-up to the first opening, when every branch is one that has not
 * opened. That is the five weeks this ships into.
 */
describe('scheduling against a branch that has not opened', () => {
  const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    opensAt: '11:00',
    closesAt: '22:00',
  }));

  const now = new Date('2026-08-26T13:00:00+02:00');

  it('offers nothing at all while the branch is months away', () => {
    const gateway = { openingHours: ALL_WEEK, opensOn: '2026-11-01T09:00:00+02:00' };
    expect(buildScheduleDays(now, gateway)).toEqual([]);
  });

  it('still offers slots for a branch that is already trading', () => {
    // The floor must not swallow the ordinary case.
    expect(buildScheduleDays(now, { openingHours: ALL_WEEK }).length).toBeGreaterThan(0);
  });

  it('ignores an opening date that has already passed', () => {
    const opened = { openingHours: ALL_WEEK, opensOn: '2026-03-01T09:00:00+02:00' };
    expect(buildScheduleDays(now, opened).length).toBeGreaterThan(0);
  });

  it('ignores an opening date it cannot read', () => {
    // `request<T>` casts rather than validates, so the wire decides this.
    const wrong = { openingHours: ALL_WEEK, opensOn: 'sometime in spring' };
    expect(buildScheduleDays(now, wrong).length).toBeGreaterThan(0);
  });

  it('offers the opening day itself once it is inside the horizon', () => {
    // Two days out, so the five-day horizon reaches it.
    const soon = { openingHours: ALL_WEEK, opensOn: '2026-08-28T11:00:00+02:00' };
    const days = buildScheduleDays(now, soon);
    expect(days.length).toBeGreaterThan(0);

    // And nothing before it: every slot on every day is at or after opening.
    const opens = new Date('2026-08-28T11:00:00+02:00').getTime();
    for (const day of days) {
      for (const slot of day.slots) {
        expect(new Date(slot.iso).getTime()).toBeGreaterThanOrEqual(opens);
      }
    }
  });
});
