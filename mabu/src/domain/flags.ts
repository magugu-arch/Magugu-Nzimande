/**
 * Feature flags — brief §22 and §45, one typed object.
 *
 * The client reads EXPO_PUBLIC_* copies to decide what to *show*. The server
 * owns the authoritative values and enforces them; a client that has been
 * tampered with to show a disabled feature still gets FEATURE_DISABLED back.
 */
export type ReservationProviderId = 'mabu-direct' | 'dineplan';

export interface FeatureFlags {
  bookingEnabled: boolean;
  bookingProvider: ReservationProviderId;
  /** §22: Mábu's own live reservation back end is connected. */
  directReservationsEnabled: boolean;
  dineplanEnabled: boolean;
  waitlistEnabled: boolean;
  bookingDepositEnabled: boolean;
  rewardsEnabled: boolean;
  rewardsEarningEnabled: boolean;
  rewardsRedemptionEnabled: boolean;
  notificationsEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  marketingNotificationsEnabled: boolean;
  vouchersEnabled: boolean;
  eventsEnabled: boolean;
  loyaltyEnabled: boolean;
  directOrderingEnabled: boolean;
  uberEatsEnabled: boolean;
  mrDEnabled: boolean;
}

/**
 * Defaults follow §45 with one deliberate difference: §45 names "dineplan" as
 * the provider, but no Dineplan API contract has been supplied, so the
 * Dineplan adapter can only ever answer NOT_CONFIGURED. Defaulting to it would
 * ship an app in which nobody can book. `mabu-direct` runs against the mock
 * back end until the real one exists; flip the flag when Dineplan is live.
 */
export const DEFAULT_FLAGS: FeatureFlags = {
  bookingEnabled: true,
  bookingProvider: 'mabu-direct',
  directReservationsEnabled: false,
  dineplanEnabled: false,
  waitlistEnabled: true,
  bookingDepositEnabled: false,
  rewardsEnabled: true,
  rewardsEarningEnabled: true,
  rewardsRedemptionEnabled: true,
  notificationsEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  whatsappEnabled: false,
  marketingNotificationsEnabled: false,
  vouchersEnabled: true,
  eventsEnabled: true,
  loyaltyEnabled: true,
  directOrderingEnabled: false,
  uberEatsEnabled: false,
  mrDEnabled: false,
};

const ENV_KEYS: Record<keyof FeatureFlags, string> = {
  bookingEnabled: 'MABU_BOOKING_ENABLED',
  bookingProvider: 'MABU_BOOKING_PROVIDER',
  directReservationsEnabled: 'MABU_DIRECT_RESERVATIONS_ENABLED',
  dineplanEnabled: 'DINEPLAN_ENABLED',
  waitlistEnabled: 'MABU_WAITLIST_ENABLED',
  bookingDepositEnabled: 'MABU_BOOKING_DEPOSIT_ENABLED',
  rewardsEnabled: 'MABU_REWARDS_ENABLED',
  rewardsEarningEnabled: 'MABU_REWARDS_EARNING_ENABLED',
  rewardsRedemptionEnabled: 'MABU_REWARDS_REDEMPTION_ENABLED',
  notificationsEnabled: 'MABU_NOTIFICATIONS_ENABLED',
  pushEnabled: 'MABU_PUSH_ENABLED',
  emailEnabled: 'MABU_EMAIL_ENABLED',
  smsEnabled: 'MABU_SMS_ENABLED',
  whatsappEnabled: 'MABU_WHATSAPP_ENABLED',
  marketingNotificationsEnabled: 'MABU_MARKETING_NOTIFICATIONS_ENABLED',
  vouchersEnabled: 'MABU_VOUCHERS_ENABLED',
  eventsEnabled: 'MABU_EVENTS_ENABLED',
  loyaltyEnabled: 'MABU_LOYALTY_ENABLED',
  directOrderingEnabled: 'MABU_DIRECT_ORDERING_ENABLED',
  uberEatsEnabled: 'UBER_EATS_ENABLED',
  mrDEnabled: 'MR_D_ENABLED',
};

/**
 * Reads flags from an env-like record. Accepts both the bare names the brief
 * uses (server) and EXPO_PUBLIC_-prefixed copies (client).
 */
export function flagsFromEnv(env: Record<string, string | undefined>): FeatureFlags {
  const flags: FeatureFlags = { ...DEFAULT_FLAGS };
  for (const [field, key] of Object.entries(ENV_KEYS) as [keyof FeatureFlags, string][]) {
    const raw = env[key] ?? env[`EXPO_PUBLIC_${key}`];
    if (raw === undefined) continue;
    const value = raw.trim().replace(/^"|"$/g, '');
    if (field === 'bookingProvider') {
      if (value === 'mabu-direct' || value === 'dineplan') flags.bookingProvider = value;
      continue;
    }
    (flags as unknown as Record<string, boolean>)[field] = value === 'true' || value === '1';
  }
  return flags;
}
