import { content } from '../src/content/index.ts';
import { createTashasSystem } from '../src/domain/system.ts';
import type { TashasSystem } from '../src/domain/system.ts';
import { ManualClock, createIdSource, mulberry32, MINUTE } from '../src/domain/util/core.ts';
import type { Actor, Channel } from '../src/domain/types.ts';
import { addDays, dateKeyAt, weekday } from '../src/domain/util/time.ts';

/** Monday 26 October 2026, 08:00 in Johannesburg. */
export const MONDAY_8AM = Date.UTC(2026, 9, 26, 6, 0);

export function makeSystem(start = MONDAY_8AM): { sys: TashasSystem; clock: ManualClock } {
  const clock = new ManualClock(start);
  const sys = createTashasSystem({ content, clock, ids: createIdSource(mulberry32(7)) });
  return { sys, clock };
}

export const DETAILS = { name: 'Test Guest', email: 'test.guest@example.com', phone: '082 123 4567' };

export function guestActor(id: string): Actor {
  return { kind: 'guest', id };
}

/** Next date (from the clock) on the given weekday, at least `minDays` ahead. */
export function nextWeekday(sys: TashasSystem, day: number, minDays = 1): string {
  let d = addDays(dateKeyAt(sys.ctx.clock.now(), 120), minDays);
  while (weekday(d) !== day) d = addDays(d, 1);
  return d;
}

/** An available time for the party, preferring the given period. */
export async function openSlot(
  sys: TashasSystem,
  branchId: string,
  date: string,
  partySize: number,
  period: 'breakfast' | 'lunch' = 'lunch',
): Promise<string> {
  const a = await sys.bookings.availability(branchId, date, partySize);
  const slot = a.periods.find((p) => p.id === period)?.slots.find((s) => s.available);
  if (!slot) throw new Error(`No open ${period} slot at ${branchId} on ${date}`);
  return slot.time;
}

/** Runs the guest side of a booking up to submit. */
export async function startBooking(
  sys: TashasSystem,
  opts: { branchId: string; date: string; time: string; partySize: number; key?: string },
) {
  const attempt = sys.bookings.startAttempt({
    guestId: null,
    branchId: opts.branchId,
    idempotencyKey: opts.key ?? `key-${Math.random()}`,
    attribution: null,
  });
  await sys.bookings.selectSlot(attempt.id, { date: opts.date, time: opts.time, partySize: opts.partySize });
  sys.bookings.setGuestDetails(attempt.id, DETAILS);
  return attempt.id;
}

/** Plays the gateway's hosted page, then lets webhooks arrive and workers run. */
export async function pay(
  sys: TashasSystem,
  clock: ManualClock,
  paymentId: string,
  outcome: 'succeed' | 'decline' | 'cancel' = 'succeed',
) {
  const payment = sys.payments.get(paymentId);
  sys.gateway.completeCheckout(payment.providerPaymentId!, outcome);
  clock.advance(MINUTE);
  await sys.settle();
}

export function consent(sys: TashasSystem, guestId: string, channels: Channel[]) {
  for (const c of channels) sys.consent.grant(guestId, c, 'preference-centre', guestActor(guestId));
}
