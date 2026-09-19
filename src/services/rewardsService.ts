import { businessRules, config } from '@/constants/config';
import type { LoyaltyAccount, Promotion, Reward, TierDefinition, Voucher } from '@/types';
import { voucherDiscount } from '@/utils/cart';
import { hasPassed } from '@/utils/datetime';
import { delay, request } from './apiClient';
import { loyaltyAccount, promotions, rewards, tiers, vouchers } from './data/rewardsData';
import { demoVouchers, withDemoRewards, withDemoTiers } from './data/demoFixture';
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

/** The tier a lifetime total earns, and how far it is from the next one. */
function standingFor(
  lifetimePoints: number,
): Pick<
  LoyaltyAccount,
  'tier' | 'tierName' | 'nextTier' | 'pointsToNextTier' | 'tierProgress' | 'lifetimePoints'
> {
  const ranked = [...tierLadder].sort((a, b) => a.threshold - b.threshold);
  const currentIndex = Math.max(
    0,
    ranked.filter((candidate) => lifetimePoints >= candidate.threshold).length - 1,
  );
  const current = ranked[currentIndex]!;
  const next = ranked[currentIndex + 1];

  return {
    lifetimePoints,
    tier: current.tier,
    tierName: current.name,
    ...(next ? { nextTier: next.tier } : {}),
    pointsToNextTier: next ? Math.max(0, next.threshold - lifetimePoints) : 0,
    tierProgress: next
      ? Math.min(
          1,
          Math.max(
            0,
            (lifetimePoints - current.threshold) / (next.threshold - current.threshold || 1),
          ),
        )
      : 1,
  };
}

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
    //
    // `pointsCost > 0` is not pedantry. A reward whose economics Pappas has
    // not set carries a cost of zero, and `balance >= 0` is true for
    // everybody — so without this, every unpriced reward reads as affordable
    // to a member with no points at all, and redeeming one succeeds with a
    // discount of R0. That is a redemption that deducts nothing and delivers
    // nothing, and the member has no way to tell it apart from a real one.
    //
    // Nothing in the programme is genuinely free, so a zero means unset.
    return rewardCatalogue.map((reward) => ({
      ...reward,
      redeemable:
        !rewardExpired(reward) &&
        reward.category !== 'birthday' &&
        reward.pointsCost > 0 &&
        balance >= reward.pointsCost,
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
  if (!reward) throw new Error('Reward not found');
  return reward;
}

export async function fetchTiers(): Promise<TierDefinition[]> {
  if (config.useMockApi) return delay(tierLadder, 120);
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
/**
 * The wallet this build serves. Empty as shipped — Pappas has issued no
 * vouchers — and carrying one illustrative code under the demo fixture, so
 * the promo-code and expiry paths have something to exercise.
 */
let voucherLedger: Voucher[] = (config.useDemoPrices ? demoVouchers() : vouchers).map(
  (voucher) => ({ ...voucher }),
);

/**
 * Replace the mock wallet.
 *
 * The shipped Pappas wallet is empty — §15 forbids inventing promotions, and
 * a voucher is a discount, a code, an expiry and a minimum spend, which is
 * four invented commercial terms in one object. Nobody has issued one.
 *
 * But voucher *validation* is real behaviour that must keep working the day
 * Pappas does issue one: unknown codes refused, minimum spends enforced, a
 * one-time code refused on its second use. Testing that against an empty
 * wallet is impossible, and seeding the shipped wallet to make the tests
 * pass would put invented promotions back in the product to serve the suite.
 *
 * So the seam is here instead. Mock mode only — against a real backend the
 * wallet comes from the server and this is never called.
 */
export function __seedVoucherWallet(seed: Voucher[]): void {
  voucherLedger = seed.map((voucher) => ({ ...voucher }));
}

/** Put the wallet back to what the app actually ships with. */
export function __resetVoucherWallet(): void {
  voucherLedger = vouchers.map((voucher) => ({ ...voucher }));
}

/**
 * The reward catalogue and tier ladder the mock layer serves.
 *
 * Same seam, same reason as the wallet above. The shipped Pappas programme
 * has no points costs and no tier thresholds — §15 forbids inventing loyalty
 * rules, and a threshold is one — so nothing in it is redeemable and no tier
 * boundary exists to cross.
 *
 * The *mechanics* still have to work the day Pappas sets the numbers:
 * redeeming must deduct, cancelling must refund, and crossing a threshold
 * must move the tier. None of that is testable against a programme with no
 * economics, so tests seed one here rather than putting invented loyalty
 * rules back into the product to keep a suite green.
 */
/**
 * The programme as this build serves it.
 *
 * Mutable copies so the test seeds below can replace them, and run through
 * the demo fixture when that is on — the shipped programme has every tier at
 * threshold 0 and every reward at `pointsCost: 0`, because nobody has set
 * them, which leaves the ladder and the redemption path with nothing to
 * exercise.
 */
let rewardCatalogue: Reward[] = (config.useDemoPrices ? withDemoRewards(rewards) : rewards).map(
  (reward) => ({ ...reward }),
);
let tierLadder: TierDefinition[] = (config.useDemoPrices ? withDemoTiers(tiers) : tiers).map(
  (tier) => ({ ...tier }),
);

export function __seedRewardProgramme(seed: {
  rewards?: Reward[];
  tiers?: TierDefinition[];
}): void {
  if (seed.rewards) rewardCatalogue = seed.rewards.map((reward) => ({ ...reward }));
  if (seed.tiers) tierLadder = seed.tiers.map((tier) => ({ ...tier }));
}

export function __resetRewardProgramme(): void {
  rewardCatalogue = rewards.map((reward) => ({ ...reward }));
  tierLadder = tiers.map((tier) => ({ ...tier }));
}

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

  /**
   * Two different reasons a reward cannot be taken, and they need different
   * words.
   *
   * "You do not have enough points yet" is the right message when a member is
   * short. It is the wrong message — and a confusing one — for a reward whose
   * economics Pappas has not set, because there is no number of points that
   * would help. Telling a member to earn more toward a threshold that does
   * not exist is worse than telling them nothing.
   *
   * A reward awaiting its economics is the `pointsCost === 0` case: nothing
   * in the programme is genuinely free, so a zero means unset rather than
   * costless. See `services/data/rewardsData.ts` on why every reward is in
   * that state today.
   */
  if (!reward.redeemable && reward.pointsCost === 0) {
    throw new Error('This reward is not available yet.');
  }
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
