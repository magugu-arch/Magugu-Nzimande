/**
 * EVERY COMMERCIAL VALUE IN THIS FILE IS UNAPPROVED DEMO DATA.
 *
 * CLAUDE.md section 8 lists what is awaiting the franchisor. Nothing here is a
 * client figure. Each constant is flagged in the interface through
 * <DemoValue>, and the flag comes off in the same change that replaces the
 * number with an approved one.
 *
 * Do not read these constants from a screen. Everything reaches the interface
 * through the service layer in apps/web/src/lib/api.ts.
 */

/** Set false once every value below has been replaced with approved data. */
export const DEMO_DATA = true;

export const FEES = {
  /** [CONFIRM] Flat delivery fee. */
  deliveryCents: 2_900,
  /** [CONFIRM] Basket value above which delivery is free. */
  freeDeliveryOverCents: 35_000,
  /** [CONFIRM] Quoted delivery window, in minutes. */
  deliveryEtaMinutes: { min: 35, max: 45 },
  /** [CONFIRM] Quoted collection window, in minutes. */
  collectionEtaMinutes: 20,
} as const;

export const REWARDS_RULES = {
  /** [CONFIRM] Points earned per rand spent. */
  pointsPerRand: 1,
  /** [CONFIRM] Tier thresholds, in lifetime points. */
  tiers: [
    { name: 'Bronze', from: 0 },
    { name: 'Silver', from: 250 },
    { name: 'Gold', from: 1_000 },
  ],
} as const;
