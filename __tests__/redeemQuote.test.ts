import { businessRules } from '@/constants/config';
import { rewards } from '@/services/data/rewardsData';
import { redeemReward } from '@/services/rewardsService';

/**
 * What a redemption is quoted as worth, against the constants that set it.
 *
 * `redeemReward` used to work the discount out from two numbers written into
 * the service by hand:
 *
 *     reward.category === 'delivery' ? 32 : Math.round(reward.pointsCost * 0.05)
 *
 * Those are `businessRules.deliveryFee` and `businessRules.randPerPoint`,
 * arrived at separately and agreeing by coincidence. `constants/config.ts` is
 * documented as the single place the commercial rules are set, and this was a
 * second place. The arithmetic now reads the rules, and these tests hold it
 * there.
 *
 * ── Why this file looks different under Pappas ───────────────────────────
 *
 * §15 forbids inventing loyalty rules, so no Pappas reward carries a points
 * cost: every one is `pointsCost: 0, redeemable: false` until the programme's
 * economics are set. That makes the conversion arithmetic untestable against
 * the seed — there is nothing to convert.
 *
 * Two ways to handle that. The tempting one is to skip, which leaves a file
 * that reports green while testing nothing. The other is to test what the
 * code actually does in this state, which turns out to be the more valuable
 * test anyway: a reward nobody has priced must refuse cleanly, and must
 * refuse with the *right words*.
 *
 * The conversion tests below are kept and run against any reward that does
 * carry a cost. The day Pappas supplies the programme, they start working
 * without anyone remembering to re-enable them — and `every reward is still
 * awaiting its economics` starts failing, which is the reminder to come back
 * and read this comment.
 */
describe('a reward nobody has priced yet', () => {
  const unpriced = rewards.filter((reward) => reward.pointsCost === 0 && !reward.redeemable);

  it('is the state the whole programme is in today', () => {
    // Fails the moment Pappas supplies the economics — at which point the
    // conversion tests below take over. That is the intended handover.
    expect(unpriced).toHaveLength(rewards.length);
    expect(rewards.length).toBeGreaterThan(0);
  });

  it('refuses redemption rather than granting R0 off', () => {
    // A quote of R0 would be a successful redemption worth nothing, which
    // deducts points against a benefit the member never receives.
    return expect(redeemReward(unpriced[0]!.id)).rejects.toThrow();
  });

  it('does not tell a member they are short of points', async () => {
    // There is no number of points that would help, so pointing at a
    // threshold that does not exist is worse than saying nothing. The member
    // should read "not available yet", not "earn more".
    await expect(redeemReward(unpriced[0]!.id)).rejects.toThrow(/not available yet/i);
    await expect(redeemReward(unpriced[0]!.id)).rejects.not.toThrow(/enough points/i);
  });
});

describe('what a priced reward is quoted as worth', () => {
  const priced = rewards.filter((reward) => reward.pointsCost > 0 && reward.redeemable);

  it('converts points at the rate the rules set', async () => {
    for (const reward of priced) {
      if (reward.category === 'delivery') continue;
      const { discount } = await redeemReward(reward.id);
      expect(discount).toBe(Math.round(reward.pointsCost * businessRules.randPerPoint));
    }
  });

  it('quotes a delivery reward at the fee the app actually charges', async () => {
    // A free delivery quoted at R32 while delivery costs R35 is wrong
    // wherever it is shown.
    for (const reward of priced.filter((r) => r.category === 'delivery')) {
      const { discount } = await redeemReward(reward.id);
      expect(discount).toBe(businessRules.deliveryFee);
    }
  });

  /**
   * The guard that makes the two above mean something once there is data.
   *
   * Both would pass against a hardcoded literal that happens to equal today's
   * constant — which is exactly the state this file was written to end.
   */
  it('scales with the points rather than returning one fixed number', async () => {
    const food = priced.filter((reward) => reward.category === 'food');
    if (food.length < 2) return; // Nothing to compare until the programme is set.

    const quotes = await Promise.all(
      food.map(async (reward) => (await redeemReward(reward.id)).discount),
    );
    expect(new Set(quotes).size).toBeGreaterThan(1);
  });
});
