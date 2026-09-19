import { isAwaitingPrice, lineTotalLabel, priceLabel } from '@/features/menu/price';
import { matchProducts } from '@/features/menu/search';
import { products } from '@/services/data/menuData';
import { POPULAR_SEARCH_TERMS } from '@/services/menuService';
import { PRICE_UNAVAILABLE, formatPrice } from '@/utils/money';

/**
 * What the app prints where a price should be.
 *
 * §15 forbids inventing menu prices and Pappas has supplied none, so every
 * dish carries `basePrice: 0` with `priceStatus: 'awaiting-business-input'`.
 * The data said "unknown" and all three screens printed **R 0.00** — the menu
 * row, the product page and the Add to cart button — because each called
 * `formatPrice` on the raw number.
 *
 * That is not a cosmetic slip. R 0.00 is a stated price, and the price it
 * states is free: `utils/money` had already written down the reason it
 * matters — "a dash is noticed and reported, free chicken is noticed and
 * ordered" — and exported `PRICE_UNAVAILABLE` for exactly this. Nothing
 * called it. The flag and the constant both existed and the wire between them
 * was never run, which is the kind of gap a unit test of either half passes
 * happily.
 */
describe('a dish nobody has priced', () => {
  const unpriced = { priceStatus: 'awaiting-business-input' as const, basePrice: 0 };
  const priced = { priceStatus: 'confirmed' as const, basePrice: 129.9 };

  it('prints a dash, never a rand amount', () => {
    expect(priceLabel(unpriced)).toBe(PRICE_UNAVAILABLE);
    expect(priceLabel(unpriced)).not.toMatch(/\d/);
  });

  it('quotes no total on the Add to cart button', () => {
    expect(lineTotalLabel(unpriced, 0)).toBeUndefined();
    // Even if a line total were somehow computed, it is not a price to show.
    expect(lineTotalLabel(unpriced, 259.8)).toBeUndefined();
  });

  it('leaves a confirmed price completely alone', () => {
    expect(priceLabel(priced)).toBe(formatPrice(129.9));
    expect(lineTotalLabel(priced, 259.8)).toBe(formatPrice(259.8));
  });

  /**
   * The distinction the helper exists to keep. A waived delivery fee, a fully
   * discounted total and a complimentary side are all genuinely R0, and
   * teaching `formatPrice` to treat every zero as unknown would break them.
   */
  it('still prints R 0.00 for a price that is genuinely zero', () => {
    expect(priceLabel({ priceStatus: 'confirmed', basePrice: 0 })).toBe(formatPrice(0));
    expect(formatPrice(0)).toMatch(/0\.00/);
  });

  it('says so about the catalogue as it actually ships', () => {
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      if (!isAwaitingPrice(product)) continue;
      expect({ dish: product.id, shown: priceLabel(product) }).toEqual({
        dish: product.id,
        shown: PRICE_UNAVAILABLE,
      });
    }
  });
});

/**
 * The search suggestions, against the menu they suggest searching.
 *
 * These shipped as "Honey Garlic, Wings, Boneless, Cheesling Fries, Spicy,
 * Rice bowl" — the vocabulary of the chicken shop this app was built from,
 * offered on a Greek and Mediterranean menu where not one of the six returns
 * a dish. A suggestion chip that finds nothing is worse than no chip: it
 * teaches a customer on their first try that search does not work.
 *
 * Asserted against the real catalogue rather than a list kept in step by
 * hand, so renaming a dish out from under a suggestion fails here.
 */
describe('every search suggestion finds something', () => {
  it.each(POPULAR_SEARCH_TERMS)('%s returns at least one dish', (term) => {
    expect({ term, hits: matchProducts(products, term).length > 0 }).toEqual({
      term,
      hits: true,
    });
  });

  it('offers no term that belongs to a different restaurant', () => {
    const foreign = /honey garlic|wings|boneless|cheesling|rice bowl|burger|nugget/i;
    for (const term of POPULAR_SEARCH_TERMS) {
      expect({ term, foreign: foreign.test(term) }).toEqual({ term, foreign: false });
    }
  });
});
