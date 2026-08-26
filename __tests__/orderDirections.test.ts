import type { Order } from '@/types';
import { directionsTargetFor } from '@/features/orders/directions';

/**
 * `0, 0` is not "no coordinates". It is a point in the Gulf of Guinea, about
 * 6 500 km from Johannesburg, and the order record used to carry it whenever
 * there was no branch to read the real ones off — `store?.latitude ?? 0`.
 *
 * The tracking screen offered "Get directions" whenever `storeAddress` was a
 * non-empty string, which says nothing about the coordinates beside it. So the
 * button would have opened a maps app, with the right street address printed
 * underneath it, and routed somebody into the Atlantic.
 */
const collection = {
  id: 'order-1',
  fulfilmentType: 'collection',
  storeName: 'bb.q Chicken Rosebank',
  storeAddress: '50 Bath Avenue, Rosebank',
  storeLatitude: -26.1465,
  storeLongitude: 28.0436,
} as unknown as Order;

const without = (order: Order, ...keys: string[]): Order => {
  const copy = { ...order } as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy as unknown as Order;
};

describe('where the tracking screen will send somebody', () => {
  it('offers the branch for an order they are collecting', () => {
    expect(directionsTargetFor(collection)).toEqual({
      latitude: -26.1465,
      longitude: 28.0436,
      label: 'bb.q Chicken Rosebank',
    });
  });

  it('offers nothing for a delivery, which is coming to them', () => {
    expect(directionsTargetFor({ ...collection, fulfilmentType: 'delivery' })).toBeNull();
  });

  it('offers nothing when the record carries no coordinates', () => {
    expect(directionsTargetFor(without(collection, 'storeLatitude', 'storeLongitude'))).toBeNull();
  });

  it('offers nothing when only one of the pair arrived', () => {
    expect(directionsTargetFor(without(collection, 'storeLongitude'))).toBeNull();
  });

  /**
   * `request<T>` casts the parsed JSON rather than validating it, so the type
   * saying `number` is a promise about the wire that nothing checks. A string
   * would reach `directionsUrl`, which coerces — producing `NaN,NaN` in the
   * URL rather than a destination.
   */
  it('is not fooled by a coordinate that arrived as a string', () => {
    const fromTheWire = { ...collection, storeLatitude: '-26.1465' } as unknown as Order;
    expect(directionsTargetFor(fromTheWire)).toBeNull();
  });

  it('offers nothing when there is no address to show under the button', () => {
    expect(directionsTargetFor({ ...collection, storeAddress: '' })).toBeNull();
  });

  it('still offers the branch for dine-in, which somebody travels to', () => {
    expect(directionsTargetFor({ ...collection, fulfilmentType: 'dinein' })?.label).toBe(
      'bb.q Chicken Rosebank',
    );
  });
});
