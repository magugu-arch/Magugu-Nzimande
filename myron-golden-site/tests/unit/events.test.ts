import { describe, expect, it } from 'vitest';
import {
  calendarGrid,
  eventDayKey,
  formatEventTime,
  isUpcoming,
  monthKey,
  shiftMonth,
  splitEvents,
} from '@/lib/events';

const ev = (id: string, start: string, end: string, timezone = 'America/Chicago') => ({
  id,
  start,
  end,
  timezone,
});

describe('splitEvents', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  const events = [
    ev('past', '2026-09-01T10:00:00-05:00', '2026-09-01T11:00:00-05:00'),
    ev('later', '2027-02-11T09:00:00-05:00', '2027-02-11T16:00:00-05:00'),
    ev('soon', '2026-11-19T18:00:00-06:00', '2026-11-19T19:30:00-06:00'),
    ev('in-progress', '2026-10-14T11:00:00Z', '2026-10-14T13:00:00Z'),
    ev('older', '2025-11-06T10:00:00-08:00', '2025-11-06T15:00:00-08:00'),
  ];

  it('keeps an event upcoming until it has ended, soonest first', () => {
    const { upcoming } = splitEvents(events, now);
    expect(upcoming.map((e) => e.id)).toEqual(['in-progress', 'soon', 'later']);
  });

  it('archives everything that has ended, most recent first', () => {
    const { past } = splitEvents(events, now);
    expect(past.map((e) => e.id)).toEqual(['past', 'older']);
  });

  it('never lists an ended event as upcoming', () => {
    const justEnded = ev('x', '2026-10-14T10:00:00Z', '2026-10-14T11:59:59Z');
    expect(isUpcoming(justEnded, now)).toBe(false);
  });
});

describe('time zones', () => {
  it('files an event under the month where it is held, not UTC', () => {
    // 11:30pm on 30 November in Chicago is already 1 December in UTC.
    const e = ev('tz', '2026-11-30T23:30:00-06:00', '2026-12-01T00:30:00-06:00');
    expect(monthKey(e)).toBe('2026-11');
    expect(eventDayKey(e)).toBe('2026-11-30');
  });

  it('shows times in the event’s own zone with its abbreviation', () => {
    const e = ev('t', '2026-11-19T18:00:00-06:00', '2026-11-19T19:30:00-06:00');
    expect(formatEventTime(e)).toMatch(/^6:00\sPM – 7:30\sPM CST$/);
    const ny = ev(
      'n',
      '2027-02-11T09:00:00-05:00',
      '2027-02-11T16:00:00-05:00',
      'America/New_York',
    );
    expect(formatEventTime(ny)).toMatch(/EST$/);
  });
});

describe('calendarGrid', () => {
  it('starts weeks on Monday and fills whole weeks', () => {
    const weeks = calendarGrid('2026-11'); // 1 Nov 2026 is a Sunday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]![0]!.date).toBe('2026-10-26');
    expect(weeks[0]![6]).toMatchObject({ date: '2026-11-01', inMonth: true });
    const inMonth = weeks.flat().filter((d) => d.inMonth);
    expect(inMonth).toHaveLength(30);
  });

  it('moves between months across a year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });
});
