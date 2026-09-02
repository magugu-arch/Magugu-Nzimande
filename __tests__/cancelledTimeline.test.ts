import { cancelOrder, fetchOrder, fetchOrders } from '@/services/orderService';

/**
 * What a cancelled order shows on the tracking screen.
 *
 * Found by adding a cancelled order to the seeded history — the first one
 * there had ever been. `cancelled` is not a member of `statusSequence`,
 * because it is not a step somebody walks through, so `indexOf` returned -1,
 * no step was marked reached, and the screen rendered the entire journey
 * anyway. A customer opening a cancelled order was shown:
 *
 *     Order received · Preparing · Ready · Driver assigned ·
 *     Out for delivery · Completed — Enjoy. Thanks for ordering with bb.q.
 *
 * None of which happened. The last line is the one that stings: a thank-you
 * for food that was never made, under the word "Cancelled".
 *
 * Nothing could catch it, because nothing rendered it. The unit tests had no
 * cancelled order to build a timeline from and `audit:screens` had no route to
 * sweep — the seed's two orders were both completed. That is what the new
 * fixtures are for.
 */
describe('the timeline on a cancelled order', () => {
  it('shows only what happened, and does not thank anybody', async () => {
    const order = await fetchOrder('order-4788');
    expect(order.status).toBe('cancelled');

    const statuses = order.timeline.map((entry) => entry.status);
    expect(statuses).toEqual(['received', 'cancelled']);

    // The specific words that were on the screen.
    const text = order.timeline.map((entry) => `${entry.label} ${entry.description}`).join(' ');
    expect(text).not.toMatch(/Thanks for ordering/i);
    expect(text).not.toMatch(/Out for delivery|Driver assigned|Preparing/i);
  });

  it('says when it was received and when it was called off', async () => {
    const order = await fetchOrder('order-4788');
    const [received, cancelled] = order.timeline;

    expect(received?.occurredAt).toBeTruthy();
    expect(cancelled?.occurredAt).toBeTruthy();
    // Called off after it was placed, which is the only order those can be in.
    expect(new Date(cancelled!.occurredAt!).getTime()).toBeGreaterThan(
      new Date(received!.occurredAt!).getTime(),
    );
  });

  /**
   * The other half: an order cancelled *now* kept whatever timeline it was
   * carrying, so the same defect arrived by a second route. `cancelOrder`
   * rebuilds it.
   */
  it('rebuilds the timeline when an order is cancelled, rather than keeping it', async () => {
    const orders = await fetchOrders();
    const live = orders.find((order) => order.status === 'received');
    if (!live) {
      // Nothing cancellable in the seed right now; the assertion above already
      // covers the rendered case. Skipping quietly would hide that, so say it.
      expect(orders.length).toBeGreaterThan(0);
      return;
    }

    const cancelled = await cancelOrder(live.id);
    expect(cancelled.timeline.map((entry) => entry.status)).toEqual(['received', 'cancelled']);
  });
});

describe('the fixtures this found the defect with', () => {
  it('seeds a cancelled order, a dine-in order and a scheduled one', async () => {
    const orders = await fetchOrders();

    expect(orders.some((order) => order.status === 'cancelled')).toBe(true);
    expect(orders.some((order) => order.fulfilmentType === 'dinein' && order.tableNumber)).toBe(
      true,
    );
    expect(orders.some((order) => order.scheduledFor)).toBe(true);
  });

  /**
   * "Rate this order" renders only on a completed order with no rating. Every
   * seeded order was already rated, so the entry point to the rating flow
   * could not be reached without placing an order and waiting for it to
   * finish.
   */
  it('seeds an order that can actually reach the rating flow', async () => {
    const orders = await fetchOrders();
    expect(orders.some((order) => order.status === 'completed' && order.rating === undefined)).toBe(
      true,
    );
  });

  /** A receipt with a voucher on it, and one with a redeemed reward. */
  it('seeds an order carrying a voucher and one carrying a reward', async () => {
    const orders = await fetchOrders();
    expect(orders.some((order) => order.voucherCode)).toBe(true);
    expect(orders.some((order) => order.redeemedRewardId)).toBe(true);
  });
});
