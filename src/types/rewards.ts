import type { FoodAssetKey } from '@/constants/foodAssets';

export type MembershipTier = 'bronze' | 'silver' | 'gold' | 'black';

export interface TierDefinition {
  tier: MembershipTier;
  name: string;
  /** Points required to reach this tier within the qualifying window. */
  threshold: number;
  perks: string[];
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  assetKey?: FoodAssetKey;
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
