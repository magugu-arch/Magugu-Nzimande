/**
 * The API surface, as one table of handlers.
 *
 * Each handler is `(actor, args) => result`. The app's mock transport calls
 * them in-process; an HTTP server mounts the same table at
 * POST /rpc/<name>, resolving `actor` from the session token and passing the
 * Idempotency-Key header through `args.idempotencyKey`. Nothing here trusts
 * the client about who it is or what it may do — every role and ownership
 * rule is enforced in the services underneath.
 */
import type { Backend } from './backend';
import type { Actor, DietaryTag, FavouriteKind, GuestOccasion } from './guests/types';
import type { AmendPatch } from './reservations/service';
import type {
  AvailabilityQuery,
  ReservationCreateRequest,
  ServicePeriod,
} from './reservations/types';
import type { BookingPolicy } from './reservations/policy';
import {
  MARKETING_WEEKLY_CAP,
  type CampaignAudience,
  type NotificationChannel,
  type NotificationPreference,
  type QuietHours,
} from './notifications/types';
import type { Reward, RewardRule, RewardsSettings } from './rewards/types';
import type { Dish, WineItem } from './menu/types';
import type { Experience } from './experiences/types';
import type { VoucherPurchaseInput } from './vouchers/service';
import type { VoucherPolicy } from './vouchers/types';
import { availabilityOf } from './experiences/types';
import { DomainError } from './shared/errors';
import { venueDate } from './shared/time';
import { isUpcoming } from './reservations/status';
import { isExpoPushToken } from './notifications/expoPush';

/** Mock mode's one-time code. The sign-in screen says so on screen. */
export const MOCK_OTP = '123456';

function signedIn(actor: Actor | null): Actor {
  if (!actor) throw new DomainError('FORBIDDEN', 'Please sign in to continue.', 'anonymous');
  return actor;
}

export function createHandlers(b: Backend) {
  const venueId = () => b.reservations.policy().venueId;

  return {
    /* ── Public content ───────────────────────────────────────────── */

    'content.home': async () => {
      const home = b.content.home();
      const now = b.ctx.clock.now();
      const events = b.experiences
        .list()
        .map((e) => ({ ...e, availability: availabilityOf(e, now) }));
      return {
        home,
        venue: b.content.venue(),
        highlights: home.highlightDishIds
          .map((id) => b.db.dishes.get(id))
          .filter((d): d is Dish => !!d),
        wineSpotlight: home.wineSpotlightId ? b.db.wines.get(home.wineSpotlightId) : undefined,
        nextEvent: events[0],
        flags: clientFlags(b),
      };
    },
    'content.menu': async () => {
      const dishes = b.content.dishes();
      const wines = b.content.wines();
      return {
        categories: b.content.categories(),
        dishes,
        wines,
        collections: b.content.collections(),
        isSample: dishes.some((d) => d.isSample) || wines.some((w) => w.isSample),
      };
    },
    'content.dish': async (_: Actor | null, a: { id: string }) => ({
      dish: b.content.dish(a.id),
      pairings: b.content.pairingsForDish(a.id),
    }),
    'content.wine': async (_: Actor | null, a: { id: string }) => ({
      wine: b.content.wine(a.id),
      pairings: b.content.pairingsForWine(a.id),
    }),
    'content.collection': async (_: Actor | null, a: { id: string }) => {
      const collection = b.db.collections.require(a.id, 'collection');
      return {
        collection,
        dishes: collection.itemIds.map((id) => b.db.dishes.get(id)).filter((d): d is Dish => !!d),
      };
    },
    'content.venue': async () => b.content.venue(),
    'flags.get': async () => clientFlags(b),

    /* ── Booking (public reads) ───────────────────────────────────── */

    'booking.policy': async () => publicPolicy(b),
    'booking.dayStates': async (
      _: Actor | null,
      a: { from: string; days: number; partySize: number },
    ) => b.reservations.dayStates(a.from, Math.min(62, a.days), a.partySize),
    'booking.search': async (
      _: Actor | null,
      a: { date: string; partySize: number; servicePeriod?: ServicePeriod },
    ) => b.reservations.searchAvailability({ venueId: venueId(), ...a }),

    /* ── Auth ─────────────────────────────────────────────────────── */

    'auth.requestCode': async (_: Actor | null, a: { email: string }) => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email.trim())) {
        throw new DomainError('VALIDATION', 'Please enter a valid email address.', 'email');
      }
      // A live server emails a one-time code here, rate-limited per address.
      return { sent: true, mockCode: MOCK_OTP };
    },
    'auth.verifyCode': async (
      _: Actor | null,
      a: { email: string; code: string; name?: string; phone?: string; referralCode?: string },
    ) => {
      if (a.code.trim() !== MOCK_OTP) {
        throw new DomainError(
          'VALIDATION',
          'That code is not right. Please check it and try again.',
          'otp',
        );
      }
      const guest = b.guests.findOrCreate(a);
      if (a.name && !guest.name) b.db.guests.update(guest.id, { name: a.name.trim() });
      const fresh = b.db.guests.require(guest.id);
      return { guest: fresh, token: fresh.id, actor: { id: fresh.id, role: fresh.role } as Actor };
    },

    /* ── Sessions (§19) ───────────────────────────────────────────── */

    /**
     * The live server answers these itself, against real sessions. In the
     * in-app demo there is only ever this one device, and signing out
     * everywhere is what the sign-out button already does.
     */
    'auth.sessions': async (actor: Actor | null) => {
      const me = signedIn(actor);
      const guest = b.db.guests.require(me.id);
      return {
        sessions: [
          {
            id: 'this-device',
            label: 'This device',
            createdAt: guest.createdAt,
            lastSeenAt: b.ctx.clock.now().toISOString(),
            expiresAt: b.ctx.clock.now().toISOString(),
            current: true,
          },
        ],
      };
    },
    'auth.signOutOthers': async (actor: Actor | null) => {
      signedIn(actor);
      return { revoked: 0 };
    },
    'auth.signOutAll': async (actor: Actor | null) => {
      signedIn(actor);
      return { revoked: 0 };
    },

    /* ── Me ───────────────────────────────────────────────────────── */

    'me.get': async (actor: Actor | null) => {
      const me = signedIn(actor);
      return b.guests.get(me.id, me);
    },
    'me.update': async (
      actor: Actor | null,
      a: {
        name?: string;
        phone?: string;
        preferences?: {
          dietaryTags?: DietaryTag[];
          seatingPreference?: string;
          accessibilityNotes?: string;
        };
      },
    ) => {
      const me = signedIn(actor);
      return b.guests.updateProfile(me.id, a, me);
    },
    'me.saveOccasion': async (
      actor: Actor | null,
      a: Omit<GuestOccasion, 'id'> & { id?: string },
    ) => {
      const me = signedIn(actor);
      return b.guests.saveOccasion(me.id, a, me);
    },
    'me.removeOccasion': async (actor: Actor | null, a: { id: string }) => {
      const me = signedIn(actor);
      return b.guests.removeOccasion(me.id, a.id, me);
    },
    'me.delete': async (actor: Actor | null) => {
      const me = signedIn(actor);
      b.guests.deleteAccount(me.id, me);
      return { deleted: true };
    },

    /* ── Booking (guest) ──────────────────────────────────────────── */

    'booking.create': async (actor: Actor | null, a: Omit<ReservationCreateRequest, 'venueId'>) =>
      b.reservations.create({ ...a, venueId: venueId() }, signedIn(actor)),
    'booking.get': async (actor: Actor | null, a: { id: string }) => {
      const me = signedIn(actor);
      const r = b.reservations.get(a.id, me);
      const policy = publicPolicy(b);
      const hoursToGo = (new Date(r.startsAt).getTime() - b.ctx.clock.now().getTime()) / 3_600_000;
      return {
        reservation: r,
        canChange: b.reservations.canGuestChange(r),
        // Decided on the server's clock, so a phone set to the wrong time cannot misstate the policy.
        lateCancellation: hoursToGo < policy.cancellationCutoffHours,
        policy,
      };
    },
    'booking.mine': async (actor: Actor | null) => {
      const me = signedIn(actor);
      const all = b.reservations.listForGuest(me.id, me);
      const now = b.ctx.clock.now();
      return {
        upcoming: all.filter((r) => isUpcoming(r, now)),
        past: all.filter((r) => !isUpcoming(r, now)).reverse(),
      };
    },
    'booking.amend': async (
      actor: Actor | null,
      a: { id: string; patch: AmendPatch; idempotencyKey: string },
    ) => b.reservations.amend(a.id, a.patch, signedIn(actor), a.idempotencyKey),
    'booking.reschedule': async (
      actor: Actor | null,
      a: { id: string; slotId: string; partySize?: number; idempotencyKey: string },
    ) => b.reservations.reschedule(a.id, a.slotId, signedIn(actor), a.idempotencyKey, a.partySize),
    'booking.cancel': async (
      actor: Actor | null,
      a: { id: string; reason?: string; idempotencyKey: string },
    ) => b.reservations.cancel(a.id, signedIn(actor), a.idempotencyKey, a.reason),
    'booking.payDeposit': async (
      actor: Actor | null,
      a: { id: string; methodToken: string; idempotencyKey: string },
    ) => b.reservations.payDeposit(a.id, a.methodToken, a.idempotencyKey, signedIn(actor)),
    'booking.history': async (actor: Actor | null, a: { id: string }) =>
      b.reservations.history(a.id, signedIn(actor)),

    'waitlist.join': async (
      actor: Actor | null,
      a: Omit<AvailabilityQuery, 'venueId'> & { preferredTime?: string },
    ) => b.reservations.joinWaitlist({ ...a, venueId: venueId() }, signedIn(actor)),
    'waitlist.mine': async (actor: Actor | null) => {
      const me = signedIn(actor);
      const today = venueDate(b.ctx.clock.now());
      return b.reservations
        .waitlistForGuest(me.id, me)
        .filter((w) => w.query.date >= today && (w.status === 'waiting' || w.status === 'matched'));
    },
    'waitlist.get': async (actor: Actor | null, a: { id: string }) => {
      const me = signedIn(actor);
      const entry = b.db.waitlist.require(a.id, 'waitlist entry');
      if (entry.guestId !== me.id && me.role === 'guest')
        throw new DomainError('NOT_FOUND', 'Not found.', 'owner');
      return entry;
    },
    'waitlist.leave': async (actor: Actor | null, a: { id: string }) => {
      await b.reservations.leaveWaitlist(a.id, signedIn(actor));
      return { ok: true };
    },

    /* ── Events ───────────────────────────────────────────────────── */

    'events.list': async () => {
      const now = b.ctx.clock.now();
      return b.experiences.list().map((e) => ({ ...e, availability: availabilityOf(e, now) }));
    },
    'events.get': async (_: Actor | null, a: { id: string }) => {
      const e = b.experiences.get(a.id);
      return { ...e, availability: availabilityOf(e, b.ctx.clock.now()) };
    },
    'events.book': async (
      actor: Actor | null,
      a: { eventId: string; seats: number; methodToken?: string; idempotencyKey: string },
    ) => b.experiences.book(a, signedIn(actor)),
    'events.mine': async (actor: Actor | null) => {
      const me = signedIn(actor);
      return b.experiences.bookingsForGuest(me.id, me);
    },
    'events.cancel': async (actor: Actor | null, a: { bookingId: string }) =>
      b.experiences.cancelBooking(a.bookingId, signedIn(actor)),

    /* ── Vouchers ─────────────────────────────────────────────────── */

    'vouchers.policy': async () => b.vouchers.policy(),
    'vouchers.purchase': async (actor: Actor | null, a: VoucherPurchaseInput) =>
      b.vouchers.purchase(a, signedIn(actor)),
    'vouchers.mine': async (actor: Actor | null) => {
      const me = signedIn(actor);
      return b.vouchers.listForGuest(me.id, me);
    },
    'vouchers.get': async (actor: Actor | null, a: { id: string }) =>
      b.vouchers.get(a.id, signedIn(actor)),

    /* ── Rewards ──────────────────────────────────────────────────── */

    'rewards.programme': async () => ({
      tiers: b.rewards.tiers(),
      catalogue: b.rewards.catalogue(),
      rules: (await b.rewards.getRules()).filter((r) => r.active),
      settings: b.rewards.settings(),
    }),
    'rewards.wallet': async (actor: Actor | null) => {
      const me = signedIn(actor);
      const account = b.rewards.accountFor(me.id);
      if (!account) return { account: null };
      return {
        account,
        progress: b.rewards.progress(account),
        available: await b.rewards.getAvailableRewards(me.id),
        catalogue: b.rewards.catalogue(),
        expiring: b.rewards.expiringSoon(account.id),
        redemptions: b.rewards.redemptions(account.id, me),
        history: b.rewards.history(account.id, me),
        referralCode: b.db.guests.get(me.id)?.referralCode,
      };
    },
    'rewards.optIn': async (actor: Actor | null) => {
      const me = signedIn(actor);
      return b.rewards.optIn(me.id, me);
    },
    'rewards.redeem': async (
      actor: Actor | null,
      a: { rewardId: string; idempotencyKey: string },
    ) => {
      const me = signedIn(actor);
      const account = await b.rewards.getAccount(me.id);
      return b.rewards.redeemReward(account.id, a.rewardId, a.idempotencyKey, me);
    },

    /* ── Favourites ───────────────────────────────────────────────── */

    'favourites.list': async (actor: Actor | null) => {
      const me = signedIn(actor);
      return b.guests.favourites(me.id, me);
    },
    'favourites.toggle': async (
      actor: Actor | null,
      a: { kind: FavouriteKind; itemId: string },
    ) => {
      const me = signedIn(actor);
      return { saved: b.guests.toggleFavourite(me.id, a.kind, a.itemId, me) };
    },

    /* ── Payments ─────────────────────────────────────────────────────── */

    /** The hosted checkout for a payment still waiting on the guest. */
    'payments.checkout': async (
      actor: Actor | null,
      a: { id?: string; purpose?: 'voucher' | 'event' | 'deposit'; referenceId?: string },
    ) => {
      const me = signedIn(actor);
      const intent = a.id
        ? b.db.payments.get(a.id)
        : b.db.payments
            .filter((p) => p.purpose === a.purpose && p.referenceId === a.referenceId)
            .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      if (!intent || (me.role === 'guest' && b.payments.payerOf(intent) !== me.id)) {
        throw new DomainError('NOT_FOUND', 'We could not find that payment.', 'payment owner');
      }
      return {
        id: intent.id,
        status: intent.status,
        checkoutUrl: intent.status === 'pending' ? (intent.checkoutUrl ?? null) : null,
        amountCents: intent.amountCents,
      };
    },

    /* ── Devices (§37 push) ─────────────────────────────────────────── */

    'devices.register': async (
      actor: Actor | null,
      a: { token: string; platform: 'ios' | 'android' | 'web' },
    ) => {
      const me = signedIn(actor);
      if (!isExpoPushToken(a.token) || !['ios', 'android', 'web'].includes(a.platform)) {
        throw new DomainError('VALIDATION', 'That device could not be registered.', 'push token');
      }
      const now = b.ctx.clock.now().toISOString();
      const existing = b.db.pushTokens.get(a.token);
      // A token moves with the device: the latest signed-in guest owns it.
      b.db.pushTokens.upsert({
        id: a.token,
        guestId: me.id,
        platform: a.platform,
        createdAt: existing?.guestId === me.id ? existing.createdAt : now,
        lastSeenAt: now,
      });
      return { registered: true };
    },
    'devices.unregister': async (actor: Actor | null, a: { token: string }) => {
      const me = signedIn(actor);
      const existing = b.db.pushTokens.get(a.token);
      if (existing && existing.guestId === me.id) b.db.pushTokens.delete(a.token);
      return { registered: false };
    },

    /* ── Notifications ────────────────────────────────────────────── */

    'notifications.inbox': async (actor: Actor | null) => {
      const me = signedIn(actor);
      const items = b.notifications.inbox(me.id, me);
      return { items, unread: items.filter((i) => !i.readAt).length };
    },
    'notifications.markRead': async (actor: Actor | null, a: { id: string }) => {
      b.notifications.markRead(a.id, signedIn(actor));
      return { ok: true };
    },
    'notifications.markAllRead': async (actor: Actor | null) => {
      const me = signedIn(actor);
      b.notifications.markAllRead(me.id, me);
      return { ok: true };
    },
    'notifications.prefs': async (actor: Actor | null) => {
      const me = signedIn(actor);
      return {
        preferences: await b.notifications.getGuestPreferences(me.id),
        consent: b.db.guests.get(me.id)?.consent,
        channels: availableChannels(b),
      };
    },
    'notifications.updatePref': async (actor: Actor | null, a: NotificationPreference) => {
      const me = signedIn(actor);
      return b.notifications.updateGuestPreference({ ...a, guestId: me.id }, me);
    },
    'notifications.setQuietHours': async (
      actor: Actor | null,
      a: { quietHours: QuietHours | null },
    ) => {
      const me = signedIn(actor);
      await b.notifications.setQuietHours(me.id, a.quietHours, me);
      return { ok: true };
    },

    /* ── Staff & admin ────────────────────────────────────────────── */

    'admin.dashboard': async (actor: Actor | null, a: { date: string }) => {
      const me = signedIn(actor);
      const today = b.reservations.listForDate(a.date, me);
      const active = today.filter((r) =>
        ['confirmed', 'rescheduled', 'requested'].includes(r.status),
      );
      const events = b.experiences.list();
      return {
        reservationsToday: active.length,
        coversToday: active.reduce((s, r) => s + r.partySize, 0),
        completedToday: today.filter((r) => r.status === 'completed').length,
        waitlistWaiting: b.db.waitlist.count((w) => w.status === 'waiting'),
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          startsAt: e.startsAt,
          capacity: e.capacity,
          seatsBooked: e.seatsBooked,
        })),
        vouchers: b.vouchers.report(me),
        rewardsMembers: b.db.rewardAccounts.count(),
        pendingPayments: b.payments.pending().length,
        failedDeliveries: b.db.notificationDeliveries.count((d) => d.status === 'failed'),
        conversion: conversion(b),
      };
    },
    'admin.reservations': async (actor: Actor | null, a: { date: string }) =>
      b.reservations.listForDate(a.date, signedIn(actor)),
    'admin.reservationSearch': async (actor: Actor | null, a: { term: string }) =>
      b.reservations.search(a.term, signedIn(actor)),
    'admin.reservation': async (actor: Actor | null, a: { id: string }) => {
      const me = signedIn(actor);
      return {
        reservation: b.reservations.get(a.id, me),
        notes: b.reservations.staffNotes(a.id, me),
        history: b.reservations.history(a.id, me),
      };
    },
    'admin.complete': async (actor: Actor | null, a: { id: string }) =>
      b.reservations.markCompleted(a.id, signedIn(actor)),
    'admin.noShow': async (actor: Actor | null, a: { id: string }) =>
      b.reservations.markNoShow(a.id, signedIn(actor)),
    'admin.cancel': async (
      actor: Actor | null,
      a: { id: string; reason?: string; idempotencyKey: string },
    ) => b.reservations.cancel(a.id, signedIn(actor), a.idempotencyKey, a.reason),
    'admin.addNote': async (actor: Actor | null, a: { id: string; body: string }) =>
      b.reservations.addStaffNote(a.id, a.body, signedIn(actor)),
    'admin.policy': async (actor: Actor | null) => {
      signedIn(actor);
      return b.reservations.policy();
    },
    'admin.policy.update': async (
      actor: Actor | null,
      a: Partial<Omit<BookingPolicy, 'id' | 'version'>>,
    ) => b.reservations.updatePolicy(signedIn(actor), a),
    'admin.waitlist.match': async (actor: Actor | null, a: { date: string }) => {
      const me = signedIn(actor);
      if (me.role === 'guest') throw new DomainError('FORBIDDEN', 'Staff only.', 'role');
      return b.reservations.matchWaitlist(a.date);
    },

    'admin.rewards': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return {
        rules: await b.rewards.getRules(),
        rewards: b.db.rewards.list(),
        tiers: b.rewards.tiers(),
        settings: b.rewards.settings(),
      };
    },
    'admin.rule.save': async (actor: Actor | null, a: RewardRule) =>
      b.rewards.upsertRule(a, signedIn(actor)),
    'admin.reward.save': async (actor: Actor | null, a: Reward) =>
      b.rewards.upsertReward(a, signedIn(actor)),
    'admin.rewardsSettings.save': async (
      actor: Actor | null,
      a: Partial<Omit<RewardsSettings, 'id'>>,
    ) => b.rewards.updateSettings(a, signedIn(actor)),
    'admin.ledger': async (actor: Actor | null, a: { email: string }) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      const guest = b.db.guests.find((g) => g.email === a.email.trim().toLowerCase());
      if (!guest) throw new DomainError('NOT_FOUND', 'No guest with that email.', a.email);
      const account = b.rewards.accountFor(guest.id);
      return {
        guest: { id: guest.id, name: guest.name, email: guest.email },
        account: account ?? null,
        history: account ? b.rewards.history(account.id, me) : [],
      };
    },
    'admin.adjust': async (
      actor: Actor | null,
      a: { accountId: string; points: number; reason: string },
    ) => b.rewards.adjust(a.accountId, a.points, a.reason, signedIn(actor)),
    'admin.reverse': async (actor: Actor | null, a: { transactionId: string; reason: string }) =>
      b.rewards.reverse(a.transactionId, a.reason, signedIn(actor)),
    'admin.useRedemption': async (actor: Actor | null, a: { code: string }) =>
      b.rewards.useRedemption(a.code, signedIn(actor)),

    'admin.templates': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return b.notifications.templates();
    },
    'admin.template.save': async (
      actor: Actor | null,
      a: { key: string; channel: NotificationChannel; subject: string; body: string },
    ) => b.notifications.saveTemplate(a.key, a.channel, a.subject, a.body, signedIn(actor)),
    'admin.campaigns': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return {
        campaigns: b.db.campaigns.list().sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
        marketingEnabled: b.ctx.flags.marketingNotificationsEnabled,
        consenting: b.db.guests.count((g) => g.consent?.marketing === true),
        weeklyCap: MARKETING_WEEKLY_CAP,
      };
    },
    'admin.campaign.audience': async (actor: Actor | null, a: { audience: CampaignAudience }) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return b.notifications.audienceSize(a.audience);
    },
    'admin.campaign.schedule': async (
      actor: Actor | null,
      a: {
        name: string;
        headline: string;
        body: string;
        deepLink?: string;
        scheduledFor: string;
        audience?: CampaignAudience;
      },
    ) =>
      b.notifications.scheduleCampaign(
        {
          name: a.name,
          audience: a.audience,
          data: { headline: a.headline, body: a.body },
          deepLink: a.deepLink,
          scheduledFor: a.scheduledFor,
        },
        signedIn(actor),
      ),
    'admin.campaign.cancel': async (actor: Actor | null, a: { id: string }) => {
      b.notifications.cancelCampaign(a.id, signedIn(actor));
      return { ok: true };
    },
    'admin.messages': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role === 'guest') throw new DomainError('FORBIDDEN', 'Staff only.', 'role');
      return {
        messages: b.notifications.recentMessages(60),
        outbox: [...b.channels.push.outbox, ...b.channels.email.outbox]
          .sort((x, y) => y.at.localeCompare(x.at))
          .slice(0, 60),
      };
    },
    'admin.simulateFailure': async (
      actor: Actor | null,
      a: { channel: 'push' | 'email'; count: number },
    ) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      b.channels[a.channel].failNext = a.count;
      return { ok: true };
    },

    'admin.vouchers.lookup': async (actor: Actor | null, a: { code: string }) =>
      b.vouchers.lookup(a.code, signedIn(actor)),
    'admin.vouchers.redeem': async (
      actor: Actor | null,
      a: { code: string; amountCents: number; note?: string; idempotencyKey: string },
    ) => b.vouchers.redeem(a.code, a.amountCents, a.idempotencyKey, signedIn(actor), a.note),
    'admin.vouchers.cancel': async (actor: Actor | null, a: { id: string; reason: string }) =>
      b.vouchers.cancel(a.id, a.reason, signedIn(actor)),
    'admin.vouchers.policy': async (actor: Actor | null, a: Partial<Omit<VoucherPolicy, 'id'>>) =>
      b.vouchers.updatePolicy(a, signedIn(actor)),

    'admin.menu.saveDish': async (actor: Actor | null, a: Dish) =>
      b.content.saveDish(a, signedIn(actor)),
    'admin.menu.saveWine': async (actor: Actor | null, a: WineItem) =>
      b.content.saveWine(a, signedIn(actor)),

    'admin.events': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role === 'guest') throw new DomainError('FORBIDDEN', 'Staff only.', 'role');
      return b.experiences.list({ includePast: true, includeUnpublished: true });
    },
    'admin.events.save': async (actor: Actor | null, a: Experience) =>
      b.experiences.save(a, signedIn(actor)),
    'admin.events.bookings': async (actor: Actor | null, a: { eventId: string }) => {
      const me = signedIn(actor);
      return b.experiences.bookingsForEvent(a.eventId, me).map((bk) => ({
        ...bk,
        guestName: b.db.guests.get(bk.guestId)?.name ?? 'Guest',
      }));
    },
    'admin.events.attend': async (actor: Actor | null, a: { bookingId: string }) =>
      b.experiences.markAttended(a.bookingId, signedIn(actor)),

    'admin.guests': async (actor: Actor | null, a: { term?: string }) =>
      b.guests.crmList(signedIn(actor), a.term),
    'admin.payments.pending': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return b.payments.pending();
    },
    'admin.payments.settle': async (
      actor: Actor | null,
      a: { id: string; status: 'succeeded' | 'failed' },
    ) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return b.payments.settle(a.id, a.status);
    },
    'admin.jobs.run': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return b.runJobs();
    },
    'admin.audit': async (actor: Actor | null) => {
      const me = signedIn(actor);
      if (me.role !== 'admin') throw new DomainError('FORBIDDEN', 'Admin only.', 'role');
      return b.db.audit
        .list()
        .sort((x, y) => y.at.localeCompare(x.at))
        .slice(0, 100);
    },
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
export type RpcName = keyof Handlers;
export type RpcArgs<K extends RpcName> = Parameters<Handlers[K]>[1];
export type RpcResult<K extends RpcName> = Awaited<ReturnType<Handlers[K]>>;

/** Flags a client may see. Nothing operational or secret. */
function clientFlags(b: Backend) {
  const f = b.ctx.flags;
  return {
    bookingEnabled: f.bookingEnabled,
    bookingProvider: f.bookingProvider,
    waitlistEnabled: f.waitlistEnabled,
    depositEnabled: f.bookingDepositEnabled,
    rewardsEnabled: f.rewardsEnabled && f.loyaltyEnabled,
    redemptionEnabled: f.rewardsRedemptionEnabled,
    vouchersEnabled: f.vouchersEnabled,
    eventsEnabled: f.eventsEnabled,
    orderingProviders: b.commerce.enabled(),
  };
}

function availableChannels(b: Backend): NotificationChannel[] {
  const f = b.ctx.flags;
  const out: NotificationChannel[] = ['in-app'];
  if (f.pushEnabled) out.push('push');
  if (f.emailEnabled) out.push('email');
  if (f.smsEnabled) out.push('sms');
  if (f.whatsappEnabled) out.push('whatsapp');
  return out;
}

/** The parts of the booking policy a guest needs: no pacing or inventory numbers. */
function publicPolicy(b: Backend) {
  const p = b.reservations.policy();
  return {
    minPartySize: p.minPartySize,
    maxPartySize: p.maxPartySize,
    maxChildren: p.maxChildren,
    maxAdvanceDays: p.maxAdvanceDays,
    servicePeriods: p.servicePeriods,
    closedDates: p.closedDates,
    seatingAreas: p.seatingAreas,
    cancellationCutoffHours: p.cancellationCutoffHours,
    amendCutoffHours: p.amendCutoffHours,
    cancellationPolicyText: p.cancellationPolicyText,
    noShowPolicyText: p.noShowPolicyText,
    // A deposit rule only applies while the deposit feature is switched on.
    deposit: { ...p.deposit, enabled: p.deposit.enabled && b.ctx.flags.bookingDepositEnabled },
  };
}

export type PublicBookingPolicy = ReturnType<typeof publicPolicy>;

/** Funnel counts from the in-memory analytics log (mock back end only). */
function conversion(b: Backend) {
  const count = (e: string) => b.ctx.analytics.log.filter((l) => l.event === e).length;
  return {
    bookingStarted: count('booking_started'),
    availabilityChecked: count('availability_checked'),
    bookingCreated: count('booking_created'),
    voucherStarted: count('voucher_purchase_started'),
    voucherCompleted: count('voucher_purchase_completed'),
    eventStarted: count('event_booking_started'),
    eventCompleted: count('event_booking_completed'),
  };
}
