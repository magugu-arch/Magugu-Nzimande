import { isDomainError } from '@/domain/shared/errors';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { NO_AVAILABILITY_MESSAGE } from '@/domain/reservations/service';
import { slotIdOf } from '@/domain/reservations/slots';
import { addGuest, ADMIN, bookingRequest, makeBackend, STAFF, VENUE } from './support/backend';

const TUESDAY = '2026-10-06';
const FRIDAY = '2026-10-02';
const MONDAY = '2026-10-05';

async function expectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    expect(isDomainError(error) && error.code).toBe(code);
    return error;
  }
  throw new Error(`expected ${code}`);
}

describe('availability', () => {
  it('offers lunch and dinner seatings on an open day, only after the lead time', async () => {
    const b = makeBackend();
    const slots = await b.reservations.searchAvailability({
      venueId: VENUE,
      date: TUESDAY,
      partySize: 2,
    });
    expect(slots.map((s) => s.startsAt.slice(11, 16))).toEqual([
      '12:00',
      '12:30',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '18:00',
      '18:30',
      '19:00',
      '19:30',
      '20:00',
      '20:30',
      '21:00',
      '21:30',
    ]);
    expect(slots.every((s) => s.provider === 'mabu-direct')).toBe(true);
  });

  it('has nothing on a closed day, and knows it without asking the provider', async () => {
    const b = makeBackend();
    expect(
      await b.reservations.searchAvailability({ venueId: VENUE, date: MONDAY, partySize: 2 }),
    ).toEqual([]);
    const states = await b.reservations.dayStates(FRIDAY, 4, 2);
    expect(states[MONDAY]).toBe('closed');
    expect(states[FRIDAY]).toBe('available');
  });

  it('never marks a prime Friday seating available when it is committed', async () => {
    const b = makeBackend();
    const slots = await b.reservations.searchAvailability({
      venueId: VENUE,
      date: FRIDAY,
      partySize: 2,
    });
    const prime = slots.filter(
      (s) => s.startsAt.slice(11, 16) >= '19:00' && s.startsAt.slice(11, 16) <= '20:00',
    );
    expect(prime.length).toBe(3);
    expect(prime.every((s) => !s.available)).toBe(true);
  });

  it('routes very large parties to private functions rather than a table', async () => {
    const b = makeBackend();
    const error = await expectCode(
      b.reservations.searchAvailability({ venueId: VENUE, date: TUESDAY, partySize: 14 }),
      'POLICY_VIOLATION',
    );
    expect((error as Error).message).toMatch(/Private Functions/);
  });

  it('refuses past dates and dates beyond the booking window', async () => {
    const b = makeBackend();
    await expectCode(
      b.reservations.searchAvailability({ venueId: VENUE, date: '2026-09-30', partySize: 2 }),
      'VALIDATION',
    );
    await expectCode(
      b.reservations.searchAvailability({ venueId: VENUE, date: '2027-06-01', partySize: 2 }),
      'POLICY_VIOLATION',
    );
  });
});

describe('creating a reservation', () => {
  it('confirms, records an audit trail, notifies and schedules both reminders', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const r = await b.reservations.create(
      bookingRequest(TUESDAY, '19:00', 2, {
        occasion: 'anniversary',
        dietaryNotes: 'No shellfish',
      }),
      guest,
    );
    expect(r.status).toBe('confirmed');
    expect(r.reference).toMatch(/^MB-/);
    expect(r.guestPhone).toBe('+27825550101');
    expect(b.reservations.history(r.id, guest).map((e) => e.eventType)).toEqual([
      'created',
      'confirmed',
    ]);

    const inbox = b.notifications.inbox(guest.id, guest);
    expect(inbox[0]?.title).toBe('Your table at Mábu is reserved.');
    expect(b.channels.email.outbox[0]?.body).toContain(r.reference);
    // Lock-screen copy carries no name and no reference (§42).
    expect(b.channels.push.outbox[0]?.body).not.toContain('Lerato');
    expect(b.channels.push.outbox[0]?.body).not.toContain(r.reference);

    const scheduled = b.db.notificationMessages.filter((m) => m.status === 'scheduled');
    expect(scheduled.map((m) => m.scheduledFor)).toEqual([
      '2026-10-05T17:00:00.000Z', // 24h before 19:00 SAST
      '2026-10-06T14:00:00.000Z', // 3h before
    ]);
  });

  it('creates exactly one booking however often the same request is retried', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const req = bookingRequest(TUESDAY, '19:00');
    const [a, c] = await Promise.all([
      b.reservations.create(req, guest),
      b.reservations.create(req, guest),
    ]);
    const d = await b.reservations.create(req, guest);
    expect(new Set([a.id, c.id, d.id]).size).toBe(1);
    expect(b.db.reservations.count()).toBe(1);
    expect(b.channels.email.outbox).toHaveLength(1);
  });

  it('refuses to reuse a key for a different request', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const req = bookingRequest(TUESDAY, '19:00');
    await b.reservations.create(req, guest);
    await expectCode(b.reservations.create({ ...req, partySize: 4 }, guest), 'CONFLICT');
  });

  it('re-verifies the slot and leaves nothing behind when it has gone', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const error = await expectCode(
      b.reservations.create(bookingRequest(FRIDAY, '19:30'), guest),
      'SLOT_UNAVAILABLE',
    );
    expect((error as Error).message).toBe(NO_AVAILABILITY_MESSAGE);
    expect(b.db.reservations.count()).toBe(0);
    expect(b.ctx.analytics.log.some((l) => l.event === 'reservation_failed')).toBe(true);
  });

  it('turns an unconfigured provider into a recoverable, human error', async () => {
    const b = makeBackend({ bookingProvider: 'dineplan' });
    const guest = addGuest(b);
    const error = await expectCode(
      b.reservations.searchAvailability({ venueId: VENUE, date: TUESDAY, partySize: 2 }),
      'NOT_CONFIGURED',
    );
    expect((error as Error).message).toMatch(/phone or email/);
    await expectCode(
      b.reservations.create(bookingRequest(TUESDAY, '19:00'), guest),
      'NOT_CONFIGURED',
    );
    expect(b.db.reservations.count()).toBe(0);
  });

  it('validates contact details and notes', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    await expectCode(
      b.reservations.create(
        bookingRequest(TUESDAY, '19:00', 2, { guest: { name: 'L', email: 'x', phone: '1' } }),
        guest,
      ),
      'VALIDATION',
    );
    await expectCode(
      b.reservations.create(bookingRequest(TUESDAY, '19:00', 2, { children: 2 }), guest),
      'VALIDATION',
    );
  });

  it('holds a booking that needs a deposit until the deposit is paid', async () => {
    const b = makeBackend({ bookingDepositEnabled: true });
    b.reservations.updatePolicy(ADMIN, {
      deposit: { enabled: true, perPersonCents: 20000, appliesFromPartySize: 6 },
    });
    const guest = addGuest(b);
    const r = await b.reservations.create(bookingRequest(TUESDAY, '18:00', 6), guest);
    expect(r).toMatchObject({
      status: 'requested',
      depositStatus: 'pending',
      depositCents: 120000,
    });
    const declined = await b.reservations.payDeposit(
      r.id,
      'tok_mock_decline',
      newIdempotencyKey(),
      guest,
    );
    expect(declined.depositStatus).toBe('failed');
    const paid = await b.reservations.payDeposit(
      r.id,
      'tok_mock_success',
      newIdempotencyKey(),
      guest,
    );
    expect(paid).toMatchObject({ status: 'confirmed', depositStatus: 'paid' });
  });
});

describe('managing a reservation', () => {
  it('keeps one guest out of another guest’s booking', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const other = addGuest(b, 'someone@example.com', 'Someone Else');
    const r = await b.reservations.create(bookingRequest(TUESDAY, '19:00'), guest);
    expect(() => b.reservations.get(r.id, other)).toThrow('We could not find that booking.');
    expect(b.reservations.get(r.id, STAFF).id).toBe(r.id);
  });

  it('reschedules, moving the reminders with it', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const r = await b.reservations.create(bookingRequest(TUESDAY, '19:00'), guest);
    const moved = await b.reservations.reschedule(
      r.id,
      slotIdOf(VENUE, TUESDAY, '20:30'),
      guest,
      newIdempotencyKey(),
    );
    expect(moved.status).toBe('rescheduled');
    expect(moved.startsAt).toBe('2026-10-06T20:30:00+02:00');
    const scheduled = b.db.notificationMessages.filter((m) => m.status === 'scheduled');
    expect(scheduled.every((m) => m.dedupeKey.endsWith('2026-10-06T20:30:00+02:00'))).toBe(true);
    expect(b.db.notificationMessages.count((m) => m.status === 'cancelled')).toBe(2);
  });

  it('amends notes, and refuses guest changes inside the cut-off', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const r = await b.reservations.create(bookingRequest(TUESDAY, '19:00'), guest);
    const amended = await b.reservations.amend(
      r.id,
      { specialRequest: 'Window table please' },
      guest,
      newIdempotencyKey(),
    );
    expect(amended.specialRequest).toBe('Window table please');
    b.clock.set('2026-10-06T16:00:00+02:00');
    await expectCode(
      b.reservations.amend(r.id, { specialRequest: 'x' }, guest, newIdempotencyKey()),
      'POLICY_VIOLATION',
    );
  });

  it('records a cancellation in time, and a late one as late', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const early = await b.reservations.create(bookingRequest(TUESDAY, '19:00'), guest);
    const late = await b.reservations.create(bookingRequest('2026-10-01', '19:00'), guest);
    expect((await b.reservations.cancel(early.id, guest, newIdempotencyKey())).policyOutcome).toBe(
      'cancelled_in_time',
    );
    expect((await b.reservations.cancel(late.id, guest, newIdempotencyKey())).policyOutcome).toBe(
      'late_cancellation',
    );
    expect(b.notifications.inbox(guest.id, guest)[0]?.title).toBe('Your booking is cancelled');
  });

  it('keeps staff notes off the guest record', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const r = await b.reservations.create(bookingRequest(TUESDAY, '19:00'), guest);
    b.reservations.addStaffNote(r.id, 'Regular — prefers banquette', STAFF);
    expect(JSON.stringify(b.reservations.get(r.id, guest))).not.toContain('banquette');
    expect(() => b.reservations.staffNotes(r.id, guest)).toThrow();
    expect(b.reservations.staffNotes(r.id, STAFF)).toHaveLength(1);
  });

  it('stores provider webhooks once', async () => {
    const b = makeBackend();
    expect(b.reservations.ingestWebhook('dineplan', 'evt_1', 'booking.updated', {})).toBe(true);
    expect(b.reservations.ingestWebhook('dineplan', 'evt_1', 'booking.updated', {})).toBe(false);
    expect(b.db.providerWebhookEvents.count()).toBe(1);
  });
});

describe('waitlist', () => {
  it('matches a waiting guest when a table frees, notifies urgently, and books through the normal path', async () => {
    const b = makeBackend();
    // Three covers: the fixture's other-channel demand here is 0–1, so one party of two fills it.
    b.reservations.updatePolicy(ADMIN, { coversPerSlot: 3 });
    b.reservations.updatePolicy(ADMIN, {
      servicePeriods: [
        { id: 'dinner', label: 'Dinner', firstSeating: '19:00', lastSeating: '19:00', days: [2] },
      ],
    });
    const first = addGuest(b);
    const waiting = addGuest(b, 'thabo@example.com', 'Thabo Nkosi');
    const held = await b.reservations.create(bookingRequest(TUESDAY, '19:00', 2), first);

    const slots = await b.reservations.searchAvailability({
      venueId: VENUE,
      date: TUESDAY,
      partySize: 2,
    });
    expect(slots.some((s) => s.available)).toBe(false);
    const { waitlistId } = await b.reservations.joinWaitlist(
      { venueId: VENUE, date: TUESDAY, partySize: 2, preferredTime: '19:00' },
      waiting,
    );
    // Joining twice is one entry.
    expect(
      (await b.reservations.joinWaitlist({ venueId: VENUE, date: TUESDAY, partySize: 2 }, waiting))
        .waitlistId,
    ).toBe(waitlistId);

    await b.reservations.cancel(held.id, first, newIdempotencyKey());
    const entry = b.db.waitlist.require(waitlistId);
    expect(entry.status).toBe('matched');
    const alert = b.notifications.inbox(waiting.id, waiting)[0];
    expect(alert?.title).toBe('A table has opened up');
    expect(alert?.deepLink).toBe(`/book?waitlist=${waitlistId}`);

    const booked = await b.reservations.create(
      bookingRequest(TUESDAY, '19:00', 2, {
        waitlistId,
        guest: { name: 'Thabo Nkosi', email: 'thabo@example.com', phone: '0825550102' },
      }),
      waiting,
    );
    expect(booked.status).toBe('confirmed');
    expect(b.db.waitlist.require(waitlistId).status).toBe('booked');
  });
});

describe('visit completion', () => {
  it('earns the visit reward exactly once and never for a no-show', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    b.rewards.optIn(guest.id, guest);
    const r = await b.reservations.create(bookingRequest('2026-10-01', '12:00'), guest);
    const missed = await b.reservations.create(bookingRequest('2026-10-01', '13:00'), guest);
    b.clock.set('2026-10-01T15:00:00+02:00');

    await b.reservations.markCompleted(r.id, STAFF);
    await b.reservations.markCompleted(r.id, STAFF);
    // Replaying the domain event must not pay out again either.
    await b.ctx.bus.publish({
      type: 'reservation.completed',
      reservationId: r.id,
      guestId: guest.id,
    });
    await b.reservations.markNoShow(missed.id, STAFF);

    const account = await b.rewards.getAccount(guest.id);
    expect(account.balancePoints).toBe(250);
    expect(b.db.rewardTransactions.count((t) => t.type === 'earn')).toBe(1);
    expect(b.db.reservations.require(missed.id).policyOutcome).toBe('no_show');
  });

  it('will not complete a booking that has not started, and only staff may', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const r = await b.reservations.create(bookingRequest(TUESDAY, '19:00'), guest);
    await expectCode(b.reservations.markCompleted(r.id, STAFF), 'POLICY_VIOLATION');
    await expectCode(b.reservations.markCompleted(r.id, guest), 'FORBIDDEN');
  });
});
