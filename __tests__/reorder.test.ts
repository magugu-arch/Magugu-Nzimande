import type { CartLine, Product } from '@/types';
import { describeReorder, planReorder } from '@/features/orders/reorder';

const product = (id: string, name: string, available = true): Product =>
  ({
    id,
    name,
    description: '',
    basePrice: 100,
    assetKey: 'goldenOriginal',
    category: 'chicken',
    available,
    optionGroups: [],
    tags: [],
    preparationMinutes: 18,
  }) as unknown as Product;

const line = (productId: string, name: string): CartLine =>
  ({
    id: productId,
    productId,
    name,
    assetKey: 'goldenOriginal',
    unitBasePrice: 100,
    quantity: 1,
    selectedOptions: [],
    unitPrice: 100,
    lineTotal: 100,
  }) as unknown as CartLine;

/**
 * "Order again" was written twice and the two did not agree. The order screen
 * carried a comment saying an item that has left the menu should be named
 * rather than silently dropped; the Orders list did exactly that, silently.
 * And where nothing could be re-added, the list's `if (added > 0)` meant the
 * button did nothing at all — no basket, no message, no navigation.
 */
describe('planReorder', () => {
  const menu = [product('p1', 'Golden Original'), product('p2', 'Soy Garlic')];

  it('brings back everything still on the menu', () => {
    const plan = planReorder([line('p1', 'Golden Original'), line('p2', 'Soy Garlic')], menu);

    expect(plan.addable).toHaveLength(2);
    expect(plan.unavailable).toEqual([]);
  });

  it('names an item that has left the menu rather than dropping it quietly', () => {
    const plan = planReorder([line('p1', 'Golden Original'), line('gone', 'Half & Half')], menu);

    expect(plan.addable).toHaveLength(1);
    expect(plan.unavailable).toEqual(['Half & Half']);
  });

  it('treats a withdrawn item the same as a deleted one', () => {
    const plan = planReorder(
      [line('p3', 'Hot Spicy')],
      [...menu, product('p3', 'Hot Spicy', false)],
    );

    expect(plan.addable).toHaveLength(0);
    expect(plan.unavailable).toEqual(['Hot Spicy']);
  });

  it('keeps the original order of the lines', () => {
    const plan = planReorder([line('p2', 'Soy Garlic'), line('p1', 'Golden Original')], menu);
    expect(plan.addable.map((entry) => entry.product.id)).toEqual(['p2', 'p1']);
  });
});

describe('describeReorder', () => {
  const menu = [product('p1', 'Golden Original')];

  it('says nothing when the whole order came back', () => {
    expect(describeReorder(planReorder([line('p1', 'Golden Original')], menu))).toBeNull();
  });

  /**
   * The case that produced a dead button. It must always end in a message,
   * never in silence and never in a trip to an empty basket.
   */
  it('explains when nothing at all could be re-added', () => {
    const notice = describeReorder(planReorder([line('gone', 'Half & Half')], menu));

    expect(notice).toEqual({
      title: 'Nothing to reorder',
      message: 'Half & Half is not on the menu right now.',
    });
  });

  /**
   * Names the dish rather than counting it. "1 is no longer available" makes
   * someone open the basket and compare it against a receipt to work out what
   * is missing.
   */
  it('names what it left out', () => {
    const notice = describeReorder(
      planReorder([line('p1', 'Golden Original'), line('gone', 'Half & Half')], menu),
    );

    expect(notice?.title).toBe('Added what we could');
    expect(notice?.message).toContain('Half & Half');
    expect(notice?.message).toContain('no longer available');
  });

  it('reads properly with more than one missing dish', () => {
    const notice = describeReorder(
      planReorder(
        [line('p1', 'Golden Original'), line('a', 'Wings'), line('b', 'Cheeseling Fries')],
        menu,
      ),
    );

    expect(notice?.message).toContain('Wings and Cheeseling Fries');
    expect(notice?.message).toContain('are no longer available');
  });
});
