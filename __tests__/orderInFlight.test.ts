import { cancelOrder, fetchOrder, fetchOrders, minutesUntilDue } from '@/services/orderService';
import { mockDeliveryProvider } from '@/providers/delivery';

/**
 * An order that is actually happening.
 *
 * The seeded history was four completed orders and one cancelled — every one
 * of them over. So the Orders tab opened on an Active list that was empty by
 * construction (the screen sweep's own notes say so), and every screen that
 * renders a live order was reachable only by placing one in the session and
 * watching the mock advance it. Nothing cold ever showed a driver, a moving
 * progress bar, or an estimate with time left on it.
 *
 * BBQ-4830 is thirty-four minutes into a forty-two minute delivery: eight
 * minutes from due, and twelve minutes into the courier's own twenty-four.
 * Both clocks have to land inside their windows or the fixture is two systems
 * disagreeing rather than one coherent order.
 */
describe('the seeded order that is still on its way', () => {
  it('is in the Active list, which used to be empty by construction', async () => {
    const orders = await fetchOrders();
    const active = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');

    expect(active.length).toBeGreaterThan(0);
    expect(active.some((o) => o.reference === 'BBQ-4830')).toBe(true);
  });

  it('has time left on it, and not much', async () => {
    const order = await fetchOrder('order-4830');
    const due = minutesUntilDue(order);

    // Not overdue, and not the 42 minutes it was quoted at checkout.
    expect(due).toBeGreaterThan(0);
    expect(due).toBeLessThan(15);
  });

  /**
   * The defect this closes. `etaMinutes` is how long the order *takes*, fixed
   * when it was placed, and the Orders card printed it directly — so the card
   * never moved. Tracking was caught doing exactly this and fixed; the card
   * that leads to tracking was not, and nothing noticed because no seeded
   * order was ever live enough for the two to be compared.
   *
   * Asserted as the gap between the two numbers rather than through a
   * renderer: what matters is that the list and the detail cannot disagree,
   * and they disagree by however much time has passed.
   */
  it('is a different number from the one quoted at checkout', async () => {
    const order = await fetchOrder('order-4830');

    expect(minutesUntilDue(order)).not.toBe(order.etaMinutes);
    expect(order.etaMinutes).toBe(42);
  });

  it('carries a driver, because somebody is holding the food', async () => {
    const order = await fetchOrder('order-4830');

    expect(order.status).toBe('out_for_delivery');
    expect(order.delivery).toBeDefined();
    expect(order.driverName).toBeTruthy();
  });

  it('cannot be cancelled, and says why in its own terms', async () => {
    const order = await fetchOrder('order-4830');

    await expect(cancelOrder(order.id)).rejects.toThrow(/driver already has this order/i);
  });
});

/**
 * The provider defect the fixture surfaced, which is not about the fixture.
 *
 * `create` anchors the courier leg to `readyAt` rather than to the moment it
 * was asked — deliberately, because a client-side mock can only create a job
 * when somebody reads. So it can return a job that is already on the road.
 * It did, and it returned it with no courier on it: the naming rule lived in
 * `getStatus` alone.
 *
 * A customer looking at a live order therefore saw "Out for delivery · Your
 * driver has collected the order and is on the way" with no driver on the
 * card, and then a driver appearing on the next fetch when `getStatus` ran.
 */
describe('a courier job that is born already on the road', () => {
  it('names the driver on creation, not only on the next look', async () => {
    const readyAt = new Date(Date.now() - 12 * 60_000).toISOString();
    const job = await mockDeliveryProvider.create({
      orderId: 'order-probe',
      orderReference: 'BBQ-PROBE',
      storeId: 'store-rosebank',
      dropoffSummary: '14 Acacia Road, Melrose Arch',
      idempotencyKey: 'BBQ-PROBE',
      readyAt,
    });

    expect(job.status).toBe('ON_THE_WAY');
    expect(job.courierName).toBeTruthy();
  });

  it('still names nobody before anyone is assigned', async () => {
    const job = await mockDeliveryProvider.create({
      orderId: 'order-probe-2',
      orderReference: 'BBQ-PROBE-2',
      storeId: 'store-rosebank',
      dropoffSummary: '14 Acacia Road, Melrose Arch',
      idempotencyKey: 'BBQ-PROBE-2',
      readyAt: new Date().toISOString(),
    });

    expect(job.status).toBe('CONFIRMED');
    expect(job.courierName).toBeUndefined();
  });

  it('agrees with itself on the next look', async () => {
    const readyAt = new Date(Date.now() - 12 * 60_000).toISOString();
    const created = await mockDeliveryProvider.create({
      orderId: 'order-probe-3',
      orderReference: 'BBQ-PROBE-3',
      storeId: 'store-rosebank',
      dropoffSummary: '14 Acacia Road, Melrose Arch',
      idempotencyKey: 'BBQ-PROBE-3',
      readyAt,
    });
    const fetched = await mockDeliveryProvider.getStatus(created.externalJobId);

    // The blink: these two used to differ on whether anybody was carrying it.
    expect(fetched.courierName).toBe(created.courierName);
  });
});
