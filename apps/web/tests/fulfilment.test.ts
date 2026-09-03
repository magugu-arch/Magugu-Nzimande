import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourierAdapter, Handoff, PosAdapter } from '@/lib/fulfilment/adapters';
import {
  handoffFor,
  pushToPos,
  requestCourier,
  syncSoldOut,
  unacknowledged,
} from '@/lib/fulfilment/handoff';
import { isSoldOut, setSoldOut } from '@/lib/catalogue-state';
import { readAudit } from '@/lib/catalogue-state';
import { aDeliveryStore, aProduct, aSuburbOf, blankState, placeOrder } from './fixtures';

/**
 * Handing an order to the kitchen system and to a courier.
 *
 * Neither is contracted, so both are absent on this deployment — and the
 * decision worth testing hardest is that absence is not refusal. An
 * unconfigured payment provider refuses the payment, because money that cannot
 * be taken must not look taken. An unconfigured POS does not refuse the order,
 * because the operations console is a working kitchen display and turning a
 * missing integration into a closed shop is worse than the thing it prevents.
 */

const acceptingPos = (): PosAdapter => ({
  name: 'test-pos',
  pushOrder: vi.fn(async () => ({ ok: true, reference: 'pos_1' }) as Handoff),
  fetchSoldOut: vi.fn(async () => [] as string[]),
});

const refusingPos = (retryable = true): PosAdapter => ({
  name: 'test-pos',
  pushOrder: vi.fn(async () => ({ ok: false, error: 'till offline', retryable }) as Handoff),
  fetchSoldOut: vi.fn(async () => null),
});

const acceptingCourier = (): CourierAdapter => ({
  name: 'test-courier',
  requestPickup: vi.fn(async () => ({ ok: true, reference: 'trip_1' }) as Handoff),
  track: vi.fn(async () => ({ status: 'assigned', etaMinutes: 20 })),
});

const deliveryOrder = async () => {
  const store = aDeliveryStore();
  return placeOrder({
    storeId: store.id,
    mode: 'Delivery',
    address: '12 Oak Avenue',
    suburb: aSuburbOf(store),
  });
};

beforeEach(blankState);

describe('with no kitchen system attached', () => {
  /** The distinction from payments, and the reason this is a whole describe. */
  it('still takes the order', async () => {
    const order = await placeOrder();
    expect(order.orderNumber).toBeTruthy();
    expect(await pushToPos(order, null)).toBeNull();
  });

  /**
   * A handoff never attempted is not a failed one. On a deployment with no POS
   * every order would otherwise be listed as unacknowledged, and a report that
   * always names everything is a report nobody reads.
   */
  it('does not report every order as one the kitchen missed', async () => {
    const order = await placeOrder();
    await pushToPos(order, null);

    expect(unacknowledged()).toEqual([]);
  });

  it('does not ask a courier that is not there', async () => {
    expect(await requestCourier(await deliveryOrder(), null)).toBeNull();
  });
});

describe('pushing an order to the till', () => {
  it('records the reference it came back with', async () => {
    const order = await placeOrder();
    const pos = acceptingPos();

    const record = await pushToPos(order, pos);
    expect(record?.ok).toBe(true);
    expect(record?.reference).toBe('pos_1');
    expect(handoffFor(order.id, 'pos')?.ok).toBe(true);
  });

  /** A kitchen reads the same order twice as two of everything. */
  it('does not push an accepted order a second time', async () => {
    const order = await placeOrder();
    const pos = acceptingPos();

    await pushToPos(order, pos);
    await pushToPos(order, pos);
    await pushToPos(order, pos);

    expect(pos.pushOrder).toHaveBeenCalledTimes(1);
  });

  it('records a refusal without losing the order', async () => {
    const order = await placeOrder();
    const record = await pushToPos(order, refusingPos());

    expect(record?.ok).toBe(false);
    expect(record?.error).toBe('till offline');
    expect(unacknowledged('pos').map((entry) => entry.orderId)).toEqual([order.id]);
  });

  it('will try a refused order again, unlike an accepted one', async () => {
    const order = await placeOrder();
    const pos = refusingPos();

    await pushToPos(order, pos);
    await pushToPos(order, pos);

    expect(pos.pushOrder).toHaveBeenCalledTimes(2);
  });

  it('clears the shortfall once the till finally takes it', async () => {
    const order = await placeOrder();
    await pushToPos(order, refusingPos());
    expect(unacknowledged('pos')).toHaveLength(1);

    await pushToPos(order, acceptingPos());
    expect(unacknowledged('pos')).toEqual([]);
  });

  /**
   * An adapter that throws is a bug or a network that died mid-call. Either
   * way the order must survive it: the console still has it, and the failure
   * is recorded as retryable rather than escaping into the route.
   */
  it('survives an adapter that throws', async () => {
    const order = await placeOrder();
    const broken: PosAdapter = {
      name: 'broken-pos',
      pushOrder: async () => {
        throw new Error('connection reset');
      },
      fetchSoldOut: async () => null,
    };

    const record = await pushToPos(order, broken);
    expect(record?.ok).toBe(false);
    expect(record?.retryable).toBe(true);
    expect(record?.error).toContain('connection reset');
  });

  it('writes every attempt into the audit log', async () => {
    const order = await placeOrder();
    await pushToPos(order, refusingPos());

    expect(readAudit().some((entry) => entry.what.includes(order.orderNumber))).toBe(true);
  });
});

describe('asking for a driver', () => {
  it('asks for one for a delivery order', async () => {
    const record = await requestCourier(await deliveryOrder(), acceptingCourier());
    expect(record?.reference).toBe('trip_1');
  });

  /** A courier standing in a shop beside the customer who came to fetch it. */
  it('does not ask for one for a collection', async () => {
    const courier = acceptingCourier();
    expect(await requestCourier(await placeOrder(), courier)).toBeNull();
    expect(courier.requestPickup).not.toHaveBeenCalled();
  });

  it('does not ask twice for one order', async () => {
    const order = await deliveryOrder();
    const courier = acceptingCourier();

    await requestCourier(order, courier);
    await requestCourier(order, courier);

    expect(courier.requestPickup).toHaveBeenCalledTimes(1);
  });

  it('keeps the two handoffs apart', async () => {
    const order = await deliveryOrder();
    await pushToPos(order, acceptingPos());
    await requestCourier(order, acceptingCourier());

    expect(handoffFor(order.id, 'pos')?.reference).toBe('pos_1');
    expect(handoffFor(order.id, 'courier')?.reference).toBe('trip_1');
  });
});

describe('availability from the till', () => {
  it('applies what the POS says is off', async () => {
    const pos: PosAdapter = { ...acceptingPos(), fetchSoldOut: async () => ['golden-original'] };
    const applied: string[][] = [];

    expect(await syncSoldOut(pos, (slugs) => applied.push(slugs))).toBe(true);
    expect(applied).toEqual([['golden-original']]);
  });

  /**
   * The one that would have hurt. "I could not ask" and "nothing is sold out"
   * must not be the same answer, or one network hiccup at the kitchen puts
   * every sold-out item back on the menu and the first anyone hears is a
   * customer ordering something that ran out at lunchtime.
   */
  it('leaves the list alone when the till cannot be reached', async () => {
    const product = aProduct();
    setSoldOut(product.slug, true);

    const unreachable: PosAdapter = { ...acceptingPos(), fetchSoldOut: async () => null };
    const applied: string[][] = [];

    expect(await syncSoldOut(unreachable, (slugs) => applied.push(slugs))).toBe(false);
    expect(applied, 'nothing was applied').toEqual([]);
    expect(isSoldOut(product.slug), 'and it is still sold out').toBe(true);
  });

  it('treats a throwing adapter the same as an unreachable one', async () => {
    const broken: PosAdapter = {
      ...acceptingPos(),
      fetchSoldOut: async () => {
        throw new Error('timeout');
      },
    };
    const applied: string[][] = [];

    expect(await syncSoldOut(broken, (slugs) => applied.push(slugs))).toBe(false);
    expect(applied).toEqual([]);
  });

  it('says so in the audit log rather than failing silently', async () => {
    const unreachable: PosAdapter = { ...acceptingPos(), fetchSoldOut: async () => null };
    await syncSoldOut(unreachable, () => {});

    expect(readAudit().some((entry) => entry.who === 'pos')).toBe(true);
  });

  it('does nothing at all with no POS', async () => {
    const applied: string[][] = [];
    expect(await syncSoldOut(null, (slugs) => applied.push(slugs))).toBe(false);
    expect(applied).toEqual([]);
  });
});
