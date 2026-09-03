import { FEES } from '@bbq/seed';
import { formatMoney, formatMoneyCompact } from '@bbq/types';
import { describe, expect, it } from 'vitest';
import {
  deliveryFeeOf,
  discountOf,
  pointsFor,
  remainingToFreeDelivery,
  subtotalOf,
  totalsFor,
} from '@/lib/pricing';
import { findPromotion } from '@/lib/promotions';

/**
 * A basket line. The slug matters now: a discount comes off the lines of the
 * product its offer names, not off the whole basket, so a line's identity is
 * part of what is being priced.
 */
const line = (unitCents: number, quantity = 1, slug = 'half-half') => ({
  unitCents,
  quantity,
  slug,
});

/** The offer behind a code, whether or not it is running right now. */
const offer = (code: string) => findPromotion(code);

describe('money formatting', () => {
  it('renders cents as rand, never as a float', () => {
    expect(formatMoney(18_900)).toBe('R189.00');
    expect(formatMoney(0)).toBe('R0.00');
    expect(formatMoney(5)).toBe('R0.05');
  });

  it('groups thousands with a space, as South African currency does', () => {
    expect(formatMoney(123_456)).toBe('R1 234.56');
  });

  it('drops a trailing .00 only in the compact form', () => {
    expect(formatMoneyCompact(18_900)).toBe('R189');
    expect(formatMoneyCompact(18_950)).toBe('R189.50');
  });
});

describe('subtotal', () => {
  it('multiplies each line by its quantity', () => {
    expect(subtotalOf([line(18_900, 2), line(3_900)])).toBe(41_700);
  });

  it('is zero for an empty basket', () => {
    expect(subtotalOf([])).toBe(0);
  });
});

describe('discount', () => {
  it('is nothing without an offer', () => {
    expect(discountOf([line(20_000)], null)).toBe(0);
  });

  it('ignores an unknown code rather than guessing a rate', () => {
    expect(discountOf([line(20_000)], offer('NOTACODE'))).toBe(0);
  });

  it('accepts a code whatever case it was typed in', () => {
    expect(discountOf([line(20_000)], offer('picktwo'))).toBe(
      discountOf([line(20_000)], offer('PICKTWO')),
    );
  });

  it('rounds to a whole cent so the basket and the receipt agree', () => {
    // 13 900 at 15% is 2 085 exactly; 13 901 is 2 085.15, which must not
    // survive as a fraction of a cent into the total.
    expect(discountOf([line(13_900)], offer('PICKTWO'))).toBe(2_085);
    expect(discountOf([line(13_901)], offer('PICKTWO'))).toBe(2_085);
    expect(Number.isInteger(discountOf([line(13_907)], offer('PICKTWO')))).toBe(true);
  });

  /**
   * The bug this signature exists to close. PICKTWO is an offer on the half
   * bird; taking its fifteen percent off the drinks and the sides in the same
   * basket is several times the discount it advertises.
   */
  it('comes off the product the offer names and nothing else', () => {
    const basket = [line(13_900, 1, 'half-half'), line(50_000, 1, 'golden-original')];
    expect(discountOf(basket, offer('PICKTWO'))).toBe(2_085);
  });

  it('is nothing when the basket does not hold the product at all', () => {
    expect(discountOf([line(50_000, 1, 'golden-original')], offer('PICKTWO'))).toBe(0);
  });

  it('counts every line of that product, and its quantity', () => {
    const basket = [line(10_000, 2, 'half-half'), line(10_000, 1, 'half-half')];
    // 30 000 at 15%.
    expect(discountOf(basket, offer('PICKTWO'))).toBe(4_500);
  });
});

describe('delivery fee', () => {
  it('is not charged on collection or dine-in', () => {
    expect(deliveryFeeOf('Collection', 1_000, 1)).toBe(0);
    expect(deliveryFeeOf('Dine-in', 1_000, 1)).toBe(0);
  });

  it('is not charged on an empty basket', () => {
    expect(deliveryFeeOf('Delivery', 0, 0)).toBe(0);
  });

  it('is charged below the threshold and free at or above it', () => {
    const threshold = FEES.freeDeliveryOverCents;
    expect(deliveryFeeOf('Delivery', threshold - 1, 1)).toBe(FEES.deliveryCents);
    expect(deliveryFeeOf('Delivery', threshold, 1)).toBe(0);
    expect(deliveryFeeOf('Delivery', threshold + 1, 1)).toBe(0);
  });

  it('measures the threshold after the discount, not before it', () => {
    // A basket just over the threshold that a promo code pulls back under it
    // pays for delivery, because that is what the customer actually spent.
    const justOver = FEES.freeDeliveryOverCents + 1_000;
    const totals = totalsFor([line(justOver)], 'Delivery', offer('PICKTWO'));
    expect(totals.subtotalCents).toBeGreaterThan(FEES.freeDeliveryOverCents);
    expect(totals.subtotalCents - totals.discountCents).toBeLessThan(
      FEES.freeDeliveryOverCents,
    );
    expect(totals.deliveryCents).toBe(FEES.deliveryCents);
  });
});

describe('totals', () => {
  it('adds up as subtotal minus discount plus delivery', () => {
    const totals = totalsFor([line(20_900), line(-7_000 + 20_900)], 'Delivery', null);
    expect(totals.totalCents).toBe(
      totals.subtotalCents - totals.discountCents + totals.deliveryCents,
    );
  });

  it('holds every amount as a whole number of cents', () => {
    const totals = totalsFor([line(21_533, 3, 'chicken-rice')], 'Delivery', offer('ONETRAY'));
    for (const amount of Object.values(totals)) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it('matches the worked example the journey produces', () => {
    // Honey Garlic at R209, half bird less R70, delivered, with PICKTWO.
    const totals = totalsFor([line(20_900 - 7_000)], 'Delivery', offer('PICKTWO'));
    expect(totals.subtotalCents).toBe(13_900);
    expect(totals.discountCents).toBe(2_085);
    expect(totals.deliveryCents).toBe(2_900);
    expect(totals.totalCents).toBe(14_715);
    expect(formatMoney(totals.totalCents)).toBe('R147.15');
  });
});

describe('free delivery meter', () => {
  it('counts down to the threshold and stops at zero', () => {
    expect(remainingToFreeDelivery(0)).toBe(FEES.freeDeliveryOverCents);
    expect(remainingToFreeDelivery(FEES.freeDeliveryOverCents)).toBe(0);
    expect(remainingToFreeDelivery(FEES.freeDeliveryOverCents + 10_000)).toBe(0);
  });
});

describe('points', () => {
  it('earns one per whole rand and never a fraction', () => {
    expect(pointsFor(18_900)).toBe(189);
    expect(pointsFor(18_999)).toBe(189);
    expect(pointsFor(99)).toBe(0);
  });
});
