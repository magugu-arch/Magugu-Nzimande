import { fetchMenu } from '@/services/menuService';
import { fetchOrder } from '@/services/orderService';
import { describeReorder, planReorder } from '@/features/orders/reorder';
import { buildCartLine, defaultSelectionFor, reconcileCart } from '@/utils/cart';

/**
 * The two "you cannot have that" paths, which had code and no example.
 *
 * `product.available` and `option.available` are read in four places — the
 * option picker, `defaultSelection`, `reconcileCart` and `planReorder` — and
 * every one of the 23 seeded products and 78 seeded options was available. So
 * a customer could never meet a sold-out option, a saved basket could never be
 * broken by one, and "Order again" could never report a dish that had left the
 * menu. All of it worked, none of it had ever run.
 *
 * Two fixtures fix that: the sharing bucket of fries is sold out, and an older
 * order carries a soup that is no longer on the board.
 */
describe('an option that is sold out', () => {
  it('exists in the catalogue at all', async () => {
    const menu = await fetchMenu();
    const withdrawn = menu.products.flatMap((product) =>
      product.optionGroups.flatMap((group) =>
        group.options.filter((option) => !option.available).map((option) => option.id),
      ),
    );
    expect(withdrawn).toContain('fries-size-sharing');
  });

  /**
   * The picker draws it greyed with a "Sold out" caption and refuses the tap.
   * That is right, and it had never rendered.
   */
  it('is never preselected by default', async () => {
    const menu = await fetchMenu();
    const fries = menu.products.find((product) => product.id === 'french-fries');
    expect(fries).toBeDefined();

    const chosen = Object.values(defaultSelectionFor(fries!)).flat();
    expect(chosen).not.toContain('fries-size-sharing');
  });

  /**
   * A basket saved before the bucket sold out cannot be cooked as configured.
   * Silently swapping the size would hand somebody a different meal, so the
   * line goes and they are told.
   */
  it('breaks a saved basket that had already chosen it, rather than quietly resizing', async () => {
    const menu = await fetchMenu();
    const fries = menu.products.find((product) => product.id === 'french-fries')!;

    // Build the line against a menu where it was still on sale.
    const asSold = {
      ...fries,
      optionGroups: fries.optionGroups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({ ...option, available: true })),
      })),
    };
    const line = buildCartLine(
      asSold,
      [
        {
          groupId: 'fries-size',
          groupName: 'Size',
          optionId: 'fries-size-sharing',
          optionName: 'Sharing bucket',
          priceDelta: 48,
        },
      ],
      1,
    );

    const result = reconcileCart([line], menu.products);
    expect(result.lines).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
  });
});

describe('a dish that has left the menu', () => {
  it('is on an old receipt, because menus change', async () => {
    const order = await fetchOrder('order-4655');
    expect(order.lines.some((line) => line.productId === 'winter-pumpkin-soup')).toBe(true);
  });

  /**
   * The notice names the dish rather than counting it. "1 is no longer
   * available" makes somebody open the basket and compare it against a
   * receipt; naming it answers the question on the spot.
   */
  it('is named when the customer taps Order again', async () => {
    const order = await fetchOrder('order-4655');
    const menu = await fetchMenu();

    const plan = planReorder(order.lines, menu.products);
    expect(plan.unavailable).toContain('Winter Pumpkin Soup');

    const notice = describeReorder(plan);
    expect(notice).not.toBeNull();
    expect(notice!.message).toContain('Winter Pumpkin Soup');
  });

  it('still re-adds everything that is on the menu', async () => {
    const order = await fetchOrder('order-4655');
    const menu = await fetchMenu();

    const plan = planReorder(order.lines, menu.products);
    // The soup goes; the chicken comes back. A reorder that dropped the whole
    // basket over one withdrawn item would be worse than the notice.
    expect(plan.addable.map(({ line }) => line.productId)).toContain('soy-garlic');
  });
});
