import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DETAILS, guestActor, makeSystem, nextWeekday, openSlot, pay, startBooking } from './helpers.ts';
import { HOUR, MINUTE, isDomainError } from '../src/domain/util/core.ts';
import { staff } from '../src/domain/roles.ts';
import { SANDBOX_RESERVATIONS_SIGNING_KEY, signatureHeader } from '../src/domain/sandbox/webhooks.ts';
import { utf8 } from '../src/domain/util/sha256.ts';

describe('booking without a deposit', () => {
  test('confirms only once the provider has made the reservation, then notifies and schedules reminders', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 3, 2); // Wednesday
    const time = await openSlot(sys, 'morningside', date, 2);
    const attemptId = await startBooking(sys, { branchId: 'morningside', date, time, partySize: 2 });

    assert.equal(sys.bookings.attempt(attemptId).state, 'availability-selected');
    assert.equal(sys.db.all('bookings').length, 0, 'no booking exists before submit');

    const result = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(result.status, 'confirmed');
    await sys.settle();

    const [booking] = sys.db.all('bookings');
    assert.ok(booking);
    assert.equal(booking.status, 'confirmed');
    assert.match(booking.reference, /^TSH-[2-9A-Z]{6}$/);
    assert.equal(sys.db.all('sandboxReservations').filter((r) => !r.waitlist).length, 1);

    const notes = sys.db.where('notifications', (n) => n.guestId === booking.guestId);
    assert.ok(notes.some((n) => n.templateId === 'booking-confirmed' && n.status === 'sent'));
    assert.equal(notes.filter((n) => n.templateId === 'booking-reminder' && n.status === 'scheduled').length, 2);
  });

  test('requires the guest to accept the booking terms', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 3, 2);
    const time = await openSlot(sys, 'morningside', date, 2);
    const attemptId = await startBooking(sys, { branchId: 'morningside', date, time, partySize: 2 });
    await assert.rejects(sys.bookings.submit(attemptId, { policyAccepted: false }), (e) => isDomainError(e, 'policy_not_accepted'));
  });

  test('a repeated submit returns the same booking, never a second one', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 3, 2);
    const time = await openSlot(sys, 'morningside', date, 2);
    const attemptId = await startBooking(sys, { branchId: 'morningside', date, time, partySize: 2 });
    const [a, b] = await Promise.all([
      sys.bookings.submit(attemptId, { policyAccepted: true }),
      sys.bookings.submit(attemptId, { policyAccepted: true }),
    ]);
    const c = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(sys.db.all('bookings').length, 1);
    assert.equal(sys.db.all('sandboxReservations').length, 1);
    for (const r of [a, b, c]) assert.ok(r.status === 'confirmed' || r.status === 'pending');
  });

  test('the same idempotency key starts the same attempt', () => {
    const { sys } = makeSystem();
    const one = sys.bookings.startAttempt({ guestId: null, branchId: 'rosebank', idempotencyKey: 'k1', attribution: null });
    const two = sys.bookings.startAttempt({ guestId: null, branchId: 'rosebank', idempotencyKey: 'k1', attribution: null });
    assert.equal(one.id, two.id);
  });
});

describe('booking with a deposit', () => {
  test('is not confirmed until the payment is verified, then records what was paid', async () => {
    const { sys, clock } = makeSystem();
    const date = nextWeekday(sys, 2, 2);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
    assert.equal(sys.bookings.attempt(attemptId).depositAmountMinor, 60000, 'R100 × 6, computed on the server');

    const result = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(result.status, 'checkout');
    if (result.status !== 'checkout') return;
    assert.match(result.checkoutUrl, /^sandbox-checkout:/);
    await sys.settle();
    assert.equal(sys.db.all('bookings').length, 0, 'nothing confirmed while payment is pending');

    await pay(sys, clock, result.paymentId);
    const [booking] = sys.db.all('bookings');
    assert.equal(booking?.status, 'confirmed');
    assert.equal(booking?.depositPaidMinor, 60000);
    assert.ok(sys.db.where('notifications', (n) => n.templateId === 'payment-receipt').length === 1);
  });

  test('a repeated submit while paying reuses the same payment', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 2, 2);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
    const first = await sys.bookings.submit(attemptId, { policyAccepted: true });
    const second = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(first.status, 'checkout');
    assert.deepEqual(second, first);
    assert.equal(sys.db.all('payments').length, 1);
    assert.equal(sys.db.all('sandboxPayments').length, 1);
  });

  test('a declined payment leaves no booking and lets the guest try again', async () => {
    const { sys, clock } = makeSystem();
    const date = nextWeekday(sys, 2, 2);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
    const first = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(first.status, 'checkout');
    if (first.status !== 'checkout') return;
    await pay(sys, clock, first.paymentId, 'decline');
    assert.equal(sys.db.all('bookings').length, 0);
    assert.equal(sys.bookings.attempt(attemptId).state, 'availability-selected');
    assert.ok(sys.db.where('notifications', (n) => n.templateId === 'payment-failed').length === 1);

    const retry = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(retry.status, 'checkout');
    if (retry.status !== 'checkout') return;
    assert.notEqual(retry.paymentId, first.paymentId);
    await pay(sys, clock, retry.paymentId);
    assert.equal(sys.db.all('bookings').length, 1);
  });

  test('a deposit tampered with on the way in is recomputed, not trusted', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 2, 2);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
    sys.db.update('bookingAttempts', attemptId, { depositAmountMinor: 100 });
    const result = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(result.status, 'policy-changed');
    assert.equal(sys.bookings.attempt(attemptId).depositAmountMinor, 60000);
    assert.equal(sys.db.all('payments').length, 0);
  });
});

describe('failure states', () => {
  test('a timeout after the provider committed is reconciled into one booking, not two', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 3, 2);
    const time = await openSlot(sys, 'morningside', date, 2);
    const attemptId = await startBooking(sys, { branchId: 'morningside', date, time, partySize: 2 });
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, nextCreate: 'timeout-after-commit' } }));

    const result = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(result.status, 'pending', 'the guest is not told it failed');
    assert.equal(sys.db.all('bookings').length, 0);

    await sys.settle();
    assert.equal(sys.bookings.attempt(attemptId).state, 'confirmed');
    assert.equal(sys.db.all('bookings').length, 1);
    assert.equal(sys.db.all('sandboxReservations').length, 1, 'the retry found the existing reservation');
  });

  test('a slot taken before confirmation fails truthfully when nothing was paid', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 3, 2);
    const time = await openSlot(sys, 'morningside', date, 2);
    const attemptId = await startBooking(sys, { branchId: 'morningside', date, time, partySize: 2 });
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, stealHeldSlot: true } }));
    const result = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.deepEqual(result, { status: 'failed', attemptId, reason: 'slot_unavailable' });
    assert.equal(sys.db.all('bookings').length, 0);
  });

  test('payment succeeded but booking failed: reconciliation, staff alert, honest message, then refund', async () => {
    const { sys, clock } = makeSystem();
    const date = nextWeekday(sys, 2, 2);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
    const checkout = await sys.bookings.submit(attemptId, { policyAccepted: true });
    assert.equal(checkout.status, 'checkout');
    if (checkout.status !== 'checkout') return;
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, nextCreate: 'unavailable' } }));

    await pay(sys, clock, checkout.paymentId);
    assert.equal(sys.bookings.attempt(attemptId).state, 'reconciliation');
    assert.equal(sys.db.all('bookings').length, 0);
    assert.ok(sys.db.where('alerts', (a) => a.entityId === attemptId && a.resolvedAt === null).length === 1);
    assert.ok(sys.db.where('notifications', (n) => n.templateId === 'booking-reconciliation').length === 1);

    await assert.rejects(sys.bookings.refundReconciliation(attemptId, staff('host')), (e) => isDomainError(e, 'forbidden'));
    await sys.bookings.refundReconciliation(attemptId, staff('finance'));
    clock.advance(MINUTE);
    await sys.settle();
    const payment = sys.payments.get(checkout.paymentId);
    assert.equal(payment.status, 'refunded');
    assert.equal(sys.bookings.attempt(attemptId).state, 'failed');
    assert.equal(sys.db.where('alerts', (a) => a.entityId === attemptId && a.resolvedAt === null).length, 0);
  });

  test('a reconciliation retry can still win the table', async () => {
    const { sys, clock } = makeSystem();
    const date = nextWeekday(sys, 2, 2);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
    const checkout = await sys.bookings.submit(attemptId, { policyAccepted: true });
    if (checkout.status !== 'checkout') throw new Error('expected checkout');
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, nextCreate: 'error' } }));
    await pay(sys, clock, checkout.paymentId);
    // 'error' is retried as unknown outcome; after three tries it reconciles.
    clock.advance(MINUTE);
    await sys.settle();
    const state = sys.bookings.attempt(attemptId).state;
    assert.ok(state === 'confirmed' || state === 'reconciliation');
    if (state === 'reconciliation') {
      const r = await sys.bookings.retryReconciliation(attemptId, staff('manager'));
      assert.equal(r.status, 'confirmed');
    }
    assert.equal(sys.db.all('bookings').length, 1);
  });

  test('a hold that lapsed during payment, with the table gone, refunds instead of charging', async () => {
    const { sys, clock } = makeSystem();
    const date = nextWeekday(sys, 2, 2);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
    const checkout = await sys.bookings.submit(attemptId, { policyAccepted: true });
    if (checkout.status !== 'checkout') throw new Error('expected checkout');

    clock.advance(11 * MINUTE); // hold is 10 minutes
    // Someone else books everything left at that time.
    const left = (await sys.reservations.availability({ branchId: 'rosebank', date, partySize: 1 })).slots.find((s) => s.time === time)!.remainingCovers;
    if (left > 0) await sys.reservations.create({ branchId: 'rosebank', date, time, partySize: left, holdId: null, idempotencyKey: 'other-guest' });

    await pay(sys, clock, checkout.paymentId);
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(sys.bookings.attempt(attemptId).state, 'failed');
    assert.equal(sys.bookings.attempt(attemptId).failureReason, 'slot_expired_during_payment');
    assert.equal(sys.payments.get(checkout.paymentId).status, 'refunded');
    assert.equal(sys.db.all('bookings').length, 0);
  });

  test('a full slot is refused with nearby alternatives', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 6, 2); // Saturday, busy
    const a = await sys.bookings.availability('hyde-park', date, 8);
    const full = a.periods.flatMap((p) => p.slots).find((s) => !s.available && s.startsAt > sys.ctx.clock.now() + HOUR);
    assert.ok(full, 'the sandbox has at least one full slot for a party of 8 on Saturday');
    const attempt = sys.bookings.startAttempt({ guestId: null, branchId: 'hyde-park', idempotencyKey: 'k', attribution: null });
    await assert.rejects(sys.bookings.selectSlot(attempt.id, { date, time: full.time, partySize: 8 }), (e) => {
      return isDomainError(e, 'slot_unavailable') && Array.isArray(e.details?.alternatives);
    });
  });

  test('a provider outage is reported, not hidden', async () => {
    const { sys } = makeSystem();
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, reservationOutage: true } }));
    await assert.rejects(sys.bookings.availability('rosebank', nextWeekday(sys, 3), 2), (e) => isDomainError(e, 'provider_unavailable'));
  });

  test('parties above the online limit are sent to the café', async () => {
    const { sys } = makeSystem();
    await assert.rejects(sys.bookings.availability('rosebank', nextWeekday(sys, 3), 13), (e) => isDomainError(e, 'party_too_large'));
  });
});

describe('managing a booking', () => {
  async function confirmedDepositBooking(branchId: string, partySize: number, daysAhead = 5) {
    const { sys, clock } = makeSystem();
    const date = nextWeekday(sys, 2, daysAhead);
    const time = await openSlot(sys, branchId, date, partySize);
    const attemptId = await startBooking(sys, { branchId, date, time, partySize });
    const r = await sys.bookings.submit(attemptId, { policyAccepted: true });
    if (r.status === 'checkout') await pay(sys, clock, r.paymentId);
    const booking = sys.db.all('bookings')[0]!;
    return { sys, clock, booking, date };
  }

  test('cancelling inside the free window refunds the deposit in full', async () => {
    const { sys, clock, booking } = await confirmedDepositBooking('rosebank', 6);
    const { refundMinor } = await sys.bookings.cancel(booking.id, { actor: guestActor(booking.guestId), idempotencyKey: 'c1' });
    assert.equal(refundMinor, 60000);
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(sys.bookings.booking(booking.id).status, 'cancelled');
    assert.equal(sys.payments.get(booking.paymentIds[0]!).status, 'refunded');
    assert.equal(sys.db.where('notifications', (n) => n.templateId === 'booking-reminder' && n.status === 'scheduled').length, 0);
  });

  test('a late cancellation follows the café policy (50% at the Waterfront)', async () => {
    const { sys, clock, booking } = await confirmedDepositBooking('va-waterfront', 6);
    clock.current = booking.startsAt - 10 * HOUR;
    const { refundMinor } = await sys.bookings.cancel(booking.id, { actor: guestActor(booking.guestId), idempotencyKey: 'c2' });
    assert.equal(refundMinor, 36000, '50% of R120 × 6');
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(sys.payments.get(booking.paymentIds[0]!).status, 'partially-refunded');
  });

  test('another guest cannot cancel your booking', async () => {
    const { sys, booking } = await confirmedDepositBooking('rosebank', 6);
    await assert.rejects(sys.bookings.cancel(booking.id, { actor: guestActor('someone-else'), idempotencyKey: 'x' }), (e) => isDomainError(e, 'forbidden'));
  });

  test('growing the party past the deposit threshold collects only the difference', async () => {
    const { sys, clock, booking, date } = await confirmedDepositBooking('rosebank', 2);
    assert.equal(booking.depositPaidMinor, 0);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const r = await sys.bookings.reschedule(booking.id, { date, time, partySize: 6 }, { actor: guestActor(booking.guestId), idempotencyKey: 'r1' });
    assert.equal(r.status, 'checkout');
    if (r.status !== 'checkout') return;
    assert.equal(r.topUpMinor, 60000);
    assert.equal(sys.bookings.booking(booking.id).partySize, 2, 'unchanged until paid');
    await pay(sys, clock, r.paymentId);
    const after = sys.bookings.booking(booking.id);
    assert.equal(after.status, 'amended');
    assert.equal(after.partySize, 6);
    assert.equal(after.depositPaidMinor, 60000);
    assert.equal(after.version, 2);
  });

  test('shrinking the party refunds the deposit difference', async () => {
    const { sys, clock, booking, date } = await confirmedDepositBooking('rosebank', 8);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const r = await sys.bookings.reschedule(booking.id, { date, time, partySize: 6 }, { actor: guestActor(booking.guestId), idempotencyKey: 'r2' });
    assert.equal(r.status, 'amended');
    if (r.status !== 'amended') return;
    assert.equal(r.refundMinor, 20000);
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(sys.payments.get(booking.paymentIds[0]!).status, 'partially-refunded');
    assert.ok(sys.db.where('notifications', (n) => n.templateId === 'booking-amended').length === 1);
  });

  test('changes close at the amendment cut-off', async () => {
    const { sys, clock, booking, date } = await confirmedDepositBooking('morningside', 2);
    clock.current = booking.startsAt - 3 * HOUR;
    await assert.rejects(
      sys.bookings.reschedule(booking.id, { date, time: booking.time, partySize: 3 }, { actor: guestActor(booking.guestId), idempotencyKey: 'r3' }),
      (e) => isDomainError(e, 'amend_cutoff'),
    );
  });
});

describe('waitlist', () => {
  test('a guest can join the waitlist and is told when a matching table frees up', async () => {
    const { sys } = makeSystem();
    const date = nextWeekday(sys, 3, 2);
    const time = await openSlot(sys, 'rosebank', date, 2);
    const holder = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 4 });
    await sys.bookings.submit(holder, { policyAccepted: true });
    await sys.settle();

    const waiter = sys.bookings.startAttempt({ guestId: null, branchId: 'rosebank', idempotencyKey: 'w', attribution: null });
    sys.bookings.setGuestDetails(waiter.id, { ...DETAILS, email: 'waiting@example.com' });
    const w = await sys.bookings.joinWaitlist(waiter.id, { date, time, partySize: 2 });
    assert.equal(w.status, 'waitlisted');
    await sys.settle();

    const held = sys.db.where('bookings', (b) => b.status === 'confirmed')[0]!;
    await sys.bookings.cancel(held.id, { actor: guestActor(held.guestId), idempotencyKey: 'free' });
    await sys.settle();
    const waitGuest = sys.bookings.attempt(waiter.id).guestId!;
    assert.ok(sys.db.where('notifications', (n) => n.guestId === waitGuest && n.templateId === 'waitlist-opening').length === 1);
  });

  test('cafés without an online waitlist refuse it', async () => {
    const { sys } = makeSystem();
    const a = sys.bookings.startAttempt({ guestId: null, branchId: 'umhlanga', idempotencyKey: 'u', attribution: null });
    sys.bookings.setGuestDetails(a.id, DETAILS);
    await assert.rejects(sys.bookings.joinWaitlist(a.id, { date: nextWeekday(sys, 3), time: '09:00', partySize: 2 }), (e) => isDomainError(e, 'waitlist_unavailable'));
  });
});

describe('visit outcomes from the provider', () => {
  test('a verified "completed" webhook completes the booking and earns points exactly once, even when duplicated', async () => {
    const { sys, clock } = makeSystem();
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, duplicateWebhooks: true } }));
    const date = nextWeekday(sys, 3, 2);
    const time = await openSlot(sys, 'morningside', date, 2);
    const attemptId = await startBooking(sys, { branchId: 'morningside', date, time, partySize: 2 });
    await sys.bookings.submit(attemptId, { policyAccepted: true });
    const booking = sys.db.all('bookings')[0]!;

    sys.bookings.staffMarkOutcome(booking.id, 'completed', staff('host'));
    assert.equal(sys.bookings.booking(booking.id).status, 'confirmed', 'nothing changes until the webhook is verified');
    clock.advance(MINUTE);
    await sys.settle();

    assert.equal(sys.bookings.booking(booking.id).status, 'completed');
    assert.equal(sys.rewards.balance(booking.guestId), 50);
    assert.equal(sys.db.where('bookingEvents', (e) => e.outcome === 'processed').length, 1);
    assert.equal(sys.db.where('rewardLedger', (e) => e.type === 'earn').length, 1);
  });

  test('an unsigned or tampered provider webhook is rejected', async () => {
    const { sys } = makeSystem();
    const body = JSON.stringify({ id: 'evt-1', created: sys.ctx.clock.now(), data: { externalId: 'x', status: 'completed' } });
    const forged = await sys.bookings.handleProviderWebhook(utf8(body), { 'x-sandbox-signature': `t=${sys.ctx.clock.now()},v1=deadbeef` });
    assert.equal(forged.httpStatus, 401);
    const stale = await sys.bookings.handleProviderWebhook(utf8(body), {
      'x-sandbox-signature': signatureHeader(SANDBOX_RESERVATIONS_SIGNING_KEY, body, sys.ctx.clock.now() - 10 * MINUTE),
    });
    assert.equal(stale.httpStatus, 401, 'outside the replay window');
    assert.equal(sys.db.where('bookingEvents', (e) => e.outcome === 'rejected').length, 2);
  });

  test('hosts cannot record outcomes for bookings they cannot see', () => {
    const { sys } = makeSystem();
    assert.throws(() => sys.bookings.staffMarkOutcome('nope', 'completed', staff('marketer')), (e) => isDomainError(e, 'forbidden'));
  });
});
