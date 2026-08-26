import { config } from '@/constants/config';
import type { FulfilmentType, Store } from '@/types';
import { distanceKm, type Coordinates } from '@/utils/geo';
import { isTradingNow } from '@/utils/tradingHours';
import { delay, request } from './apiClient';
import { stores } from './data/storeData';
import { checkedStore, checkedStores } from './wireChecks';

/**
 * Store locator service. Distances are recomputed against the customer's real
 * coordinates rather than trusting the seed values.
 */

/**
 * Distance and openness are both facts about the customer's here and now, and
 * both arrive as stale numbers on the record. Distance was already being
 * recomputed; `isOpenNow` was not, which is how every branch came to claim it
 * was open at three in the morning.
 *
 * Recomputing keeps the branch's own veto — `isTradingNow` returns false if
 * either the flag or the timetable says shut — so a kitchen that closed early
 * still reads as closed.
 *
 * `origin` is nullable and null is the ordinary case: the customer has declined
 * the location prompt, or has not been asked yet. It used to default to
 * `DEFAULT_COORDINATES` — the Johannesburg CBD — which measured every branch
 * from a place the customer had never been to and then sorted the list by that
 * measurement and printed it on a badge. A customer in Durban opened the store
 * picker and read "bb.q Chicken Rosebank · 6.4 km", nearest first.
 *
 * With no origin there is no distance and no nearest, so the list comes back in
 * a stable alphabetical order and the screens have nothing to print. Saying
 * nothing is the only honest thing available; the same reasoning as the
 * delivery-radius rule, which is the other half of this bug.
 */
function resolveAgainstCustomer(list: Store[], origin: Coordinates | null, now: Date): Store[] {
  if (!origin) {
    return list
      .map(({ distanceKm: _unknown, ...store }) => ({
        ...store,
        isOpenNow: isTradingNow(store, now),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return list
    .map((store) => ({
      ...store,
      distanceKm: distanceKm(origin, { latitude: store.latitude, longitude: store.longitude }),
      isOpenNow: isTradingNow(store, now),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function fetchStores(origin: Coordinates | null = null): Promise<Store[]> {
  if (config.useMockApi) return delay(resolveAgainstCustomer(stores, origin, new Date()));

  // Without coordinates the backend gets no coordinates, rather than the CBD's.
  // A store list ordered by somebody else's position is worse than an unordered
  // one, and only the caller knows whether the customer said yes.
  const query = origin ? `?lat=${origin.latitude}&lng=${origin.longitude}` : '';
  const remote = await request<Store[]>(`/v1/stores${query}`, { parse: checkedStores });
  return resolveAgainstCustomer(remote, origin, new Date());
}

export async function fetchStoresForFulfilment(
  fulfilmentType: FulfilmentType,
  origin: Coordinates | null = null,
): Promise<Store[]> {
  const list = await fetchStores(origin);
  return list.filter((store) => {
    if (fulfilmentType === 'delivery') return store.supportsDelivery;
    if (fulfilmentType === 'collection') return store.supportsCollection;
    return store.supportsDineIn;
  });
}

export async function fetchStore(storeId: string): Promise<Store> {
  /**
   * One branch, with no distance on it.
   *
   * This endpoint is reached without an origin, so it has nothing to measure
   * from — and the seed carries a `distanceKm` field, which it was passing
   * straight through. Dropping it is what makes the badge disappear rather than
   * read "0 m away" for whichever branch the customer opened.
   */
  const strip = ({ distanceKm: _seeded, ...store }: Store): Store => store;

  if (config.useMockApi) {
    const store = stores.find((candidate) => candidate.id === storeId);
    if (!store) throw new Error('Store not found');
    return delay(strip({ ...store, isOpenNow: isTradingNow(store) }), 160);
  }
  const remote = await request<Store>(`/v1/stores/${encodeURIComponent(storeId)}`, {
    parse: checkedStore,
  });
  return strip({ ...remote, isOpenNow: isTradingNow(remote) });
}

/**
 * The closest branch that can do this kind of order, or null when the app has
 * no idea where the customer is — in which case there is no such thing as the
 * nearest and answering with one is guessing.
 */
export async function fetchNearestStore(
  origin: Coordinates | null,
  fulfilmentType: FulfilmentType = 'delivery',
): Promise<Store | null> {
  if (!origin) return null;
  const list = await fetchStoresForFulfilment(fulfilmentType, origin);
  return list[0] ?? null;
}

/**
 * The hours logic now lives in `@/utils/tradingHours`, because the fulfilment
 * store needs it too and should not have to import the network layer to ask
 * what time a shop shuts. Re-exported here so the screens that already read it
 * off the store service keep working.
 */
export { hoursForDay, isStoreOpenAt, isTradingNow } from '@/utils/tradingHours';
