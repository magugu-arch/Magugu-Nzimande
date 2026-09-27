import { sastToDate, toMinutes, addMinutes } from '../shared/format';

/**
 * Turning opening windows into bookable start times. Pure, so the rule that
 * matters most — never offer a time that is taken — is tested directly
 * (see server/slots.test.ts) rather than through a database.
 */

export type Window = { date: string; startTime: string; endTime: string };
export type Busy = { date: string; time: string; durationMinutes: number };

export type SlotRules = {
  durationMinutes: number;
  /** Start times fall on this grid inside each window. */
  stepMinutes: number;
  /** No bookings starting sooner than this from now. */
  minNoticeMinutes: number;
  now: Date;
};

export function slotsForDate(date: string, windows: Window[], busy: Busy[], rules: SlotRules): string[] {
  const earliest = rules.now.getTime() + rules.minNoticeMinutes * 60_000;
  const taken = busy
    .filter((b) => b.date === date)
    .map((b) => [toMinutes(b.time), toMinutes(b.time) + b.durationMinutes] as const);

  const out = new Set<string>();
  for (const w of windows) {
    if (w.date !== date) continue;
    const open = toMinutes(w.startTime);
    const close = toMinutes(w.endTime);
    for (let start = open; start + rules.durationMinutes <= close; start += rules.stepMinutes) {
      const end = start + rules.durationMinutes;
      if (taken.some(([s, e]) => start < e && s < end)) continue;
      const time = addMinutes('00:00', start);
      if (sastToDate(date, time).getTime() < earliest) continue;
      out.add(time);
    }
  }
  return [...out].sort();
}
