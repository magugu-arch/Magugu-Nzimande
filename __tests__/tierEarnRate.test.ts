import { earnRateLine, perksFor, tiers } from '@/services/data/rewardsData';
import { businessRules } from '@/constants/config';
import { randToPoints } from '@/utils/money';

/**
 * What a tier advertises against what the app pays.
 *
 * These two were independent for the life of the app. `tiers` advertised the
 * earn rate as hand-typed copy — Silver "1.25 points per R1 spent", Gold
 * "1.5", Black "2" — while `randToPoints` paid a flat 1 to everybody from
 * `businessRules.pointsPerRand`. A Silver member read a promise on the rewards
 * screen that no code anywhere kept, and nothing could catch it: a string and
 * a constant have no way to disagree.
 *
 * The fix was structural rather than numeric. The rate is a number on the
 * tier, the sentence is written from that number, and these hold the two
 * together. The numbers themselves are still bb.q's to set — all four are 1
 * today, which is what the app actually pays.
 */
describe('the advertised earn rate is the paid earn rate', () => {
  it.each(tiers)('$name advertises exactly what it pays', (tier) => {
    const advertised = perksFor(tier)[0];
    const paidOnR100 = randToPoints(100, tier.pointsPerRand);

    expect(advertised).toBe(earnRateLine(tier.pointsPerRand));
    // The sentence is not merely consistent with itself — the rate inside it
    // is the multiplier the earn calculation actually uses.
    expect(paidOnR100).toBe(Math.floor(100 * tier.pointsPerRand));
  });

  it('never hand-writes an earn rate in a tier’s own perk list', () => {
    // The whole failure mode in one assertion: a rate typed as copy alongside
    // a rate held as a number is a rate that will drift.
    const handWritten = tiers
      .flatMap((tier) => tier.perks.map((perk) => `${tier.name}: ${perk}`))
      .filter((entry) => /points? per R\d/i.test(entry));

    expect(handWritten).toEqual([]);
  });

  it('puts the earn rate first, where a member looks for it', () => {
    for (const tier of tiers) {
      expect(perksFor(tier)).toHaveLength(tier.perks.length + 1);
      expect(perksFor(tier)[0]).toContain('per R1 spent');
    }
  });
});

describe('writing a rate as a sentence', () => {
  it('says "point" for one and "points" for anything else', () => {
    expect(earnRateLine(1)).toBe('1 point per R1 spent');
    expect(earnRateLine(1.25)).toBe('1.25 points per R1 spent');
    expect(earnRateLine(2)).toBe('2 points per R1 spent');
  });

  it('prints a decimal rate as typed, not as float noise', () => {
    // 1.25 * 3 is 3.7500000000000004 in IEEE 754, and a perk line reading
    // "3.7500000000000004 points per R1 spent" is the kind of thing that ships.
    expect(earnRateLine(1.25 * 3)).toBe('3.75 points per R1 spent');
  });
});

describe('the earn calculation', () => {
  it('falls back to the business rule when no tier is known', () => {
    // A basket is priced before anyone signs in. A guest has no tier, and
    // quoting them nothing would be worse than quoting them the base rate.
    expect(randToPoints(287)).toBe(Math.floor(287 * businessRules.pointsPerRand));
  });

  it('uses the tier rate when one is given', () => {
    expect(randToPoints(100, 1.5)).toBe(150);
    expect(randToPoints(100, 2)).toBe(200);
  });

  it('still floors, so a member is never quoted a point they do not get', () => {
    expect(randToPoints(287.9, 1)).toBe(287);
    expect(randToPoints(99, 1.25)).toBe(123); // 123.75 floors to 123
  });
});
