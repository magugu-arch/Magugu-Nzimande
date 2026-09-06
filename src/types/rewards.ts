import type { FoodAssetKey } from '@/constants/foodAssets';

export type MembershipTier = 'bronze' | 'silver' | 'gold' | 'black';

export interface TierDefinition {
  tier: MembershipTier;
  name: string;
  /** Points required to reach this tier within the qualifying window. */
  threshold: number;
  /**
   * Points earned per R1 of food value at this tier.
   *
   * The rate the app actually pays, and the one the earn-rate perk line is
   * written from — see `tiers` in `services/data/rewardsData.ts`. Those were
   * two independent things until now: the screen advertised "1.25 points per
   * R1" to Silver members as a hand-typed string while `randToPoints` paid
   * everybody 1, and nothing could notice.
   */
  pointsPerRand: number;
  /**
   * Perks *other than* the earn rate. The earn line is derived and prepended
   * by `perksFor`, so it cannot drift from what is paid.
   */
  perks: string[];
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  assetKey?: FoodAssetKey;
  /**
   * The dish this reward is worth, when it is worth a dish.
   *
   * A `food` reward promises a specific item and had no way to name one. It
   * carried a picture of it and a sentence about it, and neither is something
   * the app can check anything against — so "Free Cheesling Fries" went on
   * offering itself at 650 points while Cheesling Fries had every option in its
   * required Size group sold out. A member could spend the points on a reward
   * for something the menu would refuse to put in their basket.
   *
   * The Offers screen already solved exactly this for promotions, by reading
   * the product id out of `ctaHref` — see `promotedProductId`. Rewards had no
   * equivalent because there was nothing to read.
   *
   * Absent for `discount`, `delivery` and `birthday` rewards, which are worth a
   * rand amount or a fee rather than a thing on the menu.
   */
  productId?: string;
  /** ISO date; undefined = no expiry. */
  expiresAt?: string;
  category: 'food' | 'discount' | 'delivery' | 'birthday';
  /** False when the member has too few points. */
  redeemable: boolean;
  termsAndConditions: string[];
}

export interface Voucher {
  id: string;
  code: string;
  title: string;
  description: string;
  /** Percentage (0-100) or fixed rand amount, per `discountType`. */
  discountType: 'percentage' | 'fixed' | 'freeItem' | 'freeDelivery';
  /**
   * Which product a `freeItem` voucher makes free.
   *
   * Without it the type cannot say what the wallet's "Free item" label
   * promises, and the arithmetic behind that label was `Math.min(
   * discountValue, subtotal)` — a rand amount off, exactly like a `fixed`
   * voucher, with nothing tying it to anything on the menu. A customer whose
   * free item costs R95 against a `discountValue` of R62 would have paid R33
   * for it.
   *
   * Only meaningful for `freeItem`; the other three mechanics carry their
   * whole meaning in `discountValue`.
   */
  freeProductId?: string;
  discountValue: number;
  minimumSpend: number;
  expiresAt: string;
  used: boolean;
  /**
   * Evaluated when the voucher is fetched, not when a component renders —
   * reading the clock during render makes output depend on re-render timing.
   * TanStack Query refetches keep this current.
   */
  expired: boolean;
  assetKey?: FoodAssetKey;
}

export interface PointsEntry {
  id: string;
  description: string;
  points: number;
  occurredAt: string;
  orderReference?: string;
}

export interface LoyaltyAccount {
  memberId: string;
  pointsBalance: number;
  tier: MembershipTier;
  tierName: string;
  /** Points still needed for the next tier; 0 when already at the top. */
  pointsToNextTier: number;
  nextTier?: MembershipTier;
  /** 0..1 progress toward the next tier, for the progress bar. */
  tierProgress: number;
  lifetimePoints: number;
  history: PointsEntry[];
}

export interface Promotion {
  id: string;
  headline: string;
  description: string;
  /** Data-driven banner artwork (brief §11 — promotions are never hard-coded). */
  assetKey: FoodAssetKey;
  ctaLabel: string;
  /** Route the CTA opens. Kept as a string so promotions stay data-driven. */
  ctaHref: string;
  promoCode?: string;
  validFrom: string;
  validUntil: string;
  terms: string[];
  /** Renders on a dark scrim over the food image when true. */
  usePromotionalComposition: boolean;
}
