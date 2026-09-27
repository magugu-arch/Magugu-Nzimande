import { describe, expect, it } from 'vitest';
import { slotsForDate, type Window } from './slots';

const day = '2026-10-06'; // a Tuesday
const windows: Window[] = [{ date: day, startTime: '09:00', endTime: '12:00' }];
const base = { durationMinutes: 60, stepMinutes: 30, minNoticeMinutes: 0, now: new Date('2026-10-01T00:00:00+02:00') };

describe('slotsForDate', () => {
  it('lists every start time whose whole appointment fits inside the window', () => {
    expect(slotsForDate(day, windows, [], base)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
  });

  it('never offers a time that overlaps an existing booking, even partly', () => {
    const busy = [{ date: day, time: '10:00', durationMinutes: 60 }];
    // 09:30–10:30 and 10:30–11:30 both touch 10:00–11:00; 09:00 ends exactly at 10:00 and is fine.
    expect(slotsForDate(day, windows, busy, base)).toEqual(['09:00', '11:00']);
  });

  it('ignores bookings on other days', () => {
    const busy = [{ date: '2026-10-07', time: '09:00', durationMinutes: 180 }];
    expect(slotsForDate(day, windows, busy, base)).toHaveLength(5);
  });

  it('respects the minimum notice period in Johannesburg time', () => {
    const now = new Date('2026-10-06T08:15:00+02:00');
    expect(slotsForDate(day, windows, [], { ...base, now, minNoticeMinutes: 60 })).toEqual(['09:30', '10:00', '10:30', '11:00']);
  });

  it('returns nothing when the service is longer than the window', () => {
    expect(slotsForDate(day, windows, [], { ...base, durationMinutes: 240 })).toEqual([]);
  });
});
