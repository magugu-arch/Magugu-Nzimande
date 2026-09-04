import { demoUser } from '@/services/data/accountData';
import { rewards } from '@/services/data/rewardsData';
import { fetchRewards, redeemReward, rewardExpired } from '@/services/rewardsService';
import { inBirthdayMonth } from '@/features/rewards/birthday';

/**
 * A reward the app promises and never gives.
 *
 * The Birthday Boneless Box costs nothing, and says so three times: "Our gift
 * to you during your birthday month", "Unlocks in your birthday month", "Add
 * your date of birth to your profile to qualify". The reward screen repeats
 * it: "Unlocks automatically during your birthday month."
 *
 * It never unlocked. `fetchRewards` computed redeemability as
 *
 *     !rewardExpired(reward) && reward.category !== 'birthday' && balance >= cost
 *
 * — the category is excluded outright, so no date, no month and no balance
 * could ever make it true. The seeded customer has a date of birth on file and
 * the reward was locked in July as firmly as in January.
 *
 * This is the failure the file's own notes describe one function above, about
 * a different field: *an app that states a rule and does not keep it is worse
 * than one that never mentioned it.* The customer reads the promise, believes
 * it, waits for their birthday, and nothing happens.
 *
 * Nobody saw it because `demoUser.dateOfBirth` was a fixed `1994-07-12`, so
 * eleven months in twelve the reward was *correctly* locked and the twelfth
 * looked like a date nobody had got round to. It is now relative — the seeded
 * customer's birthday always falls in the current month, which is the state a
 * twelfth of a real customer base is in on any given day.
 */
describe('whose birthday month it is', () => {
  const july = (day: number) => new Date(2026, 6, day);

  it('is the month the date of birth falls in, whatever the year', () => {
    expect(inBirthdayMonth('1994-07-12', july(1))).toBe(true);
    expect(inBirthdayMonth('1994-07-12', july(31))).toBe(true);
  });

  it('is not the month before or after', () => {
    expect(inBirthdayMonth('1994-07-12', new Date(2026, 5, 30))).toBe(false);
    expect(inBirthdayMonth('1994-07-12', new Date(2026, 7, 1))).toBe(false);
  });

  /**
   * Read off the string rather than through `new Date(…).getMonth()`. An ISO
   * date parses as UTC midnight and `getMonth` is local, so `1994-07-01` is
   * *June* on any phone west of Greenwich — and the customer whose birthday is
   * the first of the month is exactly the one who would be told to wait.
   */
  it('does not lose a day to the timezone', () => {
    expect(inBirthdayMonth('1994-07-01', july(1))).toBe(true);
    expect(inBirthdayMonth('1994-07-31', july(31))).toBe(true);
  });

  it.each([
    ['nothing on file', undefined],
    ['an empty string', ''],
    ['something unparseable', 'sometime in July'],
    ['a partial date', '1994-07'],
  ])('says no to %s rather than guessing', (_label, value) => {
    expect(inBirthdayMonth(value)).toBe(false);
  });
});

describe('the birthday reward', () => {
  it('is seeded, free, and says it unlocks in the birthday month', () => {
    const birthday = rewards.find((reward) => reward.category === 'birthday');

    expect(birthday).toBeDefined();
    expect(birthday!.pointsCost).toBe(0);
    expect(birthday!.termsAndConditions.join(' ')).toMatch(/birthday month/i);
  });

  it('has a customer whose birthday is this month, which is the whole point', () => {
    expect(inBirthdayMonth(demoUser.dateOfBirth)).toBe(true);
  });

  it('unlocks for that customer', async () => {
    const list = await fetchRewards(demoUser.dateOfBirth);
    const birthday = list.find((reward) => reward.category === 'birthday');

    expect(birthday?.redeemable).toBe(true);
  });

  it('can actually be redeemed, and costs nothing', async () => {
    const result = await redeemReward('reward-birthday', demoUser.dateOfBirth);

    expect(result.reward.category).toBe('birthday');
    expect(result.discount).toBe(0);
  });

  it('stays locked outside the birthday month', async () => {
    // Six months away, so it lands in a different month whatever today is.
    const dob = new Date();
    dob.setMonth(dob.getMonth() + 6);
    const otherMonth = `1994-${String(dob.getMonth() + 1).padStart(2, '0')}-12`;

    const list = await fetchRewards(otherMonth);
    expect(list.find((reward) => reward.category === 'birthday')?.redeemable).toBe(false);
  });

  it('stays locked with no date of birth on file, which the terms explain', async () => {
    const list = await fetchRewards(undefined);
    const birthday = list.find((reward) => reward.category === 'birthday');

    expect(birthday?.redeemable).toBe(false);
    expect(birthday?.termsAndConditions.join(' ')).toMatch(/date of birth/i);
  });

  it('refuses a redemption outside the month rather than quietly allowing it', async () => {
    await expect(redeemReward('reward-birthday', undefined)).rejects.toThrow(/birthday/i);
  });

  /**
   * And a lapsed reward is judged on the wall it actually hit.
   *
   * Seen on the same screen while checking this one: the Heritage reward is
   * seeded expired with a balance well over its cost, so the progress card
   * read "0 points to go — roughly R 0.00 of spending" directly above a button
   * saying "This reward has expired". The shortfall was true and the invitation
   * was not, and expiry now answers first.
   */
  it('leaves an expired reward locked whatever the balance says', async () => {
    const list = await fetchRewards(demoUser.dateOfBirth);
    const lapsed = list.find((reward) => reward.id === 'reward-heritage');

    expect(lapsed).toBeDefined();
    expect(lapsed!.redeemable).toBe(false);
    // The point: the points were never the problem.
    expect(rewardExpired(lapsed!)).toBe(true);
  });

  /** And the rest of the ladder is untouched by any of this. */
  it('leaves ordinary rewards judged on points alone', async () => {
    const list = await fetchRewards(demoUser.dateOfBirth);
    const ordinary = list.filter((reward) => reward.category !== 'birthday');

    expect(ordinary.length).toBeGreaterThan(0);
    expect(ordinary.some((reward) => reward.redeemable)).toBe(true);
    expect(ordinary.some((reward) => !reward.redeemable)).toBe(true);
  });
});
