import {
  SEED_COLLECTIONS,
  SEED_DISHES,
  SEED_EXPERIENCES,
  SEED_HOME,
  SEED_REWARDS,
  SEED_RULES,
  SEED_TIERS,
  SEED_VENUE,
  SEED_WINES,
} from '../content/seed';
import { Analytics } from './analytics';
import { runJobs, wireAutomation } from './automation';
import { CommerceRegistry } from './commerce/providers';
import type { ServiceContext } from './context';
import { Database } from './db';
import { InMemoryEventBus } from './events/domainEvents';
import { ExperiencesService } from './experiences/service';
import { DEFAULT_FLAGS, type FeatureFlags } from './flags';
import { GuestsService } from './guests/service';
import { ContentService } from './menu/service';
import { InAppProvider, MockChannelProvider, UnconfiguredChannelProvider } from './notifications/providers';
import { NotificationsService } from './notifications/service';
import { defaultTemplates } from './notifications/templates';
import { MockPaymentProvider, PaymentsService, UnconfiguredPaymentProvider } from './payments/service';
import { DEFAULT_BOOKING_POLICY, type BookingPolicy } from './reservations/policy';
import { DineplanReservationAdapter } from './reservations/providers/DineplanReservationAdapter';
import { MabuDirectReservationAdapter } from './reservations/providers/MabuDirectReservationAdapter';
import { ReservationsService } from './reservations/service';
import { DEFAULT_REWARDS_SETTINGS, RewardsEngine } from './rewards/service';
import { systemClock, type Clock } from './shared/clock';
import { randomIds, type IdGenerator } from './shared/ids';
import { DEFAULT_VOUCHER_POLICY } from './vouchers/types';
import { VouchersService } from './vouchers/service';

export interface BackendOptions {
  clock?: Clock;
  ids?: IdGenerator;
  flags?: Partial<FeatureFlags>;
  /** 'mock' runs every provider against in-process fixtures. */
  mode?: 'mock' | 'live';
  db?: Database;
}

/**
 * Composes the whole service layer. The app's mock API runs this in-process;
 * a Node server would run the same composition behind HTTP with a PostgreSQL
 * Database implementation (see server/README.md).
 */
export function createBackend(options: BackendOptions = {}) {
  const mode = options.mode ?? 'mock';
  const db = options.db ?? new Database();
  const ctx: ServiceContext = {
    db,
    clock: options.clock ?? systemClock,
    ids: options.ids ?? randomIds,
    bus: new InMemoryEventBus(),
    flags: { ...DEFAULT_FLAGS, ...options.flags },
    analytics: new Analytics(),
  };

  const payments = new PaymentsService(
    ctx,
    mode === 'mock' ? new MockPaymentProvider() : new UnconfiguredPaymentProvider(),
  );

  const reservations: ReservationsService = new ReservationsService(
    ctx,
    {
      'mabu-direct': new MabuDirectReservationAdapter(ctx, (): BookingPolicy => reservations.policy(), mode),
      dineplan: new DineplanReservationAdapter(),
    },
    payments,
  );

  const channels = {
    push: new MockChannelProvider('push', ctx),
    email: new MockChannelProvider('email', ctx),
  };
  const notifications = new NotificationsService(ctx, {
    'in-app': new InAppProvider(ctx),
    push: channels.push,
    email: channels.email,
    sms: new UnconfiguredChannelProvider('sms'),
    whatsapp: new UnconfiguredChannelProvider('whatsapp'),
  });

  const rewards = new RewardsEngine(ctx);
  const experiences = new ExperiencesService(ctx, payments);
  const vouchers = new VouchersService(ctx, payments);
  const guests = new GuestsService(ctx);
  const content = new ContentService(ctx);
  const commerce = new CommerceRegistry(ctx.flags);

  const services = { reservations, rewards, notifications, experiences, vouchers };
  wireAutomation(ctx, services);

  return {
    ctx,
    db,
    payments,
    reservations,
    notifications,
    rewards,
    experiences,
    vouchers,
    guests,
    content,
    commerce,
    channels,
    runJobs: () => runJobs(ctx, services),
  };
}

export type Backend = ReturnType<typeof createBackend>;

/** Loads CMS content and programme configuration into an empty database. */
export function seedConfiguration(backend: Backend): void {
  const { db, ctx } = backend;
  const now = ctx.clock.now().toISOString();
  if (!db.venue.has('venue')) db.venue.upsert(SEED_VENUE);
  if (!db.home.has('home')) db.home.upsert(SEED_HOME);
  if (!db.bookingPolicy.has('booking-policy')) db.bookingPolicy.upsert(DEFAULT_BOOKING_POLICY);
  if (!db.voucherPolicy.has('voucher-policy')) db.voucherPolicy.upsert(DEFAULT_VOUCHER_POLICY);
  if (!db.rewardsSettings.has('rewards-settings')) db.rewardsSettings.upsert(DEFAULT_REWARDS_SETTINGS);
  if (db.dishes.count() === 0) SEED_DISHES.forEach((d) => db.dishes.upsert(d));
  if (db.wines.count() === 0) SEED_WINES.forEach((w) => db.wines.upsert(w));
  if (db.collections.count() === 0) SEED_COLLECTIONS.forEach((c) => db.collections.upsert(c));
  if (db.experiences.count() === 0) SEED_EXPERIENCES.forEach((e) => db.experiences.upsert(e));
  if (db.rewardTiers.count() === 0) SEED_TIERS.forEach((t) => db.rewardTiers.upsert(t));
  if (db.rewardRules.count() === 0) SEED_RULES.forEach((r) => db.rewardRules.upsert(r));
  if (db.rewards.count() === 0) SEED_REWARDS.forEach((r) => db.rewards.upsert(r));
  if (db.notificationTemplates.count() === 0) defaultTemplates(now).forEach((t) => db.notificationTemplates.upsert(t));
}
