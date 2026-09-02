import { notifications, supportTopics } from '@/services/data/accountData';
import {
  earnRateLine,
  listSentence,
  loyaltyAccount,
  nextTierOf,
  programmeEarnRateLine,
  promotions,
  standingFor,
  tierNamed,
  tiers,
} from '@/services/data/rewardsData';

/**
 * What the app says about the tier ladder, against what the ladder is.
 *
 * `__tests__/quotedPrices.test.ts` holds the rand figures in seeded copy to
 * `businessRules`. This is the same job for the loyalty programme, which had
 * two defects of exactly that shape and one worse than it.
 *
 * The copy ones: the help section answered "How do bb.q Rewards points work?"
 * with *"You earn 1 point per R1 spent on food, and more as you move up
 * tiers"*, and no tier paid more than any other; a notification advertised
 * *"Gold unlocks free delivery every week and priority in the kitchen queue"*,
 * retyping Gold's own perk list. Both read as true. Only the ladder can say.
 *
 * The worse one was the seeded member. Their standing was written out —
 * `tier: 'silver'`, `pointsToNextTier: 2160`, and a `tierProgress` fraction
 * over thresholds typed a second time — beside a `lifetimePoints` of 4 620
 * that puts them past Gold's 4 000. `recordPoints` recomputes all five fields
 * from the ladder on the next order, so the app opened on Silver and promoted
 * the member to Gold the moment they bought anything. Nothing was wrong with
 * the arithmetic. The starting position simply never satisfied it.
 */
describe('the seeded member stands where the ladder puts them', () => {
  it('agrees with a fresh computation from their own lifetime total', () => {
    const {
      history: _history,
      memberId: _memberId,
      pointsBalance: _balance,
      ...standing
    } = loyaltyAccount;

    expect(standing).toEqual(standingFor(loyaltyAccount.lifetimePoints));
  });

  /**
   * The failure as a customer would have met it: open the app, buy one thing,
   * watch a tier arrive that was not earned.
   */
  it('does not change tier on an order that clears no threshold', () => {
    const smallOrder = 209;
    const after = standingFor(loyaltyAccount.lifetimePoints + smallOrder);

    expect(after.pointsToNextTier).toBeGreaterThan(0);
    expect(after.tier).toBe(loyaltyAccount.tier);
  });

  it('has earned at least what it still holds', () => {
    // Redeeming spends the balance without unearning the points, so lifetime
    // can never be the smaller of the two.
    expect(loyaltyAccount.lifetimePoints).toBeGreaterThanOrEqual(loyaltyAccount.pointsBalance);
  });

  it('counts every redemption in the history back into the lifetime total', () => {
    const spent = loyaltyAccount.history
      .filter((entry) => entry.points < 0)
      .reduce((total, entry) => total + Math.abs(entry.points), 0);

    expect(spent).toBeGreaterThan(0);
    expect(loyaltyAccount.lifetimePoints).toBe(loyaltyAccount.pointsBalance + spent);
  });
});

/** Every sentence the seed ships that a customer could read. */
const sentences: { where: string; text: string }[] = [
  ...supportTopics.map((topic) => ({ where: `support ${topic.id}`, text: topic.answer })),
  ...notifications.flatMap((notification) => [
    { where: `notification ${notification.id} title`, text: notification.title },
    { where: `notification ${notification.id} body`, text: notification.body },
  ]),
  ...promotions.flatMap((promotion) => [
    { where: `promotion ${promotion.id} headline`, text: promotion.headline },
    { where: `promotion ${promotion.id} description`, text: promotion.description },
  ]),
];

describe('what the copy claims about tiers', () => {
  it('found sentences to read, rather than passing on an empty list', () => {
    // The way a check like this fails silently is by checking nothing.
    expect(sentences.length).toBeGreaterThan(15);
    expect(sentences.some(({ text }) => /tier|Gold|Silver|Bronze|Black/i.test(text))).toBe(true);
  });

  /**
   * The exact defect. Copy may promise that earning improves with rank only
   * while some tier actually pays more than the entry tier — so the promise
   * cannot outlive the programme that justified it.
   */
  it('promises a climb only when the ladder has one', () => {
    const climbing = sentences.filter(({ text }) =>
      /more as you (?:move|go) up|rising to|higher tiers?|better rate|as you climb|earn more/i.test(
        text,
      ),
    );

    const entry = [...tiers].sort((a, b) => a.threshold - b.threshold)[0]!;
    const ladderClimbs = tiers.some((tier) => tier.pointsPerRand > entry.pointsPerRand);

    expect({ ladderClimbs, claims: climbing.map((claim) => claim.where) }).toEqual({
      ladderClimbs,
      claims: ladderClimbs ? climbing.map((claim) => claim.where) : [],
    });
  });

  /**
   * A tier named beside the word "unlocks" has to be offering that tier's own
   * perks, and only things that tier actually adds.
   */
  it('lists a tier’s real perks wherever it says one unlocks something', () => {
    const unlocks = sentences.filter(({ text }) => /\bunlocks\b/i.test(text));
    expect(unlocks.length).toBeGreaterThan(0);

    for (const { where, text } of unlocks) {
      const named = tiers.find((tier) => new RegExp(`\\b${tier.name}\\b`).test(text));
      expect({ where, named: named?.name ?? null }).toEqual({
        where,
        named: expect.any(String),
      });

      const missing = named!.perks.filter(
        (perk) => !text.toLowerCase().includes(perk.toLowerCase()),
      );
      expect({ where, missing }).toEqual({ where, missing: [] });
    }
  });

  /**
   * The mirror of the rule above, and the one that made the notification
   * wrong before it was generated: a tier cannot be said to unlock a rate it
   * shares with the tier below it.
   */
  it('never offers an earn rate the member already has', () => {
    const current = tierNamed(loyaltyAccount.tierName);
    const next = nextTierOf(loyaltyAccount);
    if (!next || next.pointsPerRand > current.pointsPerRand) return;

    const offers = sentences.filter(
      ({ text }) => /\bunlocks\b/i.test(text) && /points? per R\d/i.test(text),
    );
    expect(offers.map((offer) => offer.where)).toEqual([]);
  });

  it('quotes the gap to the next tier that the ladder computes', () => {
    const next = nextTierOf(loyaltyAccount);
    const nudges = sentences.filter(({ text }) => /points? (?:from|to)\s+[A-Z]/.test(text));
    expect(nudges.length).toBeGreaterThan(0);

    for (const { where, text } of nudges) {
      const quoted = Number(
        /([\d\s  ]+?)\s*points?\s+(?:from|to)/i.exec(text)?.[1]?.replace(/\D/g, ''),
      );
      expect({ where, quoted }).toEqual({ where, quoted: loyaltyAccount.pointsToNextTier });
      expect(text).toContain(next!.name);
    }
  });
});

describe('writing the programme’s rate as a sentence', () => {
  it('says only what is paid when every tier pays the same', () => {
    const flat = tiers.map((tier) => ({ ...tier, pointsPerRand: 1 }));
    expect(programmeEarnRateLine(flat)).toBe('You earn 1 point per R1 spent on food');
  });

  it('names the climb and where it tops out when tiers differ', () => {
    const climbing = tiers.map((tier, index) => ({ ...tier, pointsPerRand: 1 + index * 0.5 }));
    expect(programmeEarnRateLine(climbing)).toBe(
      'You earn 1 point per R1 spent on food, rising to 2.5 points per R1 spent at Black',
    );
  });

  it('reads the ladder in threshold order, not array order', () => {
    // The entry rate is the lowest tier's, whatever order the ladder is
    // written in — a ladder is a sorted thing that happens to be stored as a
    // list.
    const shuffled = [...tiers].reverse().map((tier, index) => ({
      ...tier,
      pointsPerRand: index === 0 ? 9 : 1,
    }));
    const entry = [...shuffled].sort((a, b) => a.threshold - b.threshold)[0]!;
    expect(programmeEarnRateLine(shuffled)).toContain(
      `You earn ${earnRateLine(entry.pointsPerRand)}`,
    );
  });
});

describe('listing things in a sentence', () => {
  it('joins with "and", South African style, without a serial comma', () => {
    expect(listSentence(['a'])).toBe('a');
    expect(listSentence(['a', 'b'])).toBe('a and b');
    expect(listSentence(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('is empty for an empty list rather than stranding an "and"', () => {
    expect(listSentence([])).toBe('');
  });
});
