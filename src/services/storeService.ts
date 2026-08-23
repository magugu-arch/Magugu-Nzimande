import { config } from '@/constants/config';
import type { FulfilmentType, Store } from '@/types';
import { distanceKm, DEFAULT_COORDINATES, type Coordinates } from '@/utils/geo';
import { isTradingNow } from '@/utils/tradingHours';
import { delay, request } from './apiClient';
import { stores } from './data/storeData';

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
 */
function resolveAgainstCustomer(list: Store[], origin: Coordinates, now: Date): Store[] {
  return list
    .map((store) => ({
      ...store,
      distanceKm: distanceKm(origin, { latitude: store.latitude, longitude: store.longitude }),
      isOpenNow: isTradingNow(store, now),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function fetchStores(origin: Coordinates = DEFAULT_COORDINATES): Promise<Store[]> {
  if (config.useMockApi) return delay(resolveAgainstCustomer(stores, origin, new Date()));

  const remote = await request<Store[]>(
    `/v1/stores?lat=${origin.latitude}&lng=${origin.longitude}`,
  );
  return resolveAgainstCustomer(remote, origin, new Date());
}

export async function fetchStoresForFulfilment(
  fulfilmentType: FulfilmentType,
  origin: Coordinates = DEFAULT_COORDINATES,
): Promise<Store[]> {
  const list = await fetchStores(origin);
  return list.filter((store) => {
    if (fulfilmentType === 'delivery') return store.supportsDelivery;
    if (fulfilmentType === 'collection') return store.supportsCollection;
    return store.supportsDineIn;
  });
}

export async function fetchStore(storeId: string): Promise<Store> {
  if (config.useMockApi) {
    const store = stores.find((candidate) => candidate.id === storeId);
    if (!store) throw new Error('Store not found');
    return delay({ ...store, isOpenNow: isTradingNow(store) }, 160);
  }
  const remote = await request<Store>(`/v1/stores/${encodeURIComponent(storeId)}`);
  return { ...remote, isOpenNow: isTradingNow(remote) };
}

export async function fetchNearestStore(
  origin: Coordinates = DEFAULT_COORDINATES,
  fulfilmentType: FulfilmentType = 'delivery',
): Promise<Store | null> {
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
