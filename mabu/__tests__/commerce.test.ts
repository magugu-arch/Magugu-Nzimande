import { newIdempotencyKey } from '@/domain/shared/ids';
import { voucherQrPayload } from '@/domain/vouchers/service';
import { CommerceRegistry, MrDAdapter, UberEatsAdapter } from '@/domain/commerce/providers';
import { DEFAULT_FLAGS, flagsFromEnv } from '@/domain/flags';
import { addGuest, ADMIN, makeBackend, STAFF } from './support/backend';

const purchase = (over = {}) => ({
  amountCents: 100000,
  forSelf: false,
  recipientName: 'Naledi',
  recipientEmail: 'naledi@example.com',
  message: 'Happy birthday!',
  delivery: 'email' as const,
  methodToken: 'tok_mock_success',
  idempotencyKey: newIdempotencyKey(),
  ...over,
});

describe('vouchers', () => {
  it('issues a voucher with a 36-month expiry, emails the recipient and earns points', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    b.rewards.optIn(guest.id, guest);
    const v = await b.vouchers.purchase(purchase(), guest);
    expect(v).toMatchObject({ status: 'active', remainingCents: 100000 });
    expect(v.code).toMatch(/^MABU-\w{4}-\w{4}$/);
    expect(v.expiresAt?.slice(0, 10)).toBe('2029-10-01');
    const toRecipient = b.channels.email.outbox.find((e) => e.to === 'naledi@example.com');
    expect(toRecipient?.body).toContain(v.code);
    expect(b.db.rewardAccounts.list()[0]?.balancePoints).toBe(100);
  });

  it('is idempotent on purchase and takes no money when declined', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const input = purchase();
    const [a, c] = await Promise.all([b.vouchers.purchase(input, guest), b.vouchers.purchase(input, guest)]);
    expect(a.id).toBe(c.id);
    expect(b.db.payments.count()).toBe(1);
    await expect(b.vouchers.purchase(purchase({ methodToken: 'tok_mock_decline' }), guest)).rejects.toThrow(/declined/);
    expect(b.vouchers.listForGuest(guest.id, guest)).toHaveLength(1);
  });

  it('holds a voucher pending while payment settles, then issues it', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const v = await b.vouchers.purchase(purchase({ methodToken: 'tok_mock_pending' }), guest);
    expect(v.status).toBe('pending_payment');
    expect(b.channels.email.outbox).toHaveLength(0);
    await b.payments.settle(v.paymentId!, 'succeeded');
    expect(b.db.vouchers.require(v.id).status).toBe('active');
    expect(b.channels.email.outbox.length).toBeGreaterThan(0);
  });

  it('validates amounts against the policy', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    await expect(b.vouchers.purchase(purchase({ amountCents: 10000 }), guest)).rejects.toThrow(/R250 to R10000/);
    await expect(b.vouchers.purchase(purchase({ amountCents: 30050 }), guest)).rejects.toThrow(/whole rand/);
    expect(() => b.vouchers.updatePolicy({ expiryMonths: 12 }, ADMIN)).toThrow(/36 months/);
  });

  it('redeems in part, refuses replays and overdrafts, and closes at zero', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const v = await b.vouchers.purchase(purchase(), guest);
    const key = newIdempotencyKey();
    await b.vouchers.redeem(v.code, 60000, key, STAFF);
    await b.vouchers.redeem(voucherQrPayload(v.code), 60000, key, STAFF); // replay via QR
    expect(b.db.vouchers.require(v.id).remainingCents).toBe(40000);
    await expect(b.vouchers.redeem(v.code, 50000, newIdempotencyKey(), STAFF)).rejects.toThrow(/Only R400.00/);
    const done = await b.vouchers.redeem(v.code, 40000, newIdempotencyKey(), STAFF);
    expect(done.status).toBe('redeemed');
    await expect(b.vouchers.redeem(v.code, 100, newIdempotencyKey(), STAFF)).rejects.toThrow(/fully used/);
    expect(b.db.audit.count((a) => a.action === 'voucher.redeemed')).toBe(2);
    await expect(b.vouchers.redeem(v.code, 100, newIdempotencyKey(), guest)).rejects.toThrow();
  });

  it('expires on schedule', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const v = await b.vouchers.purchase(purchase(), guest);
    b.clock.set('2029-10-02T09:00:00+02:00');
    await b.runJobs();
    expect(b.db.vouchers.require(v.id).status).toBe('expired');
  });
});

describe('events', () => {
  it('books places, confirms, reminds, and earns on attendance exactly once', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    b.rewards.optIn(guest.id, guest);
    const booking = await b.experiences.book(
      { eventId: 'evt-meerlust-2026-10-27', seats: 2, methodToken: 'tok_mock_success', idempotencyKey: newIdempotencyKey() },
      guest,
    );
    expect(booking).toMatchObject({ status: 'confirmed', amountCents: 180000 });
    expect(b.db.experiences.require('evt-meerlust-2026-10-27').seatsBooked).toBe(33);
    expect(b.db.notificationMessages.find((m) => m.templateKey === 'event.reminder')?.scheduledFor).toBe(
      '2026-10-26T16:30:00.000Z',
    );
    await b.experiences.markAttended(booking.id, STAFF);
    await b.experiences.markAttended(booking.id, STAFF);
    expect(b.db.rewardAccounts.list()[0]?.balancePoints).toBe(400);
  });

  it('waitlists when sold out, without charging', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const booking = await b.experiences.book(
      { eventId: 'evt-chefs-table-2026-11', seats: 2, methodToken: 'tok_mock_success', idempotencyKey: newIdempotencyKey() },
      guest,
    );
    expect(booking.status).toBe('waitlisted');
    expect(b.db.payments.count()).toBe(0);
  });

  it('releases held places when payment is declined', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    await expect(
      b.experiences.book(
        { eventId: 'evt-meerlust-2026-10-27', seats: 2, methodToken: 'tok_mock_decline', idempotencyKey: newIdempotencyKey() },
        guest,
      ),
    ).rejects.toThrow(/declined/);
    expect(b.db.experiences.require('evt-meerlust-2026-10-27').seatsBooked).toBe(31);
  });

  it('refunds and releases on a timely cancellation', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const booking = await b.experiences.book(
      { eventId: 'evt-meerlust-2026-10-27', seats: 1, methodToken: 'tok_mock_success', idempotencyKey: newIdempotencyKey() },
      guest,
    );
    await b.experiences.cancelBooking(booking.id, guest);
    expect(b.db.payments.require(booking.paymentId!).status).toBe('refunded');
    expect(b.db.experiences.require(booking.eventId).seatsBooked).toBe(31);
  });
});

describe('optional commerce', () => {
  it('offers no provider by default and never pretends an unconfigured one works', async () => {
    const registry = new CommerceRegistry(DEFAULT_FLAGS);
    expect(registry.enabled()).toEqual([]);
    await expect(new UberEatsAdapter().quote()).rejects.toMatchObject({ detail: 'UBER_EATS_NOT_CONFIGURED' });
    await expect(new MrDAdapter().createOrder()).rejects.toMatchObject({ detail: 'MR_D_NOT_CONFIGURED' });
    const on = new CommerceRegistry({ ...DEFAULT_FLAGS, uberEatsEnabled: true });
    expect(on.enabled()).toEqual(['uber-eats']);
    await expect(on.provider('uber-eats').quote({} as never)).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});

describe('feature flags', () => {
  it('reads the brief’s variable names, bare or EXPO_PUBLIC_', () => {
    const flags = flagsFromEnv({
      MABU_BOOKING_PROVIDER: '"dineplan"',
      EXPO_PUBLIC_MABU_SMS_ENABLED: 'true',
      MABU_REWARDS_ENABLED: 'false',
    });
    expect(flags).toMatchObject({ bookingProvider: 'dineplan', smsEnabled: true, rewardsEnabled: false });
    expect(flagsFromEnv({}).bookingProvider).toBe('mabu-direct');
  });

  it('switches features off server-side, not only in the UI', async () => {
    const b = makeBackend({ vouchersEnabled: false, bookingEnabled: false });
    const guest = addGuest(b);
    await expect(b.vouchers.purchase(purchase(), guest)).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
    await expect(
      b.reservations.searchAvailability({ venueId: 'mabu-waterfall', date: '2026-10-06', partySize: 2 }),
    ).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
  });
});

describe('scheduled jobs', () => {
  it('sends due reminders and is safe to run repeatedly', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    await b.reservations.create(
      {
        venueId: 'mabu-waterfall',
        slotId: 'mabu-waterfall|2026-10-06|19:00',
        partySize: 2,
        guest: { name: 'Lerato Mokoena', email: 'lerato@example.com', phone: '0825550101' },
        idempotencyKey: newIdempotencyKey(),
      },
      guest,
    );
    b.clock.set('2026-10-05T19:05:00+02:00');
    await b.runJobs();
    await b.runJobs();
    const reminders = b.notifications.inbox(guest.id, guest).filter((i) => i.title === 'We look forward to seeing you');
    expect(reminders).toHaveLength(1);
  });
});
