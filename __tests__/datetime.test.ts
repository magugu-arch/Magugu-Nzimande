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

describe('formatTime', () => {
  it('formats 24-hour time with zero padding', () => {
    expect(formatTime(new Date(2026, 0, 5, 9, 5))).toBe('09:05');
    expect(formatTime(new Date(2026, 0, 5, 14, 35))).toBe('14:35');
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
    expect(formatShortDate(new Date(2026, 7, 21))).toBe('Fri, 21 Aug');
  });

  it('does not pad the day', () => {
    expect(formatShortDate(new Date(2026, 0, 5))).toBe('Mon, 5 Jan');
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
  const now = new Date(2026, 0, 5, 12, 0);

  it('names today, yesterday and tomorrow', () => {
    expect(formatRelativeDay(new Date(2026, 0, 5, 8, 0), now)).toBe('Today');
    expect(formatRelativeDay(new Date(2026, 0, 4, 22, 0), now)).toBe('Yesterday');
    expect(formatRelativeDay(new Date(2026, 0, 6, 8, 0), now)).toBe('Tomorrow');
  });

  it('falls back to a short date further out', () => {
    expect(formatRelativeDay(new Date(2026, 0, 1, 8, 0), now)).not.toBe('Today');
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
    const base = new Date(2026, 0, 5, 12, 0);
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
    const now = new Date(2026, 0, 5, 12, 0);
    const days = buildScheduleDays(now);
    const earliest = addMinutes(now, businessRules.minScheduleLeadMinutes).getTime();

    days.forEach((day) => {
      day.slots.forEach((slot) => {
        expect(new Date(slot.iso).getTime()).toBeGreaterThanOrEqual(earliest);
      });
    });
  });

  it('stays within the scheduling horizon and drops empty days', () => {
    const days = buildScheduleDays(new Date(2026, 0, 5, 12, 0));
    expect(days.length).toBeGreaterThan(0);
    expect(days.length).toBeLessThanOrEqual(businessRules.maxScheduleDays);
    days.forEach((day) => expect(day.slots.length).toBeGreaterThan(0));
  });

  it('labels the first day relative to now', () => {
    const days = buildScheduleDays(new Date(2026, 0, 5, 12, 0));
    expect(days[0]?.label).toBe('Today');
  });

  it('offers no same-day slots after trading hours', () => {
    const days = buildScheduleDays(new Date(2026, 0, 5, 23, 30));
    expect(days[0]?.label).not.toBe('Today');
  });
});
