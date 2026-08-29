import { businessRules } from '@/constants/config';
import { rewards } from '@/services/data/rewardsData';
import { redeemReward } from '@/services/rewardsService';

/**
 * What a redemption is quoted as worth, against the constants that set it.
 *
 * `redeemReward` worked the discount out from two numbers written into the
 * service by hand:
 *
 *     reward.category === 'delivery' ? 32 : Math.round(reward.pointsCost * 0.05)
 *
 * Those are `businessRules.deliveryFee` and `businessRules.randPerPoint`,
 * arrived at separately and agreeing by coincidence. `constants/config.ts` is
 * documented as the single place the commercial rules are set, and this was a
 * second place.
 *
 * The food branch is live money — that number goes into `rewardEffect` and
 * comes off the bill — so signing off a different conversion rate would leave
 * every reward in the app quoting the old one, with nothing to notice. The
 * existing `quotedPrices` suite catches this in seeded *copy*; it cannot see
 * code, which is how this survived.
 */
describe('what redeeming a reward is quoted as worth', () => {
  const bySample = (category: string) => rewards.find((reward) => reward.category === category);

  it('found rewards of both kinds to check', () => {
    // The assertions below are per-reward, so an empty or reshaped seed would
    // let this whole file pass without testing anything.
    expect(bySample('food')).toBeDefined();
    expect(bySample('delivery')).toBeDefined();
  });

  it('quotes a delivery reward at the fee the app actually charges', async () => {
    const reward = bySample('delivery')!;
    const { discount } = await redeemReward(reward.id);

    // Informational today, because `rewardEffect` waives the fee by measuring
    // it rather than by reading this. Against a real backend it is what
    // POST /v1/loyalty/redeem returns, and a free delivery quoted at R32 while
    // delivery costs R35 is wrong wherever it is shown.
    expect(discount).toBe(businessRules.deliveryFee);
  });

  it('converts a food reward’s points at the rate the rules set', async () => {
    const reward = bySample('food')!;
    const { discount } = await redeemReward(reward.id);

    expect(discount).toBe(Math.round(reward.pointsCost * businessRules.randPerPoint));
  });

  /**
   * The guard that makes the two above mean something. Both would pass against
   * a hardcoded literal that happens to equal today's constant — which is
   * exactly the state this file was written to end. This one fails the moment
   * the arithmetic stops being arithmetic.
   */
  it('scales with the points, rather than returning one fixed number', async () => {
    const food = rewards.filter(
      (reward) => reward.category === 'food' && reward.pointsCost > 0 && reward.redeemable,
    );
    expect(food.length).toBeGreaterThan(1);

    const quotes = await Promise.all(
      food.map(async (reward) => (await redeemReward(reward.id)).discount),
    );
    expect(new Set(quotes).size).toBeGreaterThan(1);
  });
});
