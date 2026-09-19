import { businessRules } from '@/constants/config';
import { promotions } from '@/services/data/rewardsData';
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

/** Every seeded sentence a customer could read, with where it came from. */
const sentences: { where: string; text: string }[] = [
  ...promotions.flatMap((promotion) => [
    { where: `promotion ${promotion.id} headline`, text: promotion.headline },
    { where: `promotion ${promotion.id} description`, text: promotion.description },
  ]),
  ...supportTopics.map((topic) => ({ where: `support ${topic.id}`, text: topic.answer })),
];

describe('the numbers written into seeded copy', () => {
  it('found sentences to check, rather than passing on an empty list', () => {
    // The failure mode this whole file exists to avoid is a check that stopped
    // reading anything and kept reporting green. The sentence list must be
    // real even when none of them quotes money.
    expect(sentences.length).toBeGreaterThan(10);
  });

  /**
   * The Pappas seed quotes no rand amount anywhere, and that is the point.
   *
   * §15 forbids inventing prices, and a campaign reading "Free delivery over
   * R350" invents two of them — a threshold and a delivery fee — in a
   * sentence a customer will believe. So every seeded campaign is editorial
   * rather than promotional, and there is nothing here to disagree with
   * `businessRules`.
   *
   * The consistency checks below are kept and still run: the moment somebody
   * writes a rand figure into a campaign or a help answer, they start
   * comparing it against the constants the app actually charges. This test is
   * what tells you which state you are in.
   */
  it('quotes no money at all, because none has been supplied', () => {
    const quoting = sentences
      .filter((sentence) => quoted(sentence.text).length > 0)
      .map((sentence) => sentence.where);

    expect(quoting).toEqual([]);
  });

  it('quotes the free-delivery threshold the app actually applies', () => {
    const claims = sentences.filter(({ text }) =>
      /free.{0,30}(?:over|above)\s*R|(?:over|above)\s*R\s?\d[\d\s]*.{0,30}free/i.test(text),
    );
    // No existence guard. There are no such claims in the Pappas seed and
    // there should not be — `quotes no money at all` above is what makes sure
    // this loop is empty for the right reason rather than because the regex
    // rotted. The loop is here for the day a real threshold is published.

    for (const claim of claims) {
      expect({ where: claim.where, quoted: quoted(claim.text) }).toEqual({
        where: claim.where,
        quoted: expect.arrayContaining([businessRules.freeDeliveryThreshold]),
      });
    }
  });

  it('quotes the delivery fee the app actually charges', () => {
    const claims = sentences.filter(({ text }) => /delivery is R\s?\d/i.test(text));
    // Same as above: empty today, and held empty by `quotes no money at all`.

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
    for (const { where, text } of sentences) {
      for (const value of quoted(text)) {
        if (rules.includes(value)) continue;
        const near = rules.find((rule) => Math.abs(rule - value) <= Math.max(2, rule * 0.05));
        if (near !== undefined) suspicious.push(`${where}: R${value}, where the app uses R${near}`);
      }
    }

    expect(suspicious).toEqual([]);
  });
});
