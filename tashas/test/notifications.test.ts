import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { consent, guestActor, makeSystem } from './helpers.ts';
import { DAY, HOUR, MINUTE } from '../src/domain/util/core.ts';

function guest(sys: ReturnType<typeof makeSystem>['sys'], email = 'guest@example.com') {
  return sys.guests.create({ name: 'Guest One', email, phone: '0821234567' });
}

function marketing(sys: ReturnType<typeof makeSystem>['sys'], guestId: string, key: string, channels: ('email' | 'push' | 'in-app' | 'sms')[] = ['email']) {
  return sys.notifications.enqueue({ guestId, templateId: 'campaign-weekend-brunch', data: {}, dedupeKey: key, channels });
}

const deliveries = (sys: ReturnType<typeof makeSystem>['sys'], notificationId: string) =>
  sys.db.where('notificationDeliveries', (d) => d.notificationId === notificationId);

describe('marketing consent', () => {
  test('is blocked without consent and sent with it', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    const a = marketing(sys, g.id, 'm1');
    await sys.notifications.process();
    assert.equal(sys.db.require('notifications', a.id).status, 'suppressed');
    assert.equal(deliveries(sys, a.id)[0]?.lastError, 'no-consent');

    consent(sys, g.id, ['email']);
    sys.notifications.cancelScheduled((n) => n.templateId === 'welcome');
    const b = marketing(sys, g.id, 'm2');
    await sys.notifications.process();
    assert.equal(sys.db.require('notifications', b.id).status, 'sent');
  });

  test('consent on one channel does not cover another', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    consent(sys, g.id, ['email']);
    const n = marketing(sys, g.id, 'm', ['push']);
    await sys.notifications.process();
    assert.equal(deliveries(sys, n.id)[0]?.lastError, 'no-consent');
  });

  test('an opt-out just before sending wins', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    consent(sys, g.id, ['email']);
    const n = marketing(sys, g.id, 'm');
    sys.consent.withdraw(g.id, 'email', 'unsubscribe-link', guestActor(g.id));
    await sys.notifications.process();
    assert.equal(sys.db.require('notifications', n.id).status, 'suppressed');
    assert.match(deliveries(sys, n.id)[0]!.lastError!, /no-consent|suppressed/);
  });

  test('withdrawal is recorded with wording, version and source, and suppresses the contact', () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    consent(sys, g.id, ['email']);
    sys.consent.withdraw(g.id, 'email', 'unsubscribe-link', guestActor(g.id));
    const history = sys.consent.history(g.id);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.status, 'withdrawn');
    assert.equal(history[0]?.source, 'unsubscribe-link');
    assert.ok(history[1]?.consentText.length);
    assert.equal(history[1]?.consentTextVersion, 'marketing-consent-sample-v1');
    assert.ok(sys.consent.suppressionFor(sys.guests.get(g.id), 'email'));
  });

  test('the global suppression list overrides consent', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    consent(sys, g.id, ['email']);
    sys.db.insert('suppression', { id: 'sup1', contactHash: g.contactHash, guestId: null, channel: 'all', reason: 'complaint', createdAt: 0 });
    const n = marketing(sys, g.id, 'm');
    await sys.notifications.process();
    assert.equal(deliveries(sys, n.id)[0]?.lastError, 'suppressed:complaint');
  });

  test('SMS and WhatsApp stay off until configured', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    const n = marketing(sys, g.id, 'm', ['sms']);
    await sys.notifications.process();
    assert.equal(deliveries(sys, n.id)[0]?.lastError, 'channel-not-configured');
  });

  test('frequency caps and open service issues hold marketing back', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    consent(sys, g.id, ['email']);
    sys.notifications.cancelScheduled((n) => n.templateId === 'welcome');
    for (const k of ['a', 'b']) marketing(sys, g.id, k);
    await sys.notifications.process();
    const third = marketing(sys, g.id, 'c');
    await sys.notifications.process();
    assert.equal(deliveries(sys, third.id)[0]?.lastError, 'frequency-cap');

    const other = guest(sys, 'other@example.com');
    consent(sys, other.id, ['email']);
    sys.db.insert('payments', {
      id: 'p-failed', provider: 'x', providerPaymentId: null, purpose: 'reservation-deposit', referenceId: 'r', bookingAttemptId: null,
      guestId: other.id, amountMinor: 100, currency: 'ZAR', status: 'failed', refundedMinor: 0, idempotencyKey: 'pf', gatewayReference: null,
      checkoutUrl: null, description: '', metadata: {}, history: [], createdAt: sys.ctx.clock.now(), updatedAt: sys.ctx.clock.now(),
    });
    const n = marketing(sys, other.id, 'svc');
    await sys.notifications.process();
    assert.equal(deliveries(sys, n.id)[0]?.lastError, 'service-issue');
  });

  test('quiet hours defer marketing to the morning instead of dropping it', async () => {
    const { sys, clock } = makeSystem(Date.UTC(2026, 9, 26, 19, 30)); // 21:30 in Johannesburg
    const g = guest(sys);
    consent(sys, g.id, ['email']);
    sys.notifications.cancelScheduled((n) => n.templateId === 'welcome');
    const n = marketing(sys, g.id, 'night');
    await sys.notifications.process();
    const row = sys.db.require('notifications', n.id);
    assert.equal(row.status, 'scheduled');
    assert.equal(row.scheduledAt, Date.UTC(2026, 9, 27, 6, 0), '08:00 next morning');
    clock.current = row.scheduledAt;
    await sys.notifications.process();
    assert.equal(sys.db.require('notifications', n.id).status, 'sent');
  });
});

describe('service messages', () => {
  test('are not affected by a marketing unsubscribe', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    consent(sys, g.id, ['email']);
    sys.consent.withdraw(g.id, 'email', 'unsubscribe-link', guestActor(g.id));
    const n = sys.notifications.enqueue({ guestId: g.id, templateId: 'payment-receipt', data: { amount: 'R100' }, dedupeKey: 'r' });
    await sys.notifications.process();
    const channels = deliveries(sys, n.id).filter((d) => d.status === 'delivered').map((d) => d.channel).sort();
    assert.deepEqual(channels, ['email', 'in-app']);
  });

  test('a replayed event messages the guest once', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    const first = sys.notifications.enqueue({ guestId: g.id, templateId: 'payment-receipt', data: {}, dedupeKey: 'same' });
    const second = sys.notifications.enqueue({ guestId: g.id, templateId: 'payment-receipt', data: {}, dedupeKey: 'same' });
    assert.equal(first.id, second.id);
    await sys.notifications.process();
    await sys.notifications.process();
    assert.equal(sys.db.where('notificationDeliveries', (d) => d.channel === 'email').length, 1);
  });

  test('temporary email failures retry with backoff and then deliver', async () => {
    const { sys, clock } = makeSystem();
    const g = guest(sys);
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, emailFailures: 2 } }));
    const n = sys.notifications.enqueue({ guestId: g.id, templateId: 'payment-receipt', data: {}, dedupeKey: 'retry' });
    await sys.notifications.process();
    let email = deliveries(sys, n.id).find((d) => d.channel === 'email')!;
    assert.equal(email.status, 'retrying');
    assert.equal(email.attempts, 1);
    assert.equal(sys.db.require('notifications', n.id).status, 'partially-sent', 'the inbox copy already landed');
    clock.advance(15_000);
    await sys.notifications.process();
    clock.advance(30_000);
    await sys.notifications.process();
    email = deliveries(sys, n.id).find((d) => d.channel === 'email')!;
    assert.equal(email.status, 'delivered');
    assert.equal(email.attempts, 3);
    assert.equal(sys.db.require('notifications', n.id).status, 'sent');
  });

  test('a hard bounce suppresses the address', async () => {
    const { sys } = makeSystem();
    const g = guest(sys, 'someone.bounce@example.com');
    const n = sys.notifications.enqueue({ guestId: g.id, templateId: 'payment-receipt', data: {}, dedupeKey: 'b' });
    await sys.notifications.process();
    assert.equal(deliveries(sys, n.id).find((d) => d.channel === 'email')?.status, 'bounced');
    assert.equal(sys.consent.suppressionFor(sys.guests.get(g.id), 'email')?.reason, 'hard-bounce');
  });

  test('a dead push token is invalidated and the message falls back to the inbox', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    sys.guests.registerPushToken(g.id, 'sandbox-invalid-1');
    sys.guests.setPreference(g.id, 'booking', { channels: ['push'] }, guestActor(g.id));
    const n = sys.notifications.enqueue({ guestId: g.id, templateId: 'booking-reminder', data: {}, dedupeKey: 'p', channels: ['push'] });
    await sys.notifications.process();
    assert.equal(sys.guests.get(g.id).pushTokenValid, false);
    assert.ok(deliveries(sys, n.id).some((d) => d.channel === 'in-app' && d.status === 'delivered'));
    assert.equal(sys.notifications.inbox(g.id).length, 1);
  });

  test('erasure stops everything and keeps the opt-out', async () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    sys.guests.erase(g.id, guestActor(g.id));
    const erased = sys.guests.get(g.id);
    assert.equal(erased.email, null);
    assert.equal(erased.name, 'Erased guest');
    const n = sys.notifications.enqueue({ guestId: g.id, templateId: 'payment-receipt', data: {}, dedupeKey: 'e' });
    await sys.notifications.process();
    assert.equal(sys.db.require('notifications', n.id).status, 'suppressed');
    assert.ok(sys.db.where('suppression', (s) => s.contactHash === g.contactHash && s.reason === 'erasure').length === 1);
  });

  test('reminders are scheduled before the visit and cancelled with the booking', async () => {
    const { sys, clock } = makeSystem();
    const g = guest(sys);
    const startsAt = clock.now() + 3 * DAY;
    sys.db.insert('bookings', {
      id: 'b1', reference: 'TSH-AAAAAA', guestId: g.id, branchId: 'morningside', provider: 'x', externalId: null, status: 'confirmed',
      date: '2026-10-29', time: '12:00', period: 'lunch', startsAt, partySize: 2, policyVersion: 'v', depositAmountMinor: 0,
      depositPaidMinor: 0, depositRefundedMinor: 0, paymentIds: [], occasion: null, specialRequest: null, seating: null, attemptId: null,
      attribution: null, version: 1, createdAt: 0, updatedAt: 0,
    });
    sys.outbox.publish({ type: 'booking.confirmed', bookingId: 'b1', guestId: g.id, startsAt: '' }, 'c');
    sys.outbox.dispatch();
    const reminders = sys.db.where('notifications', (n) => n.templateId === 'booking-reminder');
    assert.deepEqual(reminders.map((r) => r.scheduledAt).sort(), [startsAt - 24 * HOUR, startsAt - 2 * HOUR]);

    clock.current = startsAt - 24 * HOUR + MINUTE;
    await sys.notifications.process();
    assert.equal(sys.db.where('notifications', (n) => n.templateId === 'booking-reminder' && n.status === 'sent').length, 1);

    sys.db.update('bookings', 'b1', { status: 'cancelled' });
    sys.outbox.publish({ type: 'booking.cancelled', bookingId: 'b1', guestId: g.id }, 'c');
    sys.outbox.dispatch();
    assert.equal(sys.db.where('notifications', (n) => n.templateId === 'booking-reminder' && n.status === 'scheduled').length, 0);
  });
});

describe('preferences', () => {
  test('booking and service messages always keep the inbox', () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    const p = sys.guests.setPreference(g.id, 'booking', { enabled: false, channels: ['email'] }, guestActor(g.id));
    assert.equal(p.enabled, true);
    assert.deepEqual(p.channels, ['in-app', 'email']);
  });

  test('marketing starts switched off', () => {
    const { sys } = makeSystem();
    const g = guest(sys);
    const m = sys.guests.preferences(g.id).find((p) => p.category === 'marketing');
    assert.equal(m?.enabled, false);
    assert.deepEqual(m?.channels, []);
  });
});
