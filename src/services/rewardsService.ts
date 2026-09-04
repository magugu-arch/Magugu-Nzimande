import { businessRules, config } from '@/constants/config';
import type { LoyaltyAccount, Promotion, Reward, TierDefinition, Voucher } from '@/types';
import { voucherDiscount } from '@/utils/cart';
import { hasPassed } from '@/utils/datetime';
import { delay, notFound, request } from './apiClient';
import {
  loyaltyAccount,
  promotions,
  rewards,
  standingFor,
  tiers,
  vouchers,
} from './data/rewardsData';
import { checkedLoyaltyAccount, checkedVouchers } from './wireChecks';

/**
 * The mock's loyalty ledger, which until now did not move.
 *
 * `fetchLoyaltyAccount` returned a frozen constant, so points were the one
 * part of this app whose arithmetic nothing could check: place an order and
 * the confirmation promised 287 points, the balance stayed at 1 840 and the
 * history never mentioned it. Redeeming was worse — `redeemReward` validated
 * the reward, quoted a discount and deducted nothing, so the same 1 500-point
 * reward could be spent over and over for ever.
 *
 * A demo build would have shown all of that to the client. More to the point,
 * no test could state what *should* happen, because every answer was the same
 * answer.
 *
 * When points settle is a real policy question and this takes the reading the
 * payload already implies: `PlaceOrderInput` carries `redeemedRewardId`, so a
 * redemption is settled with the order rather than at the moment somebody taps
 * a reward. Nobody loses points by browsing, and an abandoned cart costs
 * nothing. Worth confirming against how the loyalty programme is actually run.
 */
let account: LoyaltyAccount = { ...loyaltyAccount, history: [...loyaltyAccount.history] };

/**
 * Move the balance and say why, in the mock only.
 *
 * `lifetime` is what separates earning from spending: points spent leave the
 * balance but were still earned, so they must not drag the tier back down with
 * them. A cancelled order is the one case that does reduce it, because that
 * order's points were never really earned.
 */
export function recordPoints(entry: {
  description: string;
  points: number;
  lifetimeDelta?: number;
  orderReference?: string;
}): LoyaltyAccount {
  const lifetime = Math.max(0, account.lifetimePoints + (entry.lifetimeDelta ?? 0));

  account = {
    ...account,
    ...standingFor(lifetime),
    pointsBalance: Math.max(0, account.pointsBalance + entry.points),
    history: [
      {
        id: `points-${Date.now().toString(36)}-${Math.abs(entry.points)}`,
        description: entry.description,
        points: entry.points,
        occurredAt: new Date().toISOString(),
        ...(entry.orderReference ? { orderReference: entry.orderReference } : {}),
      },
      ...account.history,
    ],
  };

  return account;
}

export async function fetchLoyaltyAccount(): Promise<LoyaltyAccount> {
  if (config.useMockApi) return delay(account);
  return request<LoyaltyAccount>('/v1/loyalty/account', { parse: checkedLoyaltyAccount });
}

/**
 * Whether a reward has run out of time.
 *
 * `Reward.expiresAt` was declared on the type and printed on the reward
 * screen — "Expires 12 Sep" — and enforced by nothing at all. An app that
 * states a rule and does not keep it is worse than one that never mentioned
 * it: the customer reads the date, believes it, and the app hands over the
 * reward anyway. Birthday rewards are the obvious case, and the seeded list
 * has one.
 */
export function rewardExpired(reward: Reward, now: Date = new Date()): boolean {
  return hasPassed(reward.expiresAt, now);
}

export async function fetchRewards(): Promise<Reward[]> {
  if (config.useMockApi) {
    const balance = (await fetchLoyaltyAccount()).pointsBalance;
    // Redeemability is a function of the live balance, never a static flag.
    return rewards.map((reward) => ({
      ...reward,
      redeemable:
        !rewardExpired(reward) && reward.category !== 'birthday' && balance >= reward.pointsCost,
    }));
  }

  // The server owns the balance judgement; expiry is a veto the client can
  // apply from data it already holds. Same shape as `isTradingNow`: both
  // sources can close a door, neither can force one open.
  const remote = await request<Reward[]>('/v1/loyalty/rewards');
  return remote.map((reward) => ({
    ...reward,
    redeemable: reward.redeemable && !rewardExpired(reward),
  }));
}

export async function fetchReward(rewardId: string): Promise<Reward> {
  const list = await fetchRewards();
  const reward = list.find((candidate) => candidate.id === rewardId);
  if (!reward) throw notFound('That reward is no longer available.');
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

/**
 * The mock's voucher ledger, for the same reason the loyalty one exists.
 *
 * `Voucher.used` was read in two places and written in none. The seed marks
 * one voucher used so that state renders somewhere, but no voucher ever
 * *became* used — so "R50 off your first order" came off the first order, and
 * the second, and the fiftieth:
 *
 *     1st use: WELCOME50 discount R 50
 *     2nd use: WELCOME50 discount R 50
 *     3rd use: WELCOME50 discount R 50
 *
 * A stated one-time promotion paying out for ever, in rand.
 */
let voucherLedger: Voucher[] = vouchers.map((voucher) => ({ ...voucher }));

/** Spend a voucher, so it cannot be spent again. Mock only. */
export function markVoucherUsed(code: string): void {
  const normalised = code.trim().toUpperCase();
  voucherLedger = voucherLedger.map((voucher) =>
    voucher.code === normalised ? { ...voucher, used: true } : voucher,
  );
}

/**
 * Hand a voucher back, for an order that did not happen.
 *
 * A customer who cancels has not had their R50 — taking the code as well would
 * charge them for changing their mind.
 */
export function restoreVoucher(code: string): void {
  const normalised = code.trim().toUpperCase();
  voucherLedger = voucherLedger.map((voucher) =>
    voucher.code === normalised ? { ...voucher, used: false } : voucher,
  );
}

export async function fetchVouchers(): Promise<Voucher[]> {
  if (config.useMockApi) return delay(stampExpiry(voucherLedger));
  return stampExpiry(await request<Voucher[]>('/v1/loyalty/vouchers', { parse: checkedVouchers }));
}

/** Vouchers the customer can actually use right now. */
export async function fetchActiveVouchers(): Promise<Voucher[]> {
  const list = await fetchVouchers();
  return list.filter((voucher) => !voucher.used && !voucher.expired);
}

/** Whether a promotion is inside its window right now. */
export function promotionIsRunning(promotion: Promotion, now: Date = new Date()): boolean {
  const at = now.getTime();
  return (
    new Date(promotion.validFrom).getTime() <= at && new Date(promotion.validUntil).getTime() >= at
  );
}

/** Every promotion on the calendar, running or not. Not for rendering. */
async function promotionCalendar(): Promise<Promotion[]> {
  if (config.useMockApi) return delay(promotions);
  return request<Promotion[]>('/v1/promotions');
}

export async function fetchPromotions(): Promise<Promotion[]> {
  const now = new Date();
  // The window is a veto the client can apply from data it already holds —
  // same shape as `rewardExpired` above and `isTradingNow`. A campaign that
  // ended an hour ago can still be sitting in a cached list or a slow CDN.
  return (await promotionCalendar()).filter((promotion) => promotionIsRunning(promotion, now));
}

/**
 * A single promotion, if it is running — and if it is not, which way.
 *
 * Two things happen here that did not before.
 *
 * It is a not-found rather than a bare `Error`, so the detail screen can tell
 * an offer that is over from a server it could not reach. Those are different
 * sentences and the screen was saying the first for both.
 *
 * And it reads the whole calendar rather than the filtered list, because
 * "before" and "after" are not the same answer. Seeding a campaign loaded
 * ahead of its launch showed the app telling a customer that an offer opening
 * in twelve days "is no longer running" — false, and the more damaging
 * direction of the two: somebody who followed a teaser is told the thing they
 * are waiting for is finished. The list still shows neither.
 */
export async function fetchPromotion(promotionId: string): Promise<Promotion> {
  const now = new Date();
  const promotion = (await promotionCalendar()).find((candidate) => candidate.id === promotionId);

  // An id the calendar has never heard of gets the ended message: the app
  // cannot know why it is missing, and "this has finished" is the likelier
  // history of a link somebody is holding than a campaign that never ran.
  if (!promotion) throw notFound('That offer has ended.', 'promotion_ended');

  if (!promotionIsRunning(promotion, now)) {
    throw new Date(promotion.validFrom).getTime() > now.getTime()
      ? notFound('That offer has not started yet.', 'promotion_not_started')
      : notFound('That offer has ended.', 'promotion_ended');
  }

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

/**
 * Rand value a voucher removes from a given subtotal.
 *
 * Delegates to utils/cart so the rule has one implementation. A second copy
 * here would let a code be worth one amount when it is entered and another
 * when the basket is totalled.
 */
export function discountFor(voucher: Voucher, subtotal: number): number {
  return voucherDiscount(voucher, subtotal);
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
  // Checked before redeemability, which is now false for an expired reward
  // too — without this the customer would be told they are short of points
  // when the points were never the problem.
  if (rewardExpired(reward)) throw new Error('That reward has expired.');
  if (!reward.redeemable) throw new Error('You do not have enough points for this reward yet.');

  /**
   * Both numbers come from `businessRules`, which is the single place the
   * commercial rules are set. They were written out here as `32` and `0.05`,
   * which are `deliveryFee` and `randPerPoint` — the same values, arrived at
   * separately, agreeing by coincidence rather than by construction.
   *
   * The second one is live money: a food reward's `discount` goes straight into
   * `rewardEffect` and comes off the bill. Sign off a different conversion rate
   * and every reward in the app keeps quoting the old one, with nothing to
   * notice. The first is informational today — `rewardEffect` waives the fee by
   * measuring it rather than by reading this — but it is what
   * `POST /v1/loyalty/redeem` will return against a real backend, and a free
   * delivery worth R32 when delivery costs R35 is still wrong.
   */
  const discount =
    reward.category === 'delivery'
      ? businessRules.deliveryFee
      : Math.round(reward.pointsCost * businessRules.randPerPoint);
  return delay({ reward, discount }, 400);
}
