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

const line = (unitCents: number, quantity = 1) => ({ unitCents, quantity });

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
  it('is nothing without a code', () => {
    expect(discountOf(20_000, null)).toBe(0);
  });

  it('ignores an unknown code rather than guessing a rate', () => {
    expect(discountOf(20_000, 'NOTACODE')).toBe(0);
  });

  it('accepts a code whatever case it was typed in', () => {
    expect(discountOf(20_000, 'picktwo')).toBe(discountOf(20_000, 'PICKTWO'));
  });

  it('rounds to a whole cent so the basket and the receipt agree', () => {
    // 13 900 at 15% is 2 085 exactly; 13 901 is 2 085.15, which must not
    // survive as a fraction of a cent into the total.
    expect(discountOf(13_900, 'PICKTWO')).toBe(2_085);
    expect(discountOf(13_901, 'PICKTWO')).toBe(2_085);
    expect(Number.isInteger(discountOf(13_907, 'PICKTWO'))).toBe(true);
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
    const totals = totalsFor([line(justOver)], 'Delivery', 'PICKTWO');
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
    const totals = totalsFor([line(21_533, 3)], 'Delivery', 'ONETRAY');
    for (const amount of Object.values(totals)) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it('matches the worked example the journey produces', () => {
    // Honey Garlic at R209, half bird less R70, delivered, with PICKTWO.
    const totals = totalsFor([line(20_900 - 7_000)], 'Delivery', 'PICKTWO');
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
