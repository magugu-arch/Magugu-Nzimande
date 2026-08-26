import type { DirectionsTarget } from '@/utils/linking';
import type { Order } from '@/types';

/**
 * Where to send somebody collecting an order, or nothing.
 *
 * Three things have to be true before the tracking screen offers "Get
 * directions", and only the first was being checked:
 *
 *  1. They are coming to fetch it. A delivery is coming to them.
 *  2. There is an address to show under the button.
 *  3. The record actually carries the branch's coordinates.
 *
 * The third is the one that was missing. `storeLatitude` and `storeLongitude`
 * were written as `store?.latitude ?? 0`, and `0, 0` is a real place — a point
 * in the Gulf of Guinea about 6 500 km from Johannesburg. A record without a
 * branch on it would have opened a maps app and routed somebody there, with the
 * right street address printed underneath.
 *
 * The fields are optional now, and this asks `Number.isFinite` of them rather
 * than trusting the type: `request<T>` casts the parsed JSON rather than
 * validating it, so a coordinate arriving from a real backend as a string, or
 * not at all, reaches here unchallenged.
 */
export function directionsTargetFor(order: Order): DirectionsTarget | null {
  if (order.fulfilmentType === 'delivery') return null;
  if (order.storeAddress.length === 0) return null;

  const { storeLatitude: latitude, storeLongitude: longitude } = order;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude: latitude as number,
    longitude: longitude as number,
    label: order.storeName,
  };
}
