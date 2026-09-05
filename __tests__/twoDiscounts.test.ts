import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetchOrder, fetchOrders } from '@/services/orderService';
import { calculateTotals } from '@/utils/cart';

/**
 * An order that used a voucher *and* a reward.
 *
 * `discount` and `rewardsDiscount` are separate fields, separate business
 * decisions and separate lines on a receipt, and five seeded orders carried
 * one or the other and never both — so the pair had never been rendered
 * anywhere. Somebody with a welcome code and enough points to spend is not an
 * exotic customer; they are a customer in their first month.
 *
 * BBQ-4795 is that order, and the arithmetic is worth stating because it is
 * money: R209 for a medium Golden Original plus R45 of fries is R254; the
 * welcome code takes R50 and the fries reward R20; R32 of delivery and R5 of
 * service bring it to R221. Points accrue on food value after discounts.
 */
describe('the seeded order that used both', () => {
  it('carries a voucher and a reward at once, which none did before', async () => {
    const orders = await fetchOrders();
    const both = orders.filter(
      (order) => order.totals.discount > 0 && order.totals.rewardsDiscount > 0,
    );

    expect(both.length).toBeGreaterThan(0);
    expect(both.map((order) => order.reference)).toContain('BBQ-4795');
  });

  it('adds up, through the same arithmetic the cart uses', async () => {
    const order = await fetchOrder('order-4795');
    const recomputed = calculateTotals({
      lines: order.lines,
      fulfilmentType: order.fulfilmentType,
      voucherDiscount: order.totals.discount,
      rewardsDiscount: order.totals.rewardsDiscount,
    });

    expect(recomputed.subtotal).toBe(order.totals.subtotal);
    expect(recomputed.total).toBe(order.totals.total);
    // Points accrue on food value only, after both discounts.
    expect(recomputed.pointsEarned).toBe(order.totals.pointsEarned);
  });

  /**
   * The defect the fixture found, and it was not about the pair.
   *
   * The order record carries `voucherCode`, and `OrderTotals` has a slot for
   * it — the cart passes one and draws "Promo · WELCOME50". The receipt passed
   * neither, so a customer who had just left a cart saying "Promo · WELCOME50"
   * and "Reward · Free French Fries" reached a receipt saying "Promo discount"
   * and "Rewards discount". The facts were on the record, the component had
   * the slots, and nothing joined them.
   *
   * It was already true of the single-voucher order beside it; putting two
   * anonymous discount lines on one receipt is what made anybody look.
   */
  it('names the reward, not just the fact of one', async () => {
    const order = await fetchOrder('order-4795');

    expect(order.voucherCode).toBe('WELCOME50');
    expect(order.rewardName).toBe('Free French Fries');
  });

  it('names it on the older reward-only order too', async () => {
    const order = await fetchOrder('order-4655');

    expect(order.rewardName).toBeTruthy();
  });
});

describe('both order screens pass what the record carries', () => {
  const code = (file: string) =>
    readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it.each(['src/app/order/[id]/index.tsx', 'src/app/order/[id]/confirmation.tsx'])(
    '%s hands OrderTotals the voucher code and the reward name',
    (file) => {
      const source = code(file);

      expect(source).toMatch(/voucherCode: data\.voucherCode/);
      expect(source).toMatch(/rewardName: data\.rewardName/);
    },
  );

  it('would catch a screen that passed neither', () => {
    const raw = '<OrderTotals totals={data.totals} fulfilmentType={data.fulfilmentType} />';
    expect(/voucherCode/.test(raw)).toBe(false);
  });
});

/**
 * And the policy question the fixture asks, which is not mine to answer.
 *
 * Nothing decides whether a reward and a voucher may be used together:
 * `applyVoucher` and `applyReward` are independent setters and
 * `calculateTotals` subtracts both. The app is not silent about it either —
 * one reward states "Cannot be combined with another voucher" in its own terms
 * and seven say nothing, so a restriction is stated on one item in eight and
 * kept on none.
 *
 * Stacking is a margin decision, and enforcing a term that may be seed
 * boilerplate would take a benefit away from customers on nobody's authority.
 * So it goes to `audit:launch`, run here for real rather than grepped.
 */
describe('the launch audit', () => {
  it('asks whether rewards and vouchers stack', () => {
    const output = execFileSync('node', ['scripts/audit-launch-readiness.mjs'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });

    expect(output).toMatch(/Reward and voucher stacking/);
    expect(output).toMatch(/BBQ-4795/);
  });
});
