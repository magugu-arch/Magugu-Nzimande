import { cardHasExpired, expiryLabel, methodHasExpired } from '@/features/checkout/cardExpiry';
import {
  STANDING_RAILS,
  offeredPaymentMethods,
  paymentCaption,
} from '@/features/checkout/paymentOptions';
import { savedPaymentMethods } from '@/services/data/accountData';
import type { PaymentMethod } from '@/types';

/**
 * A saved card that has run out.
 *
 * `expiry` has been on `PaymentMethod` since the type was written and printed
 * on two screens as "Expires 03/27". Nothing ever compared it to the clock,
 * and both seeded cards expired years from now — so the app had never held a
 * card it could not pay with, and an expired one was offered at checkout as an
 * ordinary option. The customer would learn it was dead from the gateway,
 * after committing, at the one point in the journey where a failure costs the
 * most.
 *
 * Found by adding the third card every real wallet eventually contains.
 */
const card = (expiry: string | undefined, id = 'c1'): PaymentMethod => ({
  id,
  type: 'card',
  label: 'Visa ending 1194',
  expiry,
  isDefault: false,
});

describe('reading a card’s expiry', () => {
  /**
   * The detail most implementations get wrong: a card marked 03/24 works all
   * the way through March, not up to the 1st. Comparing against the month
   * itself would kill a working card up to thirty days early.
   */
  it('keeps a card alive through the whole of its final month', () => {
    expect(cardHasExpired('03/24', new Date(2024, 2, 1))).toBe(false);
    expect(cardHasExpired('03/24', new Date(2024, 2, 31, 23, 59))).toBe(false);
    expect(cardHasExpired('03/24', new Date(2024, 3, 1))).toBe(true);
  });

  it('reads two digits as this century, and four as written', () => {
    expect(cardHasExpired('03/27', new Date(2026, 8, 2))).toBe(false);
    expect(cardHasExpired('03/2027', new Date(2026, 8, 2))).toBe(false);
    // Not read as the year 27.
    expect(cardHasExpired('03/2027', new Date(2028, 0, 1))).toBe(true);
  });

  /**
   * The safe direction. A card whose expiry the app cannot parse is a card the
   * app knows nothing about, and refusing somebody's payment over a string
   * format nobody anticipated is worse than letting the gateway decide.
   */
  it('never calls a card expired because it could not read the date', () => {
    for (const nonsense of ['', 'soon', '13/24', '0/24', '2024-03', '03-24', '//']) {
      expect(cardHasExpired(nonsense, new Date(2030, 0, 1))).toBe(false);
    }
  });

  it('treats an absent expiry as no opinion, so rails are never filtered', () => {
    expect(cardHasExpired(undefined, new Date(2030, 0, 1))).toBe(false);
    const snapscan: PaymentMethod = {
      id: 'rail-snapscan',
      type: 'snapscan',
      label: 'SnapScan',
      isDefault: false,
    };
    expect(methodHasExpired(snapscan, new Date(2030, 0, 1))).toBe(false);
  });

  it('tolerates the spacing a backend might send', () => {
    expect(cardHasExpired(' 3 / 24 ', new Date(2024, 3, 1))).toBe(true);
  });
});

describe('what checkout offers', () => {
  const now = new Date(2026, 8, 2);

  it('does not offer a card that has run out', () => {
    const offered = offeredPaymentMethods(savedPaymentMethods, 'delivery', now);
    expect(offered.map((method) => method.id)).not.toContain('payment-visa-expired');
  });

  it('still offers the cards that work', () => {
    const offered = offeredPaymentMethods(savedPaymentMethods, 'delivery', now);
    expect(offered.map((method) => method.id)).toContain('payment-visa');
    expect(offered.map((method) => method.id)).toContain('payment-mastercard');
  });

  /**
   * The case the merge logic exists for, now reachable a second way. A
   * customer whose only card has expired has, as far as this order is
   * concerned, no card — and must still be able to pay by another rail rather
   * than be shown an empty Payment section.
   */
  it('offers the standing rails when every saved card has expired', () => {
    const offered = offeredPaymentMethods([card('03/24')], 'delivery', now);

    expect(offered.some((method) => method.type === 'card')).toBe(false);
    expect(offered.map((method) => method.type)).toEqual(
      expect.arrayContaining(['snapscan', 'eft', 'cash']),
    );
  });

  it('is not fooled into hiding a rail because an expired card shared its type', () => {
    // `seen` must be computed from surviving cards. Built from the raw list, an
    // expired card would suppress nothing here — but the same mistake with a
    // rail-typed saved method would remove a way to pay.
    const offered = offeredPaymentMethods([card('03/24'), card('09/28', 'c2')], 'delivery', now);
    expect(offered.map((method) => method.id)).toEqual([
      'c2',
      'rail-snapscan',
      'rail-eft',
      'rail-cash',
    ]);
  });
});

describe('what the account screen says', () => {
  it('says "Expired" rather than "Expires" once it has run out', () => {
    const now = new Date(2026, 8, 2);
    expect(expiryLabel(card('03/24'), now)).toBe('Expired 03/24');
    expect(expiryLabel(card('09/28'), now)).toBe('Expires 09/28');
  });

  it('says nothing at all for a rail that has no expiry', () => {
    expect(expiryLabel(card(undefined))).toBeNull();
  });
});

/**
 * The second line under a payment row.
 *
 * Found in a browser, not here: checkout drew "SnapScan" over "SnapScan" for
 * all three rails, because a rail's label and its description are the same
 * sentence. Both strings were exactly what their own tests expected, so
 * nothing failed — the defect only exists where the two are rendered together.
 */
describe('what the caption under a payment row says', () => {
  const now = new Date(2026, 8, 2);

  it('says nothing when the description would repeat the label', () => {
    for (const rail of STANDING_RAILS) {
      expect(paymentCaption(rail, now)).toBeNull();
    }
  });

  it('still explains a saved card that carries no expiry', () => {
    const cardWithoutExpiry: PaymentMethod = {
      id: 'tokenised',
      type: 'card',
      label: 'Visa ending 1194',
      isDefault: false,
    };
    expect(paymentCaption(cardWithoutExpiry, now)).toBe('Credit or debit card');
  });

  it('prefers the expiry, and says which kind of expiry it is', () => {
    expect(paymentCaption(card('09/28'), now)).toBe('Expires 09/28');
    expect(paymentCaption(card('03/24'), now)).toBe('Expired 03/24');
  });
});

describe('the fixture that found it', () => {
  it('seeds a card that has actually run out', () => {
    const expired = savedPaymentMethods.filter((method) =>
      methodHasExpired(method, new Date(2026, 8, 2)),
    );
    expect(expired.map((method) => method.id)).toEqual(['payment-visa-expired']);
  });

  it('never makes an expired card the default', () => {
    // A default the customer cannot pay with is worse than no default.
    const expiredDefaults = savedPaymentMethods.filter(
      (method) => method.isDefault && methodHasExpired(method, new Date(2026, 8, 2)),
    );
    expect(expiredDefaults).toEqual([]);
  });
});
