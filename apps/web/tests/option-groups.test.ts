import { PRODUCTS, SAUCES, optionGroupsFor } from '@bbq/seed';
import { OptionGroupSchema } from '@bbq/types';
import { describe, expect, it } from 'vitest';
import { defaultSelection, unitPriceFor } from '@/lib/cart';
import { aProductIn, halfAndHalf } from './fixtures';

/**
 * What a customer is asked to choose, per category.
 *
 * The groups are generated rather than written per product, so a category gets
 * its options from one branch and a mistake there is a mistake on every item in
 * it at once. None of that branching was tested.
 */

const keysFor = (slug: string) => {
  const product = PRODUCTS.find((candidate) => candidate.slug === slug);
  if (!product) throw new Error(`no product ${slug}`);
  return optionGroupsFor(product).map((group) => group.key);
};

describe('every product', () => {
  it('gets groups that parse as option groups', () => {
    for (const product of PRODUCTS) {
      for (const group of optionGroupsFor(product)) {
        expect(() => OptionGroupSchema.parse(group), `${product.slug}/${group.key}`).not.toThrow();
      }
    }
  });

  it('can be added to it', () => {
    for (const product of PRODUCTS) {
      expect(keysFor(product.slug), product.slug).toContain('extras');
    }
  });

  it('has a default index that points at a choice that exists', () => {
    for (const product of PRODUCTS) {
      for (const group of optionGroupsFor(product)) {
        expect(group.choices[group.defaultIndex], `${product.slug}/${group.key}`).toBeDefined();
      }
    }
  });

  it('never offers the same group key twice', () => {
    for (const product of PRODUCTS) {
      const keys = keysFor(product.slug);
      expect(new Set(keys).size, product.slug).toBe(keys.length);
    }
  });

  it('opens on a selection that is already valid', () => {
    for (const product of PRODUCTS) {
      const groups = optionGroupsFor(product);
      const selection = defaultSelection(groups);

      // A single group must open with exactly one choice made, or the price
      // shown before the customer touches anything is not a price they can buy.
      for (const group of groups.filter((candidate) => !candidate.multi)) {
        expect(selection[group.key], `${product.slug}/${group.key}`).toHaveLength(1);
      }
    }
  });
});

describe('chicken', () => {
  it('is sized rather than sauced, because the sauce is the product', () => {
    const keys = keysFor(aProductIn('Chicken').slug);
    expect(keys).toContain('size');
    expect(keys).not.toContain('sauce');
  });

  it('takes R70 off for a half bird', () => {
    const product = aProductIn('Chicken');
    const groups = optionGroupsFor(product);
    const half = unitPriceFor(product.priceCents, groups, {
      ...defaultSelection(groups),
      size: ['Half bird'],
    });

    expect(product.priceCents - half).toBe(7_000);
  });
});

describe('half and half', () => {
  const groups = optionGroupsFor(halfAndHalf());
  const keys = groups.map((group) => group.key);

  it('asks for two sauces, and they are separate groups', () => {
    expect(keys).toContain('sauceA');
    expect(keys).toContain('sauceB');
  });

  it('opens on two different sauces rather than the same one twice', () => {
    const selection = defaultSelection(groups);
    expect(selection.sauceA?.[0]).not.toBe(selection.sauceB?.[0]);
  });

  /**
   * The sauce list feeds these two groups and nothing else, so a sauce added
   * to the menu reaches the customer here or nowhere.
   */
  it('offers every sauce on the menu, in both halves', () => {
    const names = SAUCES.map((sauce) => sauce.name);
    for (const key of ['sauceA', 'sauceB']) {
      const group = groups.find((candidate) => candidate.key === key);
      expect(group?.choices.map((choice) => choice.label), key).toEqual(names);
    }
  });

  it('charges nothing extra for either sauce, whichever two are chosen', () => {
    const product = halfAndHalf();
    for (const sauce of SAUCES) {
      const price = unitPriceFor(product.priceCents, groups, {
        ...defaultSelection(groups),
        sauceA: [sauce.name],
      });
      expect([sauce.name, price]).toEqual([sauce.name, product.priceCents]);
    }
  });

  it('is the only product that asks the customer to pick a sauce', () => {
    const others = PRODUCTS.filter((product) => product.slug !== 'half-half');
    for (const product of others) {
      expect(keysFor(product.slug), product.slug).not.toContain('sauceA');
    }
  });
});

describe('wings', () => {
  const keys = keysFor(aProductIn('Wings').slug);

  it('asks for a portion and how the sauce is served', () => {
    expect(keys).toContain('portion');
    expect(keys).toContain('sauce');
  });

  it('charges for the larger portion and nothing for the sauce choice', () => {
    const product = aProductIn('Wings');
    const groups = optionGroupsFor(product);
    const base = defaultSelection(groups);

    expect(unitPriceFor(product.priceCents, groups, { ...base, portion: ['20 pieces'] })).toBe(
      product.priceCents + 9_000,
    );
    expect(
      unitPriceFor(product.priceCents, groups, { ...base, sauce: ['Tossed to order'] }),
    ).toBe(product.priceCents);
  });
});

describe('meals and sides', () => {
  it('asks a meal which drink, at no extra cost', () => {
    const product = aProductIn('Meals');
    const groups = optionGroupsFor(product);
    expect(groups.map((group) => group.key)).toContain('drink');

    for (const choice of groups.find((group) => group.key === 'drink')?.choices ?? []) {
      expect([choice.label, choice.deltaCents]).toEqual([choice.label, 0]);
    }
  });

  it('asks a side what size, and charges for the larger one', () => {
    const product = aProductIn('Sides');
    const groups = optionGroupsFor(product);
    const base = defaultSelection(groups);

    expect(unitPriceFor(product.priceCents, groups, { ...base, size: ['Large'] })).toBe(
      product.priceCents + 2_000,
    );
  });

  it('does not ask a side for a drink, or a meal for a size', () => {
    expect(keysFor(aProductIn('Sides').slug)).not.toContain('drink');
    expect(keysFor(aProductIn('Meals').slug)).not.toContain('size');
  });
});

describe('the kids menu', () => {
  const kids = aProductIn('Kids');
  const keys = keysFor(kids.slug);

  it('is sold as a whole box, so the only choice is the drink', () => {
    expect(keys).toContain('drink');
    expect(keys).not.toContain('size');
    expect(keys).not.toContain('portion');
    expect(keys).not.toContain('sauceA');
  });

  it('charges nothing for the drink, because it is in the meal', () => {
    const groups = optionGroupsFor(kids);
    const drinks = groups.find((group) => group.key === 'drink')?.choices ?? [];

    expect(drinks.length).toBeGreaterThan(0);
    for (const choice of drinks) {
      expect([choice.label, choice.deltaCents]).toEqual([choice.label, 0]);
    }
  });

  it('offers the same drinks as the grown-up meals rather than a second list', () => {
    const mealDrinks = optionGroupsFor(aProductIn('Meals'))
      .find((group) => group.key === 'drink')
      ?.choices.map((choice) => choice.label);
    const kidsDrinks = optionGroupsFor(kids)
      .find((group) => group.key === 'drink')
      ?.choices.map((choice) => choice.label);

    expect(kidsDrinks).toEqual(mealDrinks);
  });

  /** Every kids item is a complete meal, so none of them is a fiery one. */
  it('keeps every kids item mild', () => {
    for (const product of PRODUCTS.filter((candidate) => candidate.category === 'Kids')) {
      expect([product.slug, product.heat <= 1]).toEqual([product.slug, true]);
    }
  });
});

describe('the extras every product carries', () => {
  const extras = optionGroupsFor(aProductIn('Sides')).find((group) => group.key === 'extras');

  it('takes more than one at a time', () => {
    expect(extras?.multi).toBe(true);
  });

  it('opens empty, so nothing is added without being asked for', () => {
    const groups = optionGroupsFor(aProductIn('Sides'));
    expect(defaultSelection(groups).extras).toEqual([]);
  });

  it('charges for every extra chosen, not just the first', () => {
    const product = aProductIn('Sides');
    const groups = optionGroupsFor(product);
    const labels = (extras?.choices ?? []).map((choice) => choice.label);
    const total = (extras?.choices ?? []).reduce((sum, choice) => sum + choice.deltaCents, 0);

    expect(
      unitPriceFor(product.priceCents, groups, {
        ...defaultSelection(groups),
        extras: labels,
      }),
    ).toBe(product.priceCents + total);
  });
});
