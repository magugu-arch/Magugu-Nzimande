import { config } from '@/constants/config';
import type { FulfilmentType, Store } from '@/types';
import { distanceKm, DEFAULT_COORDINATES, type Coordinates } from '@/utils/geo';
import { delay, request } from './apiClient';
import { stores } from './data/storeData';

/**
 * Store locator service. Distances are recomputed against the customer's real
 * coordinates rather than trusting the seed values.
 */

function withDistances(list: Store[], origin: Coordinates): Store[] {
  return list
    .map((store) => ({
      ...store,
      distanceKm: distanceKm(origin, { latitude: store.latitude, longitude: store.longitude }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function fetchStores(origin: Coordinates = DEFAULT_COORDINATES): Promise<Store[]> {
  if (config.useMockApi) return delay(withDistances(stores, origin));

  const remote = await request<Store[]>(
    `/v1/stores?lat=${origin.latitude}&lng=${origin.longitude}`,
  );
  return withDistances(remote, origin);
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
    return delay(store, 160);
  }
  return request<Store>(`/v1/stores/${encodeURIComponent(storeId)}`);
}

export async function fetchNearestStore(
  origin: Coordinates = DEFAULT_COORDINATES,
  fulfilmentType: FulfilmentType = 'delivery',
): Promise<Store | null> {
  const list = await fetchStoresForFulfilment(fulfilmentType, origin);
  return list[0] ?? null;
}

/** Trading window for a given weekday, or null when closed that day. */
export function hoursForDay(
  store: Store,
  day: number,
): { opensAt: string; closesAt: string } | null {
  const entry = store.openingHours.find((hours) => hours.day === day);
  return entry ? { opensAt: entry.opensAt, closesAt: entry.closesAt } : null;
}

export function isStoreOpenAt(store: Store, when: Date = new Date()): boolean {
  const hours = hoursForDay(store, when.getDay());
  if (!hours) return false;

  const [openHour = 0, openMinute = 0] = hours.opensAt.split(':').map(Number);
  const [closeHour = 0, closeMinute = 0] = hours.closesAt.split(':').map(Number);
  const minutesNow = when.getHours() * 60 + when.getMinutes();

  return minutesNow >= openHour * 60 + openMinute && minutesNow < closeHour * 60 + closeMinute;
}
