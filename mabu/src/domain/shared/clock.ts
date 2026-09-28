/**
 * Time is injected so every rule that depends on "now" — booking lead time,
 * cancellation cut-offs, reminders, expiry — is deterministic under test.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(
  iso: string,
): Clock & { set(iso: string): void; advance(ms: number): void } {
  let current = new Date(iso);
  return {
    now: () => new Date(current.getTime()),
    set(next: string) {
      current = new Date(next);
    },
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
