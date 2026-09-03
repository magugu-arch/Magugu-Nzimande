import { REWARDS_RULES } from '@bbq/seed';

/**
 * Which rung of the ladder a customer is on.
 *
 * The three tiers were listed on the rewards page from the day it was built and
 * nothing worked out which one anybody had reached: the page showed a ladder
 * with no "you are here", and the account page showed a number with no ladder.
 *
 * ONE THING TO KNOW BEFORE WIRING IN-STORE REDEMPTION. The tiers are described
 * as reached at N *lifetime* points, and the figure this is given is the
 * account's balance. They are the same number today only because nothing spends
 * points online — redemption happens at the counter and no code decrements the
 * balance. The moment it does, a customer who spends their points would drop a
 * tier, which is not what a loyalty ladder means. The fix then is a separate
 * lifetime total on the account, not a change here.
 */

export type Tier = { name: string; from: number };

export type TierStanding = {
  /** The highest tier reached. Never null: the first tier starts at zero. */
  current: Tier;
  /** The next one up, or null at the top of the ladder. */
  next: Tier | null;
  /** Points still to earn to reach `next`, or 0 at the top. */
  toNext: number;
};

/** Tiers in ascending order, whatever order the seed happens to list them in. */
const ladder = (): Tier[] => [...REWARDS_RULES.tiers].sort((a, b) => a.from - b.from);

export function tierFor(points: number): TierStanding {
  const tiers = ladder();

  // Reduce rather than findLast, so a ladder whose first rung does not start at
  // zero still returns something: the lowest tier stands in, which is what the
  // page shows a brand-new account.
  const current = tiers.reduce(
    (reached, tier) => (points >= tier.from ? tier : reached),
    tiers[0] as Tier,
  );

  const next = tiers.find((tier) => tier.from > points) ?? null;

  return {
    current,
    next,
    // Never negative: somebody past the top of the ladder has nothing to earn.
    toNext: next ? Math.max(0, next.from - points) : 0,
  };
}
