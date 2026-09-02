import { optionSelectionProblem } from '@/utils/cart';
import { useCartStore } from '@/store/cartStore';
import type { OptionGroup, Product, SelectedOption } from '@/types';

/**
 * The brief's acceptance criterion: "required modifiers cannot be bypassed."
 *
 * The product screen already gates the button. These are about the other ways
 * a line reaches the basket — reorder, a deep link, anything written later —
 * and about the rule living where the data enters rather than where the picker
 * happens to be.
 */

const sauces: OptionGroup = {
  id: 'sauce',
  name: 'Sauce',
  kind: 'flavour',
  minSelect: 1,
  maxSelect: 1,
  defaultOptionIds: ['soy-garlic'],
  options: [
    { id: 'soy-garlic', name: 'Soy Garlic', priceDelta: 0, available: true },
    { id: 'hot', name: 'Hot', priceDelta: 0, available: true },
    { id: 'discontinued', name: 'Retired Sauce', priceDelta: 0, available: false },
  ],
};

const extras: OptionGroup = {
  id: 'extras',
  name: 'Extras',
  kind: 'addon',
  minSelect: 0,
  maxSelect: 2,
  defaultOptionIds: [],
  options: [
    { id: 'cheese', name: 'Cheese', priceDelta: 15, available: true },
    { id: 'radish', name: 'Radish', priceDelta: 15, available: true },
    { id: 'slaw', name: 'Slaw', priceDelta: 20, available: true },
  ],
};

const product = {
  id: 'p-wings',
  slug: 'wings',
  name: 'Wings',
  shortDescription: 'Wings',
  description: 'Wings',
  basePrice: 129,
  categoryId: 'chicken',
  assetKey: 'wings',
  spiceLevel: 1,
  tags: [],
  optionGroups: [sauces, extras],
  recommendedProductIds: [],
  available: true,
  preparationMinutes: 15,
  serves: '1',
  allergens: [],
} as unknown as Product;

const pick = (groupId: string, optionId: string, optionName = optionId): SelectedOption => ({
  groupId,
  groupName: groupId,
  optionId,
  optionName,
  priceDelta: 0,
});

describe('what makes a configuration illegal', () => {
  it('accepts a configuration that meets every rule', () => {
    expect(optionSelectionProblem(product.optionGroups, [pick('sauce', 'soy-garlic')])).toBeNull();
  });

  it('refuses a required group left empty', () => {
    expect(optionSelectionProblem(product.optionGroups, [])).toMatch(/choose sauce/i);
  });

  it('refuses more choices than the group allows', () => {
    const problem = optionSelectionProblem(product.optionGroups, [
      pick('sauce', 'soy-garlic'),
      pick('extras', 'cheese'),
      pick('extras', 'radish'),
      pick('extras', 'slaw'),
    ]);
    expect(problem).toMatch(/too many/i);
  });

  it('allows exactly the maximum', () => {
    expect(
      optionSelectionProblem(product.optionGroups, [
        pick('sauce', 'soy-garlic'),
        pick('extras', 'cheese'),
        pick('extras', 'radish'),
      ]),
    ).toBeNull();
  });

  it('refuses the same choice twice, which would be charged twice', () => {
    const problem = optionSelectionProblem(product.optionGroups, [
      pick('sauce', 'soy-garlic'),
      pick('extras', 'cheese'),
      pick('extras', 'cheese'),
    ]);
    expect(problem).toMatch(/same choice twice/i);
  });

  it('refuses an option that has been withdrawn', () => {
    const problem = optionSelectionProblem(product.optionGroups, [
      pick('sauce', 'discontinued', 'Retired Sauce'),
    ]);
    expect(problem).toMatch(/unavailable/i);
  });

  it('refuses an option that is no longer on the menu at all', () => {
    const problem = optionSelectionProblem(product.optionGroups, [pick('sauce', 'ghost')]);
    expect(problem).toMatch(/no longer on the menu/i);
  });

  it('refuses an option belonging to no group on this product', () => {
    const problem = optionSelectionProblem(product.optionGroups, [
      pick('sauce', 'soy-garlic'),
      pick('not-a-group', 'whatever', 'Gold Leaf'),
    ]);
    expect(problem).toMatch(/not an option on this item/i);
  });
});

describe('the basket refuses what the rules refuse', () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [], voucher: null, reward: null });
  });

  it('adds a valid line and says nothing', () => {
    const refusal = useCartStore.getState().addLine(product, [pick('sauce', 'hot')], 1);

    expect(refusal).toBeNull();
    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  /**
   * The gap this closed. The product screen gates the button, so this could
   * only be reached from somewhere else — and reorder is somewhere else.
   */
  it('will not take a line with a required group unfilled, whoever asks', () => {
    const refusal = useCartStore.getState().addLine(product, [], 1);

    expect(refusal).toMatch(/choose sauce/i);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('will not take a line carrying a withdrawn option', () => {
    const refusal = useCartStore
      .getState()
      .addLine(product, [pick('sauce', 'discontinued', 'Retired Sauce')], 1);

    expect(refusal).toMatch(/unavailable/i);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('will not take a line over the maximum', () => {
    const refusal = useCartStore
      .getState()
      .addLine(
        product,
        [
          pick('sauce', 'hot'),
          pick('extras', 'cheese'),
          pick('extras', 'radish'),
          pick('extras', 'slaw'),
        ],
        1,
      );

    expect(refusal).toMatch(/too many/i);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('leaves the basket exactly as it was when it refuses', () => {
    useCartStore.getState().addLine(product, [pick('sauce', 'hot')], 2);
    const before = useCartStore.getState().lines;

    useCartStore.getState().addLine(product, [], 1);

    expect(useCartStore.getState().lines).toEqual(before);
  });
});
