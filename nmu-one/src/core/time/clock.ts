import { config } from '../config';
import { sastDate, sastParts } from './sast';

/**
 * The one source of "now" in NMU ONE.
 *
 * A presentation has to read the same at 09:00 and at 21:00, so in
 * `scenario` mode (the default for demos) the clock starts at 09:40 SAST on
 * the next weekday — today, unless today is a weekend — and then runs in real
 * time. Mock adapters generate the day's classes, shuttles and orders around
 * that instant. In `live` mode it is simply the device clock.
 *
 * Nothing in the app calls `new Date()` for the current time; it calls
 * `clock.now()`, so tests can pin time with `setClockForTesting`.
 */

export const SCENARIO_START = { hours: 9, minutes: 40 } as const;

export function scenarioAnchor(realNow: Date): Date {
  const p = sastParts(realNow);
  let anchor = sastDate(p.year, p.month, p.day, SCENARIO_START.hours, SCENARIO_START.minutes);
  // Saturday → Monday, Sunday → Monday.
  const skip = p.weekday === 6 ? 2 : p.weekday === 0 ? 1 : 0;
  anchor = new Date(anchor.getTime() + skip * 24 * 60 * 60_000);
  return anchor;
}

export interface Clock {
  now(): Date;
}

function createClock(): Clock {
  if (config.clock === 'live') return { now: () => new Date() };
  const offset = scenarioAnchor(new Date()).getTime() - Date.now();
  return { now: () => new Date(Date.now() + offset) };
}

let active: Clock = createClock();

export const clock: Clock = {
  now: () => active.now(),
};

/** Pins the clock in tests. Pass `null` to restore the configured clock. */
export function setClockForTesting(fixed: Date | (() => Date) | null): void {
  if (fixed === null) {
    active = createClock();
    return;
  }
  active = { now: typeof fixed === 'function' ? fixed : () => new Date(fixed.getTime()) };
}
