import { businessRules } from '@/constants/config';
import { promotions, vouchers } from '@/services/data/rewardsData';
import { supportTopics } from '@/services/data/accountData';

/**
 * Numbers a customer reads in a sentence, against the numbers the app charges.
 *
 * `businessRules` is the single place the delivery fee, the free-delivery
 * threshold and the minimum order are set, and `calculateTotals` is the single
 * place they are applied. That was true and still left the same numbers written
 * out in prose in two more places:
 *
 *     promotions        "Free delivery over R350"
 *     support topics    "Delivery is R32 … free on orders over R350"
 *
 * They agree today by coincidence rather than by construction. Change
 * `deliveryFee` to 35 for the real branches and the help answer — the one place
 * a customer goes to find out what delivery costs — quietly starts lying,
 * with nothing to notice.
 *
 * Copy cannot be templated off a constant here, because against a real backend
 * both of these are server data. So this checks the seed the app ships with,
 * and `audit:launch` carries the half that only the backend can keep: whoever
 * sets the real numbers has to change the constants, this copy, and whatever
 * the API serves.
 */
const quoted = (text: string): number[] =>
  [...text.matchAll(/R\s?(\d[\d\s]*)/g)].map((match) =>
    Number((match[1] ?? '').replace(/\s/g, '')),
  );

/**
 * What a sentence is allowed to say besides the business rules, because the
 * number is its own.
 *
 * A promotion built around a code is going to quote that code's worth — "Soy
 * Garlic, R30 off" is the whole offer — and R30 sits inside the near-miss band
 * around the R32 delivery fee. Without this the guard reads a promotion
 * correctly describing its own voucher as a stale copy of a rule it has nothing
 * to do with, which is the shape of false alarm that gets a guard deleted.
 *
 * Read off the voucher rather than listed here, so a repriced voucher does not
 * need this file edited. The docstring below has always promised this — "nor a
 * price of its own — a voucher's own minimum spend, say" — and the code did not
 * do it, because no seeded promotion had ever quoted one.
 */
const ownFigures = (promoCode: string | undefined): number[] => {
  const voucher = vouchers.find((candidate) => candidate.code === promoCode);
  return voucher ? [voucher.discountValue, voucher.minimumSpend] : [];
};

/** Every seeded sentence a customer could read, with where it came from. */
const sentences: { where: string; text: string; own: number[] }[] = [
  ...promotions.flatMap((promotion) => [
    {
      where: `promotion ${promotion.id} headline`,
      text: promotion.headline,
      own: ownFigures(promotion.promoCode),
    },
    {
      where: `promotion ${promotion.id} description`,
      text: promotion.description,
      own: ownFigures(promotion.promoCode),
    },
  ]),
  ...supportTopics.map((topic) => ({
    where: `support ${topic.id}`,
    text: topic.answer,
    own: [] as number[],
  })),
];

describe('the numbers written into seeded copy', () => {
  it('found sentences to check, rather than passing on an empty list', () => {
    // The failure mode this whole file exists to avoid is a check that stopped
    // reading anything and kept reporting green.
    expect(sentences.length).toBeGreaterThan(10);
    expect(sentences.filter((sentence) => quoted(sentence.text).length > 0).length).toBeGreaterThan(
      2,
    );
  });

  it('quotes the free-delivery threshold the app actually applies', () => {
    const claims = sentences.filter(({ text }) =>
      /free.{0,30}(?:over|above)\s*R|(?:over|above)\s*R\s?\d[\d\s]*.{0,30}free/i.test(text),
    );
    expect(claims.length).toBeGreaterThan(0);

    for (const claim of claims) {
      expect({ where: claim.where, quoted: quoted(claim.text) }).toEqual({
        where: claim.where,
        quoted: expect.arrayContaining([businessRules.freeDeliveryThreshold]),
      });
    }
  });

  it('quotes the delivery fee the app actually charges', () => {
    const claims = sentences.filter(({ text }) => /delivery is R\s?\d/i.test(text));
    expect(claims.length).toBeGreaterThan(0);

    for (const claim of claims) {
      expect({ where: claim.where, quoted: quoted(claim.text) }).toEqual({
        where: claim.where,
        quoted: expect.arrayContaining([businessRules.deliveryFee]),
      });
    }
  });

  /**
   * Nothing may quote a rand figure that is neither one of the commercial
   * constants nor a price of its own — a voucher's own minimum spend, say.
   *
   * Loose on purpose: this is not trying to police every number in a sentence,
   * only to catch a stale copy of one the app enforces. A figure close to a
   * business rule but not equal to it is the shape a stale number takes.
   */
  it('does not quote a near-miss of a rule the app enforces', () => {
    const rules: number[] = [
      businessRules.deliveryFee,
      businessRules.freeDeliveryThreshold,
      businessRules.minimumDeliverySubtotal,
      businessRules.serviceFee,
    ];

    const suspicious: string[] = [];
    for (const { where, text, own } of sentences) {
      for (const value of quoted(text)) {
        if (rules.includes(value)) continue;
        // A promotion quoting the worth of its own code is not a stale rule.
        if (own.includes(value)) continue;
        const near = rules.find((rule) => Math.abs(rule - value) <= Math.max(2, rule * 0.05));
        if (near !== undefined) suspicious.push(`${where}: R${value}, where the app uses R${near}`);
      }
    }

    expect(suspicious).toEqual([]);
  });
});
