/**
 * Notification orchestrator (brief §13.6).
 *
 * Domain events become notifications through one consumer; each notification
 * has a UNIQUE dedupe key so a replayed event never messages a guest twice.
 * At send time, per channel, it decides again whether this guest may get this
 * message here and now: preferences, consent, suppression, frequency caps,
 * quiet hours and open service issues. Deliveries retry with backoff, a dead
 * push token falls back to the in-app inbox, and every decision is recorded.
 */

import type { Ctx } from '../context.ts';
import { audit } from '../context.ts';
import { branchById } from '../content.ts';
import type { Consumer } from '../outbox.ts';
import { backoffMs } from '../outbox.ts';
import type {
  Actor,
  AppLink,
  Booking,
  Channel,
  Guest,
  NotificationDelivery,
  NotificationRecord,
  TashasDomainEvent,
} from '../types.ts';
import { DAY, HOUR, formatZar } from '../util/core.ts';
import { dateKeyAt, formatDateLong, minutesOf, timeKeyAt, toEpoch, addDays } from '../util/time.ts';
import type { ChannelAdapter } from './channels.ts';
import type { ConsentService } from './consent.ts';
import { template } from './templates.ts';

export const MAX_DELIVERY_ATTEMPTS = 4;

export type Eligibility = { ok: true } | { ok: false; reason: string; defer?: number };

export class NotificationService {
  private ctx: Ctx;
  private consent: ConsentService;
  readonly adapters: Record<Channel, ChannelAdapter>;

  constructor(ctx: Ctx, consent: ConsentService, adapters: Record<Channel, ChannelAdapter>) {
    this.ctx = ctx;
    this.consent = consent;
    this.adapters = adapters;
  }

  // ---------------------------------------------------------- scheduling

  enqueue(input: {
    guestId: string;
    templateId: string;
    data: Record<string, string | number | null>;
    dedupeKey: string;
    scheduledAt?: number;
    link?: AppLink | null;
    campaignId?: string | null;
    channels?: Channel[];
  }): NotificationRecord {
    const { db, ids, clock } = this.ctx;
    const existing = db.byUnique('notifications', 'dedupeKey', input.dedupeKey);
    if (existing) return existing;
    const tpl = template(input.templateId);
    const { title, body } = tpl.render(input.data);
    const now = clock.now();
    return db.insert('notifications', {
      id: ids.id('ntf'),
      guestId: input.guestId,
      category: tpl.category,
      kind: tpl.kind,
      templateId: tpl.id,
      templateVersion: tpl.version,
      title,
      body,
      payload: input.data,
      dedupeKey: input.dedupeKey,
      scheduledAt: input.scheduledAt ?? now,
      status: 'scheduled',
      suppressedReason: null,
      campaignId: input.campaignId ?? null,
      channels: input.channels ?? tpl.channels,
      link: input.link ?? null,
      readAt: null,
      createdAt: now,
    });
  }

  cancelScheduled(predicate: (n: NotificationRecord) => boolean): number {
    const due = this.ctx.db.where('notifications', (n) => n.status === 'scheduled' && predicate(n));
    for (const n of due) this.ctx.db.update('notifications', n.id, { status: 'cancelled' });
    return due.length;
  }

  // ---------------------------------------------------------- eligibility

  private inQuietHours(guest: Guest, now: number): number | null {
    const { quietHours } = this.ctx.db.require('settings', 'global');
    const local = minutesOf(timeKeyAt(now, guest.utcOffsetMinutes));
    const start = minutesOf(quietHours.start);
    const end = minutesOf(quietHours.end);
    const quiet = start > end ? local >= start || local < end : local >= start && local < end;
    if (!quiet) return null;
    const today = dateKeyAt(now, guest.utcOffsetMinutes);
    let resume = toEpoch(today, quietHours.end, guest.utcOffsetMinutes);
    if (resume <= now) resume = toEpoch(addDays(today, 1), quietHours.end, guest.utcOffsetMinutes);
    return resume;
  }

  private marketingSentRecently(guestId: string, now: number): number {
    const ids = new Set(
      this.ctx.db
        .where('notificationDeliveries', (d) => d.guestId === guestId && (d.status === 'delivered' || d.status === 'accepted') && (d.sentAt ?? 0) > now - 7 * DAY)
        .map((d) => d.notificationId),
    );
    return [...ids].filter((id) => this.ctx.db.get('notifications', id)?.kind === 'marketing').length;
  }

  hasOpenServiceIssue(guestId: string, now: number): boolean {
    const { db } = this.ctx;
    if (db.where('bookingAttempts', (a) => a.guestId === guestId && a.state === 'reconciliation').length > 0) return true;
    return db.where('payments', (p) => p.guestId === guestId && p.status === 'failed' && p.updatedAt > now - 2 * DAY).length > 0;
  }

  eligibility(guest: Guest, n: NotificationRecord, channel: Channel, now: number): Eligibility {
    const adapter = this.adapters[channel];
    if (guest.erasedAt) return { ok: false, reason: 'guest-erased' };
    if (!adapter.configured) return { ok: false, reason: 'channel-not-configured' };
    const tpl = template(n.templateId);
    const suppression = this.consent.suppressionFor(guest, channel);
    const pref = this.ctx.db.get('guestPreferences', `${guest.id}:${n.category}`);

    if (n.kind === 'transactional') {
      // Service messages ignore marketing opt-outs, but not bounces or erasure.
      if (suppression && suppression.reason !== 'unsubscribe') return { ok: false, reason: `suppressed:${suppression.reason}` };
      if (tpl.required.includes(channel)) return { ok: true };
      if (channel === 'in-app') return pref?.enabled === false ? { ok: false, reason: 'preference-off' } : { ok: true };
      if (!pref?.enabled) return { ok: false, reason: 'preference-off' };
      if (!pref.channels.includes(channel)) return { ok: false, reason: 'channel-off' };
      return { ok: true };
    }

    // Marketing: every one of these must hold at the moment of sending.
    if (channel !== 'in-app' && !this.consent.hasMarketingConsent(guest.id, channel)) {
      return { ok: false, reason: 'no-consent' };
    }
    if (channel === 'in-app' && !['email', 'push'].some((c) => this.consent.hasMarketingConsent(guest.id, c as Channel))) {
      return { ok: false, reason: 'no-consent' };
    }
    if (suppression) return { ok: false, reason: `suppressed:${suppression.reason}` };
    if (!pref?.enabled || (channel !== 'in-app' && !pref.channels.includes(channel))) {
      return { ok: false, reason: 'preference-off' };
    }
    if (this.hasOpenServiceIssue(guest.id, now)) return { ok: false, reason: 'service-issue' };
    const settings = this.ctx.db.require('settings', 'global');
    const campaign = n.campaignId ? this.ctx.db.get('campaigns', n.campaignId) : undefined;
    const cap = Math.min(settings.marketingFrequencyCapPerWeek, campaign?.frequencyCapPerWeek ?? Infinity);
    if (this.marketingSentRecently(guest.id, now) >= cap) return { ok: false, reason: 'frequency-cap' };
    const resume = this.inQuietHours(guest, now);
    if (resume !== null) return { ok: false, reason: 'quiet-hours', defer: resume };
    return { ok: true };
  }

  // ------------------------------------------------------------- sending

  /** Sends what is due and retries what failed; safe to call repeatedly. */
  async process(): Promise<void> {
    const { db, clock } = this.ctx;
    const now = clock.now();
    for (const n of db.where('notifications', (x) => x.status === 'scheduled' && x.scheduledAt <= now)) {
      await this.dispatch(n.id);
    }
    for (const d of db.where('notificationDeliveries', (x) => x.status === 'retrying' && (x.nextAttemptAt ?? 0) <= now)) {
      await this.attempt(d.id);
    }
  }

  private async dispatch(notificationId: string): Promise<void> {
    const { db, ids, clock } = this.ctx;
    const n = db.require('notifications', notificationId);
    const guest = db.get('guests', n.guestId);
    if (!guest) {
      db.update('notifications', n.id, { status: 'suppressed', suppressedReason: 'no-guest' });
      return;
    }
    const now = clock.now();
    const decisions = n.channels.map((channel) => ({ channel, verdict: this.eligibility(guest, n, channel, now) }));

    const deferral = decisions.find((d) => !d.verdict.ok && d.verdict.reason === 'quiet-hours');
    if (deferral && !deferral.verdict.ok && deferral.verdict.defer) {
      db.update('notifications', n.id, { scheduledAt: deferral.verdict.defer });
      return;
    }

    const deliveryIds: string[] = [];
    db.transaction(() => {
      for (const { channel, verdict } of decisions) {
        const row = db.insert('notificationDeliveries', {
          id: ids.id('dlv'),
          notificationId: n.id,
          guestId: n.guestId,
          channel,
          providerMessageId: null,
          status: verdict.ok ? 'queued' : 'blocked',
          attempts: 0,
          lastError: verdict.ok ? null : verdict.reason,
          nextAttemptAt: null,
          sentAt: null,
        });
        if (verdict.ok) deliveryIds.push(row.id);
      }
      if (deliveryIds.length === 0) {
        const reasons = [...new Set(decisions.map((d) => (d.verdict.ok ? '' : d.verdict.reason)))].join(', ');
        db.update('notifications', n.id, { status: 'suppressed', suppressedReason: reasons });
      }
    });
    for (const id of deliveryIds) await this.attempt(id);
    this.refreshStatus(n.id);
  }

  private async attempt(deliveryId: string): Promise<void> {
    const { db, clock } = this.ctx;
    const d = db.require('notificationDeliveries', deliveryId);
    const n = db.require('notifications', d.notificationId);
    const guest = db.require('guests', d.guestId);
    const now = clock.now();

    if (d.attempts > 0 && n.kind === 'marketing') {
      // An opt-out between attempts wins over the retry.
      const verdict = this.eligibility(guest, n, d.channel, now);
      if (!verdict.ok) {
        db.update('notificationDeliveries', d.id, { status: 'blocked', lastError: verdict.reason, nextAttemptAt: null });
        this.refreshStatus(n.id);
        return;
      }
    }

    const outcome = await this.adapters[d.channel].send(n, guest);
    const attempts = d.attempts + 1;
    db.transaction(() => {
      if (outcome.ok) {
        db.update('notificationDeliveries', d.id, {
          status: outcome.status,
          attempts,
          providerMessageId: outcome.providerMessageId,
          lastError: null,
          nextAttemptAt: null,
          sentAt: clock.now(),
        });
      } else if (!outcome.permanent && attempts < MAX_DELIVERY_ATTEMPTS) {
        db.update('notificationDeliveries', d.id, {
          status: 'retrying',
          attempts,
          lastError: outcome.error,
          nextAttemptAt: clock.now() + backoffMs(attempts),
        });
      } else {
        db.update('notificationDeliveries', d.id, {
          status: outcome.error === 'hard-bounce' ? 'bounced' : 'failed',
          attempts,
          lastError: outcome.error,
          nextAttemptAt: null,
        });
        this.onPermanentFailure(guest, n, d, outcome.error);
      }
    });
    this.refreshStatus(n.id);
  }

  private onPermanentFailure(guest: Guest, n: NotificationRecord, d: NotificationDelivery, error: string): void {
    const { db, ids, clock } = this.ctx;
    if (error === 'hard-bounce' && !db.where('suppression', (s) => s.contactHash === guest.contactHash && s.reason === 'hard-bounce').length) {
      db.insert('suppression', {
        id: ids.id('sup'),
        contactHash: guest.contactHash,
        guestId: guest.id,
        channel: 'email',
        reason: 'hard-bounce',
        createdAt: clock.now(),
      });
    }
    if (error === 'token-invalid') db.update('guests', guest.id, { pushTokenValid: false });
    // Channel fallback: a service message that could not reach the device lands in the inbox.
    if (d.channel === 'push' && n.kind === 'transactional' && !n.channels.includes('in-app')) {
      db.insert('notificationDeliveries', {
        id: ids.id('dlv'),
        notificationId: n.id,
        guestId: n.guestId,
        channel: 'in-app',
        providerMessageId: ids.id('inapp'),
        status: 'delivered',
        attempts: 1,
        lastError: null,
        nextAttemptAt: null,
        sentAt: clock.now(),
      });
    }
  }

  private refreshStatus(notificationId: string): void {
    const { db } = this.ctx;
    const n = db.require('notifications', notificationId);
    if (n.status === 'cancelled' || n.status === 'suppressed') return;
    const ds = db.where('notificationDeliveries', (d) => d.notificationId === notificationId);
    if (ds.length === 0) return;
    const good = ds.filter((d) => d.status === 'delivered' || d.status === 'accepted').length;
    const pending = ds.filter((d) => d.status === 'queued' || d.status === 'retrying').length;
    const attempted = ds.filter((d) => d.status !== 'blocked').length;
    const status =
      pending > 0 && good === 0
        ? n.status
        : good === 0
          ? attempted === 0
            ? 'suppressed'
            : 'failed'
          : good === attempted
            ? 'sent'
            : 'partially-sent';
    if (status !== n.status) db.update('notifications', n.id, { status });
  }

  // --------------------------------------------------------------- inbox

  inbox(guestId: string): NotificationRecord[] {
    const { db } = this.ctx;
    const delivered = new Set(
      db
        .where('notificationDeliveries', (d) => d.guestId === guestId && d.channel === 'in-app' && d.status === 'delivered')
        .map((d) => d.notificationId),
    );
    return db
      .where('notifications', (n) => delivered.has(n.id))
      .sort((a, b) => b.scheduledAt - a.scheduledAt || b.createdAt - a.createdAt);
  }

  unreadCount(guestId: string): number {
    return this.inbox(guestId).filter((n) => !n.readAt).length;
  }

  markRead(notificationId: string, actor: Actor): void {
    const n = this.ctx.db.require('notifications', notificationId);
    if (actor.kind === 'guest' && actor.id !== n.guestId) return;
    if (!n.readAt) this.ctx.db.update('notifications', n.id, { readAt: this.ctx.clock.now() });
  }

  markAllRead(guestId: string): void {
    this.ctx.db.transaction(() => {
      for (const n of this.inbox(guestId)) if (!n.readAt) this.ctx.db.update('notifications', n.id, { readAt: this.ctx.clock.now() });
    });
  }

  // ----------------------------------------------- events → notifications

  private bookingData(b: Booking): Record<string, string | number | null> {
    const branch = branchById(this.ctx.content, b.branchId);
    return {
      branch: branch.name,
      date: formatDateLong(b.date),
      time: b.time,
      party: `${b.partySize} ${b.partySize === 1 ? 'guest' : 'guests'}`,
      reference: b.reference,
      deposit: b.depositPaidMinor > 0 ? formatZar(b.depositPaidMinor) : null,
    };
  }

  private scheduleReminders(b: Booking): void {
    const policy = branchById(this.ctx.content, b.branchId).policy;
    const override = this.ctx.db.get('branchOverrides', b.branchId)?.policy.reminderOffsetsHours;
    const offsets = override ?? policy.reminderOffsetsHours;
    const now = this.ctx.clock.now();
    for (const h of offsets) {
      const at = b.startsAt - h * HOUR;
      if (at <= now) continue;
      const when = h >= 20 ? 'tomorrow' : 'soon';
      this.enqueue({
        guestId: b.guestId,
        templateId: 'booking-reminder',
        data: { ...this.bookingData(b), when },
        dedupeKey: `reminder:${b.id}:v${b.version}:${h}h`,
        scheduledAt: at,
        link: { screen: 'booking', id: b.id },
      });
    }
  }

  private cancelReminders(bookingId: string): void {
    this.cancelScheduled((n) => n.templateId === 'booking-reminder' && n.link?.id === bookingId);
  }

  readonly consumer: Consumer = {
    name: 'notifications',
    handle: (event: TashasDomainEvent) => this.onEvent(event),
  };

  private onEvent(event: TashasDomainEvent): void {
    const { db } = this.ctx;
    const link = (screen: AppLink['screen'], id?: string): AppLink => (id ? { screen, id } : { screen });
    switch (event.type) {
      case 'booking.confirmed': {
        const b = db.require('bookings', event.bookingId);
        this.enqueue({
          guestId: b.guestId,
          templateId: 'booking-confirmed',
          data: this.bookingData(b),
          dedupeKey: `booking-confirmed:${b.id}`,
          link: link('booking', b.id),
        });
        this.scheduleReminders(b);
        return;
      }
      case 'booking.amended': {
        const b = db.require('bookings', event.bookingId);
        this.cancelReminders(b.id);
        const refunded = db
          .where('refunds', (r) => b.paymentIds.includes(r.paymentId) && r.reason.startsWith('Deposit difference'))
          .reduce((n, r) => n + r.amountMinor, 0);
        this.enqueue({
          guestId: b.guestId,
          templateId: 'booking-amended',
          data: { ...this.bookingData(b), refund: refunded ? formatZar(refunded) : null },
          dedupeKey: `booking-amended:${b.id}:v${b.version}`,
          link: link('booking', b.id),
        });
        this.scheduleReminders(b);
        return;
      }
      case 'booking.cancelled': {
        const b = db.require('bookings', event.bookingId);
        this.cancelReminders(b.id);
        const byCafe = event.reason === 'cancelled-by-cafe';
        const refundable = b.depositPaidMinor;
        const refund = b.depositRefundedMinor;
        this.enqueue({
          guestId: b.guestId,
          templateId: byCafe ? 'booking-cancelled-by-cafe' : 'booking-cancelled',
          data: {
            ...this.bookingData(b),
            refund: refund > 0 ? formatZar(refund) : null,
            forfeit: refundable - refund > 0 ? formatZar(refundable - refund) : null,
          },
          dedupeKey: `booking-cancelled:${b.id}`,
          link: link('booking', b.id),
        });
        // A freed table is offered to the waitlist, never booked on their behalf.
        for (const w of db.where(
          'bookings',
          (x) =>
            x.status === 'waitlisted' &&
            x.branchId === b.branchId &&
            x.date === b.date &&
            Math.abs(minutesOf(x.time) - minutesOf(b.time)) <= 60 &&
            x.partySize <= b.partySize,
        )) {
          this.enqueue({
            guestId: w.guestId,
            templateId: 'waitlist-opening',
            data: this.bookingData({ ...w, time: b.time }),
            dedupeKey: `waitlist-opening:${w.id}:${b.id}`,
            link: { screen: 'book', id: w.branchId },
          });
        }
        return;
      }
      case 'booking.waitlisted': {
        const b = db.require('bookings', event.bookingId);
        this.enqueue({
          guestId: b.guestId,
          templateId: 'booking-waitlisted',
          data: this.bookingData(b),
          dedupeKey: `booking-waitlisted:${b.id}`,
          link: link('booking', b.id),
        });
        return;
      }
      case 'booking.completed': {
        const b = db.require('bookings', event.bookingId);
        this.enqueue({
          guestId: b.guestId,
          templateId: 'visit-thanks',
          data: this.bookingData(b),
          dedupeKey: `visit-thanks:${b.id}`,
          link: link('booking', b.id),
        });
        return;
      }
      case 'booking.no-show': {
        const b = db.require('bookings', event.bookingId);
        this.enqueue({
          guestId: b.guestId,
          templateId: 'booking-no-show',
          data: { ...this.bookingData(b), forfeit: b.depositPaidMinor > 0 ? formatZar(b.depositPaidMinor) : null },
          dedupeKey: `booking-no-show:${b.id}`,
          link: link('booking', b.id),
        });
        return;
      }
      case 'booking.reconciliation-required': {
        const a = db.require('bookingAttempts', event.attemptId);
        if (!a.guestId) return;
        this.enqueue({
          guestId: a.guestId,
          templateId: 'booking-reconciliation',
          data: { branch: branchById(this.ctx.content, a.branchId).name, amount: formatZar(a.depositAmountMinor) },
          dedupeKey: `booking-reconciliation:${a.id}`,
          link: { screen: 'booking', id: `attempt:${a.id}` },
        });
        return;
      }
      case 'booking.failed': {
        const a = db.require('bookingAttempts', event.attemptId);
        // Synchronous failures are shown on screen; only tell guests about ones that resolved later.
        if (!a.guestId || (!a.paymentId && a.providerCreateAttempts < 2)) return;
        const refund = a.paymentId
          ? db.where('refunds', (r) => r.paymentId === a.paymentId).reduce((n, r) => n + r.amountMinor, 0)
          : 0;
        this.enqueue({
          guestId: a.guestId,
          templateId: 'booking-failed',
          data: {
            branch: branchById(this.ctx.content, a.branchId).name,
            date: a.selectedSlot ? formatDateLong(a.selectedSlot.date) : '',
            time: a.selectedSlot?.time ?? '',
            refund: refund > 0 ? formatZar(refund) : null,
          },
          dedupeKey: `booking-failed:${a.id}`,
          link: { screen: 'booking', id: `attempt:${a.id}` },
        });
        return;
      }
      case 'payment.succeeded':
      case 'payment.failed':
      case 'payment.refunded': {
        const p = db.require('payments', event.paymentId);
        if (!p.guestId) return;
        const amount = event.type === 'payment.refunded' ? event.amountMinor : p.amountMinor;
        const id =
          event.type === 'payment.succeeded' ? 'payment-receipt' : event.type === 'payment.failed' ? 'payment-failed' : 'payment-refunded';
        const refundSeq = event.type === 'payment.refunded' ? `:${p.refundedMinor}` : '';
        this.enqueue({
          guestId: p.guestId,
          templateId: id,
          data: { amount: formatZar(amount), description: p.description, reference: p.gatewayReference ?? p.id },
          dedupeKey: `${id}:${p.id}${refundSeq}`,
          link: p.bookingAttemptId ? { screen: 'booking', id: `attempt:${p.bookingAttemptId}` } : null,
        });
        return;
      }
      case 'reward.earned': {
        const balance = db
          .where('rewardLedger', (r) => r.guestId === event.guestId)
          .reduce((n, r) => n + r.points, 0);
        const booking = db.get('bookings', event.referenceId);
        this.enqueue({
          guestId: event.guestId,
          templateId: 'reward-earned',
          data: {
            points: event.points,
            balance,
            branch: booking ? branchById(this.ctx.content, booking.branchId).name : 'Tashas',
          },
          dedupeKey: `reward-earned:${event.referenceId}`,
          link: link('rewards'),
        });
        return;
      }
      case 'reward.redeemed': {
        const v = db.require('vouchers', event.voucherId);
        this.enqueue({
          guestId: event.guestId,
          templateId: 'reward-redeemed',
          data: { title: v.title, code: v.code, expires: formatDateLong(dateKeyAt(v.expiresAt, 120)) },
          dedupeKey: `reward-redeemed:${v.id}`,
          link: link('rewards'),
        });
        return;
      }
      case 'event-booking.confirmed': {
        const eb = db.require('eventBookings', event.eventBookingId);
        const listing = this.ctx.content.events.find((e) => e.id === eb.eventId);
        if (!listing) return;
        const branch = branchById(this.ctx.content, listing.branchId);
        const today = dateKeyAt(eb.createdAt, branch.utcOffsetMinutes);
        this.enqueue({
          guestId: eb.guestId,
          templateId: 'event-confirmed',
          data: {
            event: listing.title,
            branch: branch.name,
            date: formatDateLong(addDays(today, listing.dayOffset)),
            time: listing.time,
            party: `${eb.partySize} ${eb.partySize === 1 ? 'guest' : 'guests'}`,
            reference: eb.reference,
          },
          dedupeKey: `event-confirmed:${eb.id}`,
          link: link('event', listing.id),
        });
        return;
      }
      case 'guest.consent-changed': {
        if (event.status !== 'granted') return;
        // Welcome journey: first opt-in only, on the channel just consented to.
        this.enqueue({
          guestId: event.guestId,
          templateId: 'welcome',
          data: {},
          dedupeKey: `welcome:${event.guestId}`,
          channels: [event.channel],
        });
        return;
      }
      default:
        return;
    }
  }

  recordTestSend(campaignId: string, actor: Actor): void {
    audit(this.ctx, actor, 'campaign.test-send', 'campaign', campaignId);
  }
}
