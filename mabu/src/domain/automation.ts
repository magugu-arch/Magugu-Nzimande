import type { ServiceContext } from './context';
import type { ExperiencesService } from './experiences/service';
import type { NotificationsService } from './notifications/service';
import type { NotificationChannel, NotificationMessage } from './notifications/types';
import type { ReservationsService } from './reservations/service';
import type { RewardsEngine } from './rewards/service';
import type { VouchersService } from './vouchers/service';
import { formatDateLong, formatDateWithYear, formatRand, formatTime } from './shared/format';

const BOOKING_CHANNELS: NotificationChannel[] = ['push', 'email', 'in-app'];
export const EVENT_REMINDER_HOURS = 24;

interface Services {
  reservations: ReservationsService;
  rewards: RewardsEngine;
  notifications: NotificationsService;
  experiences: ExperiencesService;
  vouchers: VouchersService;
}

/**
 * The §41 trigger table, wired onto the domain event bus. Reservation code
 * publishes facts; this module decides who hears about them. Everything sent
 * here carries a dedupeKey, so replaying an event never reaches a guest twice.
 */
export function wireAutomation(ctx: ServiceContext, s: Services): void {
  const bus = ctx.bus;
  const msg = (m: Omit<NotificationMessage, 'id'>): NotificationMessage => ({
    ...m,
    id: ctx.ids.id('ntf'),
  });

  const bookingData = (reservationId: string) => {
    const r = ctx.db.reservations.require(reservationId);
    return {
      r,
      data: {
        guestName: r.guestName.split(' ')[0] ?? r.guestName,
        reference: r.reference,
        date: formatDateLong(r.startsAt),
        time: formatTime(r.startsAt),
        partySize: r.partySize,
        amount: formatRand(r.depositCents),
        policy: s.reservations.policy().cancellationPolicyText,
      },
    };
  };

  const reminderKey = (reservationId: string, startsAt: string, hours: number) =>
    `reservation:${reservationId}:reminder:${hours}h:${startsAt}`;

  const scheduleReminders = async (reservationId: string) => {
    const { r, data } = bookingData(reservationId);
    const now = ctx.clock.now().getTime();
    for (const hours of s.reservations.policy().reminderHoursBefore) {
      const at = new Date(r.startsAt).getTime() - hours * 3_600_000;
      if (at <= now) continue;
      await s.notifications.queue(
        msg({
          guestId: r.guestId,
          category: 'booking',
          templateKey: 'booking.reminder',
          data,
          channels: BOOKING_CHANNELS,
          scheduledFor: new Date(at).toISOString(),
          deepLink: `/booking/${r.id}`,
          dedupeKey: reminderKey(r.id, r.startsAt, hours),
        }),
      );
    }
  };

  const cancelReminders = async (reservationId: string, startsAt: string) => {
    for (const hours of s.reservations.policy().reminderHoursBefore) {
      await s.notifications.cancel(reminderKey(reservationId, startsAt, hours));
    }
  };

  /* ── Booking ──────────────────────────────────────────────────────── */

  bus.subscribe('reservation.confirmed', async (e) => {
    const { r, data } = bookingData(e.reservationId);
    const paid = r.depositStatus === 'paid';
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'booking',
        templateKey: paid ? 'deposit.paid' : 'booking.confirmed',
        data,
        channels: BOOKING_CHANNELS,
        deepLink: `/booking/${r.id}`,
        dedupeKey: `reservation:${r.id}:confirmed`,
      }),
    );
    await scheduleReminders(r.id);
  });

  bus.subscribe('reservation.requested', async (e) => {
    const { r, data } = bookingData(e.reservationId);
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'booking',
        templateKey: 'booking.requested',
        data,
        channels: BOOKING_CHANNELS,
        deepLink: `/booking/${r.id}`,
        dedupeKey: `reservation:${r.id}:requested`,
      }),
    );
  });

  bus.subscribe('reservation.rescheduled', async (e) => {
    await cancelReminders(e.reservationId, e.previousStartsAt);
    const { r, data } = bookingData(e.reservationId);
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'booking',
        templateKey: 'booking.rescheduled',
        data,
        channels: BOOKING_CHANNELS,
        deepLink: `/booking/${r.id}`,
        dedupeKey: `reservation:${r.id}:rescheduled:${e.startsAt}`,
      }),
    );
    if (r.status !== 'requested') await scheduleReminders(r.id);
  });

  bus.subscribe('reservation.amended', async (e) => {
    const { r, data } = bookingData(e.reservationId);
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'booking',
        templateKey: 'booking.amended',
        data,
        channels: ['in-app'],
        deepLink: `/booking/${r.id}`,
        dedupeKey: `reservation:${r.id}:amended:${r.updatedAt}`,
      }),
    );
  });

  bus.subscribe('reservation.cancelled', async (e) => {
    await cancelReminders(e.reservationId, e.startsAt);
    const { data } = bookingData(e.reservationId);
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'booking',
        templateKey: 'booking.cancelled',
        data,
        channels: BOOKING_CHANNELS,
        deepLink: '/profile/bookings',
        dedupeKey: `reservation:${e.reservationId}:cancelled`,
      }),
    );
  });

  bus.subscribe('waitlist.matched', async (e) => {
    const entry = ctx.db.waitlist.require(e.waitlistId);
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'booking',
        templateKey: 'waitlist.matched',
        data: {
          date: formatDateLong(e.startsAt),
          time: formatTime(e.startsAt),
          partySize: entry.query.partySize,
        },
        channels: BOOKING_CHANNELS,
        urgent: true,
        deepLink: `/book?waitlist=${e.waitlistId}`,
        dedupeKey: `waitlist:${e.waitlistId}:matched`,
      }),
    );
  });

  /* ── Rewards ──────────────────────────────────────────────────────── */

  bus.subscribe('reservation.completed', async (e) => {
    await s.rewards.applyTrigger('completed_visit', e.guestId, 'reservation', e.reservationId);
    const completedVisits = ctx.db.reservations.count(
      (r) => r.guestId === e.guestId && r.status === 'completed',
    );
    if (completedVisits === 1) await s.rewards.creditReferral(e.guestId);
  });

  bus.subscribe('event.attended', async (e) => {
    await s.rewards.applyTrigger('event_attendance', e.guestId, 'event', e.bookingId);
  });

  bus.subscribe('voucher.purchased', async (e) => {
    await s.rewards.applyTrigger('purchase', e.guestId, 'voucher', e.voucherId, e.amountCents);
  });

  bus.subscribe('reward.earned', async (e) => {
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'rewards',
        templateKey: 'rewards.earned',
        data: { points: e.points },
        channels: ['push', 'in-app'],
        deepLink: '/rewards',
        dedupeKey: `reward:earned:${e.referenceId}:${e.points}`,
      }),
    );
  });

  bus.subscribe('reward.tier_changed', async (e) => {
    const tier = ctx.db.rewardTiers.get(e.toTierId);
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'rewards',
        templateKey: 'rewards.tier',
        data: { tierName: tier?.name ?? 'a new tier' },
        channels: ['push', 'email', 'in-app'],
        deepLink: '/rewards',
        dedupeKey: `reward:tier:${e.guestId}:${e.toTierId}`,
      }),
    );
  });

  bus.subscribe('reward.redeemed', async (e) => {
    const reward = ctx.db.rewards.get(e.rewardId);
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'rewards',
        templateKey: 'rewards.redeemed',
        data: { rewardName: reward?.name ?? 'your reward' },
        channels: ['in-app'],
        deepLink: '/rewards',
        dedupeKey: `reward:redeemed:${e.redemptionId}`,
      }),
    );
  });

  /* ── Events ───────────────────────────────────────────────────────── */

  bus.subscribe('event.booked', async (e) => {
    const event = ctx.db.experiences.require(e.eventId);
    const data = {
      eventTitle: event.title,
      date: formatDateLong(event.startsAt),
      time: formatTime(event.startsAt),
    };
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'event',
        templateKey: 'event.booked',
        data,
        channels: ['push', 'email', 'in-app'],
        deepLink: `/events/${event.id}`,
        dedupeKey: `event-booking:${e.bookingId}:confirmed`,
      }),
    );
    const at = new Date(event.startsAt).getTime() - EVENT_REMINDER_HOURS * 3_600_000;
    if (at > ctx.clock.now().getTime()) {
      await s.notifications.queue(
        msg({
          guestId: e.guestId,
          category: 'event',
          templateKey: 'event.reminder',
          data,
          channels: ['push', 'email', 'in-app'],
          scheduledFor: new Date(at).toISOString(),
          deepLink: `/events/${event.id}`,
          dedupeKey: `event-booking:${e.bookingId}:reminder`,
        }),
      );
    }
  });

  /* ── Vouchers ─────────────────────────────────────────────────────── */

  bus.subscribe('voucher.purchased', async (e) => {
    const v = ctx.db.vouchers.require(e.voucherId);
    const purchaser = ctx.db.guests.get(v.purchaserGuestId);
    const data = {
      amount: formatRand(v.amountCents),
      code: v.code,
      purchaserName: purchaser?.name ?? 'A friend',
      recipientName: v.recipientName,
      message: v.message ?? '',
      expiresAt: v.expiresAt ? formatDateWithYear(v.expiresAt) : '',
    };
    await s.notifications.sendNow(
      msg({
        guestId: v.purchaserGuestId,
        category: 'voucher',
        templateKey: 'voucher.purchased',
        data,
        channels: ['email', 'in-app'],
        deepLink: `/vouchers/${v.id}`,
        dedupeKey: `voucher:${v.id}:purchased`,
      }),
    );
    if (!v.forSelf && v.delivery === 'email') {
      // Delivered to the recipient's inbox, not the buyer's.
      await s.notifications.sendNow(
        msg({
          guestId: v.issuedTo ?? v.purchaserGuestId,
          category: 'voucher',
          templateKey: 'voucher.received',
          data: { ...data, toEmail: v.recipientEmail },
          channels: v.issuedTo ? ['email', 'push', 'in-app'] : ['email'],
          deepLink: `/vouchers/${v.id}`,
          dedupeKey: `voucher:${v.id}:delivered`,
        }),
      );
    }
  });

  bus.subscribe('voucher.redeemed', async (e) => {
    await s.notifications.sendNow(
      msg({
        guestId: e.guestId,
        category: 'voucher',
        templateKey: 'voucher.redeemed',
        data: { amount: formatRand(e.amountCents) },
        channels: ['in-app'],
        deepLink: `/vouchers/${e.voucherId}`,
        dedupeKey: `voucher:${e.voucherId}:redeemed:${ctx.db.voucherRedemptions.count((r) => r.voucherId === e.voucherId)}`,
      }),
    );
  });
}

/**
 * The scheduled jobs (§44 "booking reminder and reward automation jobs with
 * idempotency and retry logic"). Safe to run as often as you like.
 */
export async function runJobs(ctx: ServiceContext, s: Services): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  out.notifications = await s.notifications.processDue();
  out.pointsExpired = (await s.rewards.processExpiry()).length;
  out.vouchersExpired = s.vouchers.expireDue();
  out.birthdays = await s.rewards.runBirthdays();
  out.campaigns = (await s.notifications.runCampaigns()).length;

  // Expiry notices, once per lot.
  let notices = 0;
  for (const account of ctx.db.rewardAccounts.list()) {
    for (const lot of s.rewards.expiringSoon(account.id)) {
      const daysLeft = Math.ceil(
        (new Date(lot.expiresAt).getTime() - ctx.clock.now().getTime()) / 86_400_000,
      );
      await s.notifications.queue({
        id: ctx.ids.id('ntf'),
        guestId: account.guestId,
        category: 'rewards',
        templateKey: 'rewards.expiring',
        data: { points: lot.points, daysLeft },
        channels: ['push', 'in-app'],
        deepLink: '/rewards',
        dedupeKey: `reward-expiring:${lot.lotId}`,
      });
      notices += 1;
    }
  }
  out.expiryNotices = notices;

  // Offer freed tables for the coming week to anyone waiting.
  let matched = 0;
  const today = new Date(ctx.clock.now().getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
  const dates = new Set(
    ctx.db.waitlist.filter((w) => w.status === 'waiting').map((w) => w.query.date),
  );
  for (const date of dates)
    if (date >= today) matched += (await s.reservations.matchWaitlist(date)).length;
  out.waitlistMatched = matched;
  return out;
}
