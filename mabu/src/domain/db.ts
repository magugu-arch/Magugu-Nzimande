import { Table } from './shared/table';
import type { AuditEntry, Favourite, Guest, PushToken } from './guests/types';
import type {
  ProviderWebhookEvent,
  ReservationEvent,
  ReservationRecord,
  StaffNote,
  WaitlistEntry,
} from './reservations/types';
import type { BookingPolicy } from './reservations/policy';
import type {
  Reward,
  RewardAccount,
  RewardRedemption,
  RewardRule,
  RewardsSettings,
  RewardTier,
  RewardTransaction,
} from './rewards/types';
import type {
  Campaign,
  InboxItem,
  NotificationDelivery,
  NotificationMessage,
  NotificationPreference,
  NotificationTemplate,
} from './notifications/types';
import type { Experience, ExperienceBooking } from './experiences/types';
import type { Voucher, VoucherPolicy, VoucherRedemption } from './vouchers/types';
import type { PaymentIntent } from './payments/types';
import type { Dish, MenuCollection, WineItem } from './menu/types';
import type { ProviderOrder } from './commerce/types';
import type { AnalyticsEvent } from './analytics';
import type { VenueContent, HomeContent } from '../content/types';

export interface IdempotencyRecord {
  id: string;
  scope: string;
  key: string;
  fingerprint: string;
  result: unknown;
  createdAt: string;
}

/**
 * Every table the brief's §28 DATA and §46 entity lists call for, in one
 * place. `server/migrations/001_initial.sql` is the PostgreSQL shape of the
 * same thing; the two are kept in step by __tests__/migrations.test.ts.
 */
export class Database {
  guests = new Table<Guest>('guest');
  favourites = new Table<Favourite>('favourite');
  pushTokens = new Table<PushToken>('push_token');
  audit = new Table<AuditEntry>('audit_entry');
  idempotency = new Table<IdempotencyRecord>('idempotency_record');

  reservations = new Table<ReservationRecord>('reservation');
  reservationEvents = new Table<ReservationEvent>('reservation_event');
  staffNotes = new Table<StaffNote>('staff_note');
  waitlist = new Table<WaitlistEntry>('waitlist_entry');
  providerWebhookEvents = new Table<ProviderWebhookEvent>('provider_webhook_event');
  bookingPolicy = new Table<BookingPolicy>('booking_policy');

  rewardAccounts = new Table<RewardAccount>('reward_account');
  rewardTiers = new Table<RewardTier>('reward_tier');
  rewardRules = new Table<RewardRule>('reward_rule');
  rewards = new Table<Reward>('reward');
  rewardTransactions = new Table<RewardTransaction>('reward_transaction');
  rewardRedemptions = new Table<RewardRedemption>('reward_redemption');
  rewardsSettings = new Table<RewardsSettings>('rewards_settings');

  notificationPreferences = new Table<NotificationPreference>('notification_preference');
  notificationMessages = new Table<NotificationMessage & { id: string }>('notification_message');
  notificationDeliveries = new Table<NotificationDelivery>('notification_delivery');
  notificationTemplates = new Table<NotificationTemplate>('notification_template');
  inbox = new Table<InboxItem>('inbox_item');
  campaigns = new Table<Campaign>('campaign');

  experiences = new Table<Experience>('experience');
  experienceBookings = new Table<ExperienceBooking>('experience_booking');

  vouchers = new Table<Voucher>('voucher');
  voucherRedemptions = new Table<VoucherRedemption>('voucher_redemption');
  voucherPolicy = new Table<VoucherPolicy>('voucher_policy');

  payments = new Table<PaymentIntent>('payment_intent');

  dishes = new Table<Dish>('menu_item');
  wines = new Table<WineItem>('wine_item');
  collections = new Table<MenuCollection>('menu_collection');
  venue = new Table<VenueContent>('venue');
  home = new Table<HomeContent>('home_content');

  providerOrders = new Table<ProviderOrder>('provider_order');

  /** Funnel events, kept so the counts survive a restart (§27). */
  analyticsEvents = new Table<AnalyticsEvent>('analytics_event');

  tables(): Table<{ id: string }>[] {
    return Object.values(this).filter((v): v is Table<{ id: string }> => v instanceof Table);
  }

  snapshot(): Record<string, unknown[]> {
    const out: Record<string, unknown[]> = {};
    for (const t of this.tables()) out[t.name] = t.toJSON();
    return out;
  }

  /** Every table's writes since the last drain, keyed by table name. */
  drainChanges(): Record<string, { upserts: { id: string }[]; deletes: string[] }> {
    const out: Record<string, { upserts: { id: string }[]; deletes: string[] }> = {};
    for (const t of this.tables()) {
      const c = t.drainChanges();
      if (c.upserts.length || c.deletes.length) out[t.name] = c;
    }
    return out;
  }

  restore(snapshot: Record<string, unknown[]>): void {
    for (const t of this.tables()) {
      const rows = snapshot[t.name];
      if (Array.isArray(rows)) t.load(rows as { id: string }[]);
    }
  }
}
