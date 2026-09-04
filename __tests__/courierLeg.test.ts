import { mockDeliveryProvider, resetMockDeliveryJobs } from '@/providers/delivery';
import { fetchOrder, fetchOrders, placeOrder, statusSequence } from '@/services/orderService';
import { newIdempotencyKey } from '@/utils/idempotency';
import type { CartTotals, PlaceOrderInput } from '@/types';

/**
 * The courier leg, on a real order (brief §2, §6).
 *
 * The gap this closes: the journey went ready → out_for_delivery with nothing
 * in between, so an order boxed and waiting for a driver read "Ready" — the
 * same word a collection customer sees when the food is on the counter for
 * *them*. `driverName` was a string set at placement, which named a driver
 * before anybody had been dispatched.
 *
 * The courier now drives that part of the journey through the provider
 * interface, and these hold the two systems together: the kitchen owns the
 * cooking, the provider owns the courier, and neither may overwrite the other's
 * facts.
 */
const totals: CartTotals = {
  subtotal: 250,
  deliveryFee: 32,
  serviceFee: 5,
  discount: 0,
  rewardsDiscount: 0,
  total: 287,
  pointsEarned: 250,
};

function deliveryOrder(): PlaceOrderInput {
  return {
    lines: [],
    totals,
    idempotencyKey: newIdempotencyKey(),
    fulfilmentType: 'delivery',
    storeId: 'store-sandton',
    // The seeded home address, which is one of the few that has coordinates —
    // and a courier cannot route to one that does not.
    addressId: 'address-home',
    paymentMethodId: 'payment-visa',
    paymentMethodType: 'card',
  };
}

beforeEach(() => {
  resetMockDeliveryJobs();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the journey a delivery order follows', () => {
  it('has a courier step between the kitchen and the road', () => {
    const sequence = statusSequence('delivery');
    expect(sequence.indexOf('courier_assigned')).toBeGreaterThan(sequence.indexOf('ready'));
    expect(sequence.indexOf('courier_assigned')).toBeLessThan(sequence.indexOf('out_for_delivery'));
  });

  it('gives a collection order no courier steps at all', () => {
    // Nobody is driving anywhere. A courier step here would be a screen
    // telling somebody standing in the shop that a driver is coming.
    expect(statusSequence('collection')).not.toContain('courier_assigned');
    expect(statusSequence('collection')).not.toContain('out_for_delivery');
  });
});

describe('requesting a courier', () => {
  it('does not name a driver at placement, because there is not one yet', async () => {
    const order = await placeOrder(deliveryOrder());
    expect(order.status).toBe('received');
    expect(order.driverName).toBeUndefined();
    expect(order.delivery).toBeUndefined();
  });

  it('carries the dropoff coordinates so the job can be routed', async () => {
    const order = await placeOrder(deliveryOrder());
    expect(order.deliveryLatitude).toBeDefined();
    expect(order.deliveryLongitude).toBeDefined();
  });

  /**
   * A courier is requested when there is something to collect. Requesting at
   * placement would dispatch a driver for food twenty minutes from existing —
   * and for a scheduled order, hours.
   */
  it('requests nobody while the food is still being cooked', async () => {
    const placed = await placeOrder(deliveryOrder());
    const early = await fetchOrder(placed.id);
    expect(early.delivery).toBeUndefined();
  });

  it('acquires a courier once the kitchen is done, and names them', async () => {
    const placed = await placeOrder(deliveryOrder());

    // Far enough along that the kitchen has finished and a driver is assigned.
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 40 * 60_000);

    const tracked = await fetchOrder(placed.id);
    expect(tracked.delivery).toBeDefined();
    expect(tracked.delivery?.provider).toBe('mock');
    expect(tracked.status).not.toBe('ready');
  });

  it('leaves a collection order with no courier, however long it sits', async () => {
    const placed = await placeOrder({ ...deliveryOrder(), fulfilmentType: 'collection' });
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 90 * 60_000);

    const tracked = await fetchOrder(placed.id);
    expect(tracked.delivery).toBeUndefined();
    expect(tracked.driverName).toBeUndefined();
  });
});

describe('an order that is over', () => {
  /**
   * The defect this closes, found by asking what opening the Orders tab
   * actually does: every delivery order in the history qualified for a courier,
   * because `completed` is past `ready` and the guard only asked whether the
   * kitchen had finished. So the list dispatched a driver for an order
   * delivered last week — once per order, per fetch, against a network that
   * bills for it.
   */
  /**
   * Asserted per order rather than across the whole fetch, which is a
   * correction the seed forced and a fair one.
   *
   * `expect(create).not.toHaveBeenCalled()` was only ever true because every
   * seeded delivery order was over. Adding one that is genuinely out with a
   * driver made it fail — and that call is correct: it is the same idempotent
   * `create`, keyed on the order's own reference, that adopts any live
   * delivery the app is not already holding a job for. A blanket assertion
   * would have been a test defending the seed's limits rather than the rule,
   * and it would have blocked the fixture instead of catching a defect.
   *
   * What the rule actually says is about the finished ones, so that is what is
   * checked: no reference belonging to a completed or cancelled order may
   * appear in a dispatch.
   */
  it('never dispatches a courier for an order already delivered', async () => {
    const create = jest.spyOn(mockDeliveryProvider, 'create');
    const orders = await fetchOrders();

    // The seeded history is what caught this: it contains a completed delivery.
    const over = orders.filter(
      (o) =>
        o.fulfilmentType === 'delivery' && (o.status === 'completed' || o.status === 'cancelled'),
    );
    expect(over.length).toBeGreaterThan(0);

    const dispatched = create.mock.calls.map(([request]) => request.orderReference);
    for (const order of over) {
      expect(dispatched).not.toContain(order.reference);
    }
  });

  /**
   * And the other half of the same rule, which nothing could state until the
   * seed had a live delivery in it: an order out with a driver is exactly what
   * the courier leg is for.
   */
  it('does arrange one for an order that is still on the road', async () => {
    const orders = await fetchOrders();
    const live = orders.find(
      (o) => o.fulfilmentType === 'delivery' && o.status === 'out_for_delivery',
    );

    expect(live).toBeDefined();
    // Asserted on the order rather than on the spy: the ledger carries across
    // this file, so whether *this* fetch was the one that created the job is
    // an accident of test ordering. What must hold is that a live delivery
    // ends up holding one, however many times it has been looked at.
    expect(live!.delivery).toBeDefined();
    expect(live!.driverName).toBeTruthy();
  });

  /** And looking at it again does not put a second driver on the road. */
  it('adopts the same job on the next look rather than dispatching again', async () => {
    const first = await fetchOrders();
    const live = first.find(
      (o) => o.fulfilmentType === 'delivery' && o.status === 'out_for_delivery',
    )!;

    const create = jest.spyOn(mockDeliveryProvider, 'create');
    const second = await fetchOrder(live.id);

    expect(create).not.toHaveBeenCalled();
    expect(second.delivery?.externalJobId).toBe(live.delivery?.externalJobId);
  });

  it('does not keep asking about a job once the order is done', async () => {
    const placed = await placeOrder(deliveryOrder());
    const now = Date.now();

    // Long enough that the whole journey, courier included, has finished.
    jest.spyOn(Date, 'now').mockReturnValue(now + 120 * 60_000);
    const finished = await fetchOrder(placed.id);
    expect(finished.status).toBe('completed');

    const getStatus = jest.spyOn(mockDeliveryProvider, 'getStatus');
    await fetchOrder(placed.id);
    expect(getStatus).not.toHaveBeenCalled();
  });
});

describe('when the two clocks disagree', () => {
  /**
   * The rule that keeps the screen sane. The kitchen and the courier network
   * do not share a clock, and a provider that has not yet reported a pickup
   * must never drag a customer who has been told "on the way" back to "ready".
   */
  it('never moves a customer backwards', async () => {
    const placed = await placeOrder(deliveryOrder());
    const now = Date.now();

    jest.spyOn(Date, 'now').mockReturnValue(now + 45 * 60_000);
    const first = await fetchOrder(placed.id);
    const sequence = statusSequence('delivery');
    const firstIndex = sequence.indexOf(first.status);

    // Re-read at the same instant: the status may advance, never retreat.
    const second = await fetchOrder(placed.id);
    expect(sequence.indexOf(second.status)).toBeGreaterThanOrEqual(firstIndex);
  });

  /**
   * A courier network being unreachable is not an order failing. The food
   * exists and the customer is entitled to see their order.
   */
  it('keeps the order readable when the provider throws', async () => {
    const placed = await placeOrder(deliveryOrder());
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 40 * 60_000);

    // The courier network, unreachable — the real failure, not a stand-in for
    // one. Without the catch in `attachDelivery` this rejection propagates and
    // the tracking screen shows an error for an order that is perfectly fine.
    const create = jest
      .spyOn(mockDeliveryProvider, 'create')
      .mockRejectedValue(new Error('courier network unreachable'));

    const tracked = await fetchOrder(placed.id);

    expect(create).toHaveBeenCalled();
    expect(tracked.id).toBe(placed.id);
    expect(tracked.reference).toBe(placed.reference);
    // No job, and the kitchen's own status stands.
    expect(tracked.delivery).toBeUndefined();
    expect(statusSequence('delivery')).toContain(tracked.status);
  });
});
