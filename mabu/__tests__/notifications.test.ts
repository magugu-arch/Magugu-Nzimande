import { quietHoursEnd, MAX_DELIVERY_ATTEMPTS } from '@/domain/notifications/service';
import { assertTemplateSafe, render } from '@/domain/notifications/templates';
import type { NotificationMessage } from '@/domain/notifications/types';
import { addGuest, ADMIN, bookingRequest, makeBackend } from './support/backend';

const message = (
  guestId: string,
  over: Partial<NotificationMessage> = {},
): NotificationMessage => ({
  id: `ntf_${Math.random().toString(36).slice(2)}`,
  guestId,
  category: 'booking',
  templateKey: 'booking.reminder',
  data: {
    date: 'Tuesday 6 October',
    time: '19:00',
    partySize: 2,
    guestName: 'Lerato',
    reference: 'MB-XYZ',
  },
  channels: ['push', 'email', 'in-app'],
  dedupeKey: `test:${Math.random()}`,
  ...over,
});

describe('preferences', () => {
  it('defaults sensibly, and keeps booking and service messages on', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const prefs = await b.notifications.getGuestPreferences(guest.id);
    expect(prefs.find((p) => p.category === 'marketing')?.enabled).toBe(false);
    const booking = prefs.find((p) => p.category === 'booking')!;
    const saved = await b.notifications.updateGuestPreference(
      { ...booking, enabled: false, channels: ['email'] },
      guest,
    );
    expect(saved.enabled).toBe(true);
    expect(saved.channels).toEqual(['email', 'in-app']);
  });

  it('delivers by category on the channels the guest chose', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const rewards = (await b.notifications.getGuestPreferences(guest.id)).find(
      (p) => p.category === 'rewards',
    )!;
    await b.notifications.updateGuestPreference({ ...rewards, enabled: false }, guest);
    await b.notifications.sendNow(
      message(guest.id, {
        category: 'rewards',
        templateKey: 'rewards.earned',
        data: { points: 10 },
      }),
    );
    expect(b.db.notificationMessages.list()[0]?.status).toBe('suppressed');
    expect(b.channels.push.outbox).toHaveLength(0);
  });
});

describe('marketing consent', () => {
  it('blocks marketing without consent, and sends once consent is given', async () => {
    const b = makeBackend({ marketingNotificationsEnabled: true });
    const guest = addGuest(b);
    const other = addGuest(b, 'other@example.com', 'Other Guest');
    const marketing = (await b.notifications.getGuestPreferences(guest.id)).find(
      (p) => p.category === 'marketing',
    )!;
    await b.notifications.updateGuestPreference({ ...marketing, enabled: true }, guest);
    expect(b.db.guests.require(guest.id).consent).toMatchObject({
      marketing: true,
      source: 'app:preference-centre',
    });

    const campaign = b.notifications.scheduleCampaign(
      {
        name: 'Spring menu',
        data: { headline: 'Our spring menu has arrived', body: '…' },
        scheduledFor: '2026-10-01T06:00:00Z',
      },
      ADMIN,
    );
    const [sent] = await b.notifications.runCampaigns();
    expect(sent).toMatchObject({ id: campaign.id, recipients: 1, blockedNoConsent: 1 });
    expect(b.notifications.inbox(guest.id, guest)).toHaveLength(1);
    expect(b.notifications.inbox(other.id, other)).toHaveLength(0);
    expect(await b.notifications.runCampaigns()).toEqual([]);
  });

  it('suppresses a marketing message queued for a guest who withdrew consent', async () => {
    const b = makeBackend({ marketingNotificationsEnabled: true });
    const guest = addGuest(b);
    await b.notifications.optOutOfMarketing(guest.id, guest);
    await b.notifications.sendNow(
      message(guest.id, {
        category: 'marketing',
        templateKey: 'marketing.campaign',
        data: { headline: 'Hi' },
      }),
    );
    expect(b.db.notificationMessages.list()[0]).toMatchObject({
      status: 'suppressed',
      suppressedReason: 'no marketing consent',
    });
  });

  it('blocks all marketing while the feature flag is off', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    await b.notifications.sendNow(
      message(guest.id, {
        category: 'marketing',
        templateKey: 'marketing.campaign',
        data: { headline: 'Hi' },
      }),
    );
    expect(b.db.notificationMessages.list()[0]?.suppressedReason).toBe(
      'marketing notifications disabled',
    );
  });
});

describe('delivery safety', () => {
  it('deduplicates on dedupeKey', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const m = message(guest.id, { dedupeKey: 'same' });
    await b.notifications.sendNow(m);
    await b.notifications.sendNow({ ...m, id: 'another' });
    expect(b.channels.email.outbox).toHaveLength(1);
    expect(b.notifications.inbox(guest.id, guest)).toHaveLength(1);
  });

  it('retries a failed channel with back-off, on one delivery row, and gives up after the limit', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    b.channels.push.failNext = 1;
    await b.notifications.sendNow(message(guest.id, { dedupeKey: 'retry-me' }));
    const [msg] = b.db.notificationMessages.list();
    expect(msg?.status).toBe('partially_sent');
    const push = () => b.db.notificationDeliveries.require(`${msg!.id}:push`);
    expect(push()).toMatchObject({ status: 'pending', attempts: 1 });

    await b.notifications.processDue(); // too soon — back-off holds it
    expect(push().attempts).toBe(1);
    b.clock.advance(61_000);
    await b.notifications.processDue();
    expect(push()).toMatchObject({ status: 'sent', attempts: 2 });
    expect(b.channels.push.outbox).toHaveLength(1);
    expect(
      b.db.notificationDeliveries.count(
        (d) => d.notificationId === msg!.id && d.channel === 'push',
      ),
    ).toBe(1);

    b.channels.email.failNext = 10;
    await b.notifications.sendNow(message(guest.id, { dedupeKey: 'never' }));
    for (let i = 0; i < 6; i++) {
      b.clock.advance(3_600_000);
      await b.notifications.processDue();
    }
    const failed = b.db.notificationDeliveries.find(
      (d) => d.channel === 'email' && d.status === 'failed',
    );
    expect(failed?.attempts).toBe(MAX_DELIVERY_ATTEMPTS);
  });

  it('holds push for quiet hours but files the in-app copy straight away', async () => {
    const b = makeBackend({}, '2026-10-01T23:30:00+02:00');
    const guest = addGuest(b);
    await b.notifications.setQuietHours(guest.id, { start: '22:00', end: '07:00' }, guest);
    await b.notifications.sendNow(message(guest.id));
    expect(b.channels.push.outbox).toHaveLength(0);
    expect(b.notifications.inbox(guest.id, guest)).toHaveLength(1);
    b.clock.set('2026-10-02T07:01:00+02:00');
    await b.notifications.processDue();
    expect(b.channels.push.outbox).toHaveLength(1);
  });

  it('lets an urgent waitlist alert through quiet hours', async () => {
    const b = makeBackend({}, '2026-10-01T23:30:00+02:00');
    const guest = addGuest(b);
    await b.notifications.setQuietHours(guest.id, { start: '22:00', end: '07:00' }, guest);
    await b.notifications.sendNow(
      message(guest.id, { urgent: true, templateKey: 'waitlist.matched' }),
    );
    expect(b.channels.push.outbox).toHaveLength(1);
  });

  it('computes quiet-hour windows across midnight', () => {
    const q = { start: '22:00', end: '07:00' };
    expect(quietHoursEnd(q, new Date('2026-10-01T23:30:00+02:00'))?.toISOString()).toBe(
      '2026-10-02T05:00:00.000Z',
    );
    expect(quietHoursEnd(q, new Date('2026-10-02T06:00:00+02:00'))?.toISOString()).toBe(
      '2026-10-02T05:00:00.000Z',
    );
    expect(quietHoursEnd(q, new Date('2026-10-02T12:00:00+02:00'))).toBeNull();
  });

  it('keeps names and references off the lock screen, in the renderer and at save', () => {
    const rendered = render(
      {
        channel: 'push',
        subject: 'Hi',
        body: 'Hello {{guestName}}, ref {{reference}}, {{date}}',
        version: 1,
      },
      { guestName: 'Lerato', reference: 'MB-1', date: 'Tuesday' },
    );
    expect(rendered.body).toBe('Hello , ref , Tuesday');
    expect(() => assertTemplateSafe({ channel: 'push', body: 'Hi {{guestName}}' })).toThrow(
      /lock screen/,
    );
    expect(() => assertTemplateSafe({ channel: 'email', body: 'Hi {{guestName}}' })).not.toThrow();
  });

  it('versions templates and uses the newest', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    const saved = b.notifications.saveTemplate(
      'booking.reminder',
      'push',
      'See you soon',
      'Table at {{time}} on {{date}}.',
      ADMIN,
    );
    expect(saved.version).toBe(2);
    expect(() =>
      b.notifications.saveTemplate('booking.reminder', 'push', 'x', '{{reference}}', ADMIN),
    ).toThrow();
    await b.notifications.sendNow(message(guest.id));
    expect(b.channels.push.outbox[0]?.body).toBe('Table at 19:00 on Tuesday 6 October.');
    expect(b.db.notificationDeliveries.find((d) => d.channel === 'push')?.templateVersion).toBe(2);
  });
});

describe('resilience', () => {
  it('still books and notifies when analytics is down', async () => {
    const b = makeBackend();
    b.ctx.analytics.addSink({
      send() {
        throw new Error('analytics offline');
      },
    });
    b.ctx.analytics.addSink({ send: () => Promise.reject(new Error('async analytics offline')) });
    const guest = addGuest(b);
    const r = await b.reservations.create(bookingRequest('2026-10-06', '19:00'), guest);
    expect(r.status).toBe('confirmed');
    expect(b.notifications.inbox(guest.id, guest)).toHaveLength(1);
  });

  it('still confirms a booking when a notification handler throws', async () => {
    const b = makeBackend();
    b.ctx.bus.onError = () => undefined;
    b.ctx.bus.subscribe('reservation.confirmed', () => {
      throw new Error('downstream outage');
    });
    const guest = addGuest(b);
    const r = await b.reservations.create(bookingRequest('2026-10-06', '19:00'), guest);
    expect(b.db.reservations.require(r.id).status).toBe('confirmed');
  });
});
