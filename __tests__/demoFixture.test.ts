import { withDemoRewards, withDemoTiers } from '@/services/data/demoFixture';
import { rewardExpired } from '@/services/rewardsService';
import {
  rewards as rewardCatalogue,
  tiers as shippedTiers,
  loyaltyAccount as seededAccount,
} from '@/services/data/rewardsData';

/**
 * The demo fixture, against the rules it exists to exercise.
 *
 * §15 forbids inventing a price, a reward window or an opening hour for a
 * customer, and that is right. It also left half the app unreachable: a rule
 * with nothing to enforce is a branch that has never run, and the first time
 * it runs should not be in somebody's hand.
 *
 * So the invention lives behind `EXPO_PUBLIC_DEMO_PRICES`, barred from
 * production, marked on screen by a banner that cannot be dismissed — and
 * tested here, because a fixture that has drifted out of step with the rule
 * it was built for demonstrates nothing while still looking like it does.
 */

describe('reward expiry, which had never once fired', () => {
  const rewards = withDemoRewards(rewardCatalogue.map((reward) => ({ ...reward })));

  /**
   * The shipped catalogue is the starting point, and the gap is stated here
   * rather than in a comment: not one seeded reward carries a date, so
   * `rewardExpired` returned false for every reward in the app, always.
   */
  it('has nothing to enforce without the fixture', () => {
    expect(rewardCatalogue.every((reward) => reward.expiresAt === undefined)).toBe(true);
  });

  it('gives the rule at least one reward that has run out', () => {
    const expired = rewards.filter((reward) => rewardExpired(reward));
    expect(expired.length).toBeGreaterThan(0);
  });

  /**
   * And not all of them. A fixture where everything has expired reads as a
   * broken programme rather than an illustrative one — which is exactly what
   * a hard-coded ISO date would have produced a fortnight after it was
   * written, and the reason the offsets are computed against the clock.
   */
  it('leaves most of the catalogue standing', () => {
    const live = rewards.filter((reward) => !rewardExpired(reward));
    expect(live.length).toBeGreaterThan(rewards.length / 2);
  });

  /**
   * An expired reward must not also be advertised as redeemable. The
   * catalogue's own flag and the service's recomputation have to agree —
   * a disagreement between two sources of the same fact is the defect class
   * this fixture was written to stop, not one to introduce.
   */
  it('never marks an expired reward redeemable', () => {
    for (const reward of rewards) {
      expect({ id: reward.id, wrong: rewardExpired(reward) && reward.redeemable }).toEqual({
        id: reward.id,
        wrong: false,
      });
    }
  });

  it('still refuses a reward whose cost nobody has set', () => {
    for (const reward of rewards) {
      if (reward.pointsCost === 0) expect(reward.redeemable).toBe(false);
    }
  });
});

describe('the tier ladder', () => {
  /**
   * Every shipped tier sits at 0, so the progress bar was full for everybody
   * and the ladder had no rungs.
   */
  it('gives the thresholds a real order', () => {
    // Every shipped threshold is 0, which is the state being fixed.
    expect(shippedTiers.every((tier) => tier.threshold === 0)).toBe(true);

    const tiers = withDemoTiers(shippedTiers.map((tier) => ({ ...tier })));

    const thresholds = tiers.map((tier) => tier.threshold);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    expect(new Set(thresholds).size).toBe(thresholds.length);
  });
});

/**
 * Two things the rewards screen said that no data supported.
 *
 * Both are the defect this codebase keeps producing: a screen stating a fact
 * with a source of its own, disagreeing with the source of record, and
 * nothing able to notice because neither side ever asks the other.
 */
describe('what the rewards screen is allowed to say', () => {
  /**
   * `MembershipTier` is still the API's metal scheme — 'bronze' | 'silver' |
   * 'gold' | 'black' — while §8 renamed the tiers for places. The screen
   * capitalised the identifier, so every new member read "0 points to
   * Silver": a tier this programme does not have.
   */
  it('never lets a tier identifier stand in for its name', () => {
    const names = shippedTiers.map((tier) => tier.name);

    /*
     * The exact transformation the screen was doing: take the identifier,
     * capitalise it, show it. If that ever produced a real tier name this
     * would be a harmless bug; it does not, so every member saw a tier that
     * does not exist. Asserting the two vocabularies stay disjoint is what
     * makes rendering the id a detectable mistake rather than a plausible
     * shortcut.
     */
    for (const tier of shippedTiers) {
      const capitalised = tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);
      expect({ tier: tier.tier, looksLikeAName: names.includes(capitalised) }).toEqual({
        tier: tier.tier,
        looksLikeAName: false,
      });
    }
  });

  /**
   * The seeded account has to carry the next tier's name alongside its id, or
   * the screen has nothing to render but the id — which is how this got out.
   */
  it('carries a name for the next tier wherever it carries an id', () => {
    expect(Boolean(seededAccount.nextTier)).toBe(Boolean(seededAccount.nextTierName));
    if (seededAccount.nextTierName) {
      expect(shippedTiers.map((tier) => tier.name)).toContain(seededAccount.nextTierName);
    }
  });

  /**
   * "Your first reward unlocks at 300 points" was written into the screen.
   * Nothing in the catalogue costs 300 — shipped costs are all 0, and the
   * demo fixture's cheapest is 600 — so the one concrete number on the screen
   * was the only one certainly wrong.
   */
  it('quotes no unlock threshold the catalogue cannot back', () => {
    const demo = withDemoRewards(rewardCatalogue.map((reward) => ({ ...reward })));
    const costs = demo.map((reward) => reward.pointsCost).filter((cost) => cost > 0);
    expect(costs).not.toContain(300);
    expect(Math.min(...costs)).toBeGreaterThan(0);
  });
});
