import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ProductOption } from '@/types';
import { menuSnapshot } from '@/services/data/menuData';
import { optionLabel } from '@/features/menu/optionLabel';

/**
 * What a screen reader is told on the screen where every order is configured.
 *
 * The label was `${option.name}, ${formatPriceDelta(option.priceDelta)}` — two
 * fields concatenated, three others dropped, and the first one wrong.
 */
const option = (over: Partial<ProductOption> = {}): ProductOption =>
  ({
    id: 'opt',
    name: 'Small · 6 pieces',
    priceDelta: 0,
    available: true,
    ...over,
  }) as ProductOption;

describe('the price a zero delta announced', () => {
  /**
   * `formatPriceDelta(0)` is the string `'Free'`, and the visible row withholds
   * the delta entirely when it is zero. So a sighted customer saw "Small · 6
   * pieces" and a screen-reader user heard "Small · 6 pieces, Free" — about a
   * size of a R149 box.
   */
  it('says nothing about price, because the screen says nothing either', () => {
    expect(optionLabel(option())).toBe('Small · 6 pieces');
    expect(optionLabel(option())).not.toMatch(/free/i);
  });

  it('still names a real one', () => {
    expect(optionLabel(option({ name: 'Large', priceDelta: 22 }))).toBe('Large, +R 22.00');
  });

  it('names a discount as a discount', () => {
    // `priceDelta` is documented as "may be negative". Nothing in the seed is
    // yet — see the note in the price-floor block below — but the label must
    // not read as a surcharge if one ever is.
    expect(optionLabel(option({ name: 'No drink', priceDelta: -8 }))).toContain('−R 8.00');
  });
});

describe('what else the label was leaving out', () => {
  it('carries the description the screen draws under the name', () => {
    expect(optionLabel(option({ description: 'Serves 1 – 2' }))).toBe(
      'Small · 6 pieces, Serves 1 – 2',
    );
  });

  /**
   * The withdrawn option is greyed with a "Sold out" caption and marked
   * disabled, which a screen reader renders as "dimmed" — not as a reason. The
   * old label went on quoting its price, so the one option a customer cannot
   * have was announced exactly like an offer.
   */
  it('says when something is sold out, rather than only dimming it', () => {
    const withdrawn = option({ name: 'Sharing bucket', priceDelta: 48, available: false });

    expect(optionLabel(withdrawn)).toBe('Sharing bucket, +R 48.00, Sold out');
  });

  it('reads in the order the eye reads it', () => {
    const full = option({
      name: 'Large',
      description: 'Serves 3 – 4',
      priceDelta: 22,
      available: false,
    });

    expect(optionLabel(full)).toBe('Large, Serves 3 – 4, +R 22.00, Sold out');
  });
});

/**
 * Against the real catalogue, because the defect was a property of the data as
 * much as of the code: twenty-four options carry a zero delta.
 */
describe('the catalogue this runs against', () => {
  const allOptions = menuSnapshot.products.flatMap((product) =>
    product.optionGroups.flatMap((group) => group.options),
  );

  it('has plenty of zero-delta options, or the defect had nothing to bite on', () => {
    const zero = allOptions.filter((entry) => entry.priceDelta === 0);

    expect(zero.length).toBeGreaterThan(20);
  });

  it('never tells anybody a chicken size is free', () => {
    for (const entry of allOptions) {
      if (entry.priceDelta === 0) expect(optionLabel(entry)).not.toMatch(/free/i);
    }
  });

  it('announces every sold-out option as sold out', () => {
    const withdrawn = allOptions.filter((entry) => !entry.available);

    expect(withdrawn.length).toBeGreaterThan(0);
    for (const entry of withdrawn) expect(optionLabel(entry)).toMatch(/Sold out$/);
  });
});

/** Nobody builds one of these out of two fields again. */
describe('the picker asks the helper', () => {
  const source = readFileSync(
    path.join(__dirname, '..', 'src/features/menu/components/OptionGroupPicker.tsx'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  it('takes its label from optionLabel', () => {
    expect(source).toMatch(/accessibilityLabel=\{optionLabel\(option\)\}/);
  });

  it('no longer concatenates the name and the delta by hand', () => {
    expect(source).not.toMatch(/accessibilityLabel=\{`\$\{option\.name\}, \$\{formatPriceDelta/);
  });
});

/**
 * And the claim every menu card makes, which nothing checked.
 *
 * `ProductCard` says "from R149" — a statement about the cheapest
 * configuration a customer can actually reach, not about `basePrice`. The two
 * agree today only because every required group has an option at zero. One
 * required group whose cheapest option costs something and every card in the
 * app quietly understates its own floor.
 *
 * Checked rather than assumed. `priceDelta` is documented as "may be negative"
 * and nothing in the seed is — a discount would break the claim the other way,
 * making the card *overstate* the minimum. No negative delta has been invented
 * here to demonstrate that: what an option is worth in rand is a franchise
 * decision, and `audit:launch` already carries all 28 prices. This is the guard
 * that would catch either direction the day somebody sets one.
 */
describe('the "from" price on a menu card', () => {
  const floorFor = (product: (typeof menuSnapshot.products)[number]) =>
    product.optionGroups.reduce((total, group) => {
      if (group.minSelect < 1) return total;
      const available = group.options.filter((entry) => entry.available);
      if (available.length === 0) return total;
      return total + Math.min(...available.map((entry) => entry.priceDelta)) * group.minSelect;
    }, product.basePrice);

  it('is the cheapest configuration a customer can actually reach', () => {
    for (const product of menuSnapshot.products) {
      expect({ id: product.id, floor: floorFor(product) }).toEqual({
        id: product.id,
        floor: product.basePrice,
      });
    }
  });
});
