import { config } from '@/constants/config';
import type { LoyaltyAccount, Promotion, Reward, TierDefinition, Voucher } from '@/types';
import { delay, request } from './apiClient';
import { loyaltyAccount, promotions, rewards, tiers, vouchers } from './data/rewardsData';

export async function fetchLoyaltyAccount(): Promise<LoyaltyAccount> {
  if (config.useMockApi) return delay(loyaltyAccount);
  return request<LoyaltyAccount>('/v1/loyalty/account');
}

export async function fetchRewards(): Promise<Reward[]> {
  if (config.useMockApi) {
    const account = await fetchLoyaltyAccount();
    // Redeemability is a function of the live balance, never a static flag.
    return rewards.map((reward) => ({
      ...reward,
      redeemable: reward.category !== 'birthday' && account.pointsBalance >= reward.pointsCost,
    }));
  }
  return request<Reward[]>('/v1/loyalty/rewards');
}

export async function fetchReward(rewardId: string): Promise<Reward> {
  const list = await fetchRewards();
  const reward = list.find((candidate) => candidate.id === rewardId);
  if (!reward) throw new Error('Reward not found');
  return reward;
}

export async function fetchTiers(): Promise<TierDefinition[]> {
  if (config.useMockApi) return delay(tiers, 120);
  return request<TierDefinition[]>('/v1/loyalty/tiers');
}

/**
 * Re-evaluate `expired` against the clock at fetch time.
 *
 * Screens must not read the clock while rendering, so expiry is resolved here
 * and refreshed by TanStack Query rather than recomputed on every render.
 */
function stampExpiry(list: Voucher[], now = Date.now()): Voucher[] {
  return list.map((voucher) => ({
    ...voucher,
    expired: new Date(voucher.expiresAt).getTime() <= now,
  }));
}

export async function fetchVouchers(): Promise<Voucher[]> {
  if (config.useMockApi) return delay(stampExpiry(vouchers));
  return stampExpiry(await request<Voucher[]>('/v1/loyalty/vouchers'));
}

/** Vouchers the customer can actually use right now. */
export async function fetchActiveVouchers(): Promise<Voucher[]> {
  const list = await fetchVouchers();
  return list.filter((voucher) => !voucher.used && !voucher.expired);
}

export async function fetchPromotions(): Promise<Promotion[]> {
  if (config.useMockApi) {
    const now = Date.now();
    return delay(
      promotions.filter(
        (promotion) =>
          new Date(promotion.validFrom).getTime() <= now &&
          new Date(promotion.validUntil).getTime() >= now,
      ),
    );
  }
  return request<Promotion[]>('/v1/promotions');
}

export async function fetchPromotion(promotionId: string): Promise<Promotion> {
  const list = await fetchPromotions();
  const promotion = list.find((candidate) => candidate.id === promotionId);
  if (!promotion) throw new Error('That offer has ended.');
  return promotion;
}

export interface VoucherValidation {
  voucher: Voucher;
  /** Rand value the voucher takes off this specific basket. */
  discount: number;
  freeDelivery: boolean;
}

/**
 * Validate a typed promo code against the current basket.
 * Throws a customer-readable message on every rejection path.
 */
export async function validateVoucherCode(
  code: string,
  subtotal: number,
): Promise<VoucherValidation> {
  const normalised = code.trim().toUpperCase();
  if (normalised.length === 0) throw new Error('Enter a promo code.');

  if (!config.useMockApi) {
    return request<VoucherValidation>('/v1/vouchers/validate', {
      method: 'POST',
      body: { code: normalised, subtotal },
    });
  }

  const list = await fetchVouchers();
  const voucher = list.find((candidate) => candidate.code === normalised);

  if (!voucher) throw new Error("We don't recognise that code.");
  if (voucher.used) throw new Error('That code has already been used.');
  if (voucher.expired) throw new Error('That code has expired.');
  if (subtotal < voucher.minimumSpend) {
    throw new Error(`Spend at least R${voucher.minimumSpend} to use this code.`);
  }

  return {
    voucher,
    discount: discountFor(voucher, subtotal),
    freeDelivery: voucher.discountType === 'freeDelivery',
  };
}

/** Rand value a voucher removes from a given subtotal. */
export function discountFor(voucher: Voucher, subtotal: number): number {
  switch (voucher.discountType) {
    case 'fixed':
      return Math.min(voucher.discountValue, subtotal);
    case 'percentage':
      return Math.round(subtotal * (voucher.discountValue / 100) * 100) / 100;
    case 'freeItem':
      return Math.min(voucher.discountValue, subtotal);
    case 'freeDelivery':
      return 0;
  }
}

export async function redeemReward(
  rewardId: string,
): Promise<{ reward: Reward; discount: number }> {
  if (!config.useMockApi) {
    return request<{ reward: Reward; discount: number }>('/v1/loyalty/redeem', {
      method: 'POST',
      body: { rewardId },
    });
  }

  const reward = await fetchReward(rewardId);
  if (!reward.redeemable) throw new Error('You do not have enough points for this reward yet.');

  // Food rewards are worth their points at the standard conversion rate.
  const discount = reward.category === 'delivery' ? 32 : Math.round(reward.pointsCost * 0.05);
  return delay({ reward, discount }, 400);
}
