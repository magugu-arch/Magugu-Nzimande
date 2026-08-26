import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import type { FulfilmentType } from '@/types';
import { queryKeys } from '@/services/queryKeys';
import { fetchStore, fetchStores, fetchStoresForFulfilment } from '@/services/storeService';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import type { Coordinates } from '@/utils/geo';

/**
 * Where the customer is, or null.
 *
 * Both hooks used to fall back to `DEFAULT_COORDINATES` when nothing was known,
 * which is how a customer who declined the location prompt got a store list
 * sorted "nearest first" and badged with distances measured from the
 * Johannesburg CBD. Null travels all the way down to `resolveAgainstCustomer`,
 * which then supplies no distance at all.
 */
function originFor(coordinates: Coordinates | null, override?: Coordinates) {
  return override ?? coordinates ?? null;
}

/** A cache key that distinguishes "at these coordinates" from "no idea". */
function keyFor(origin: Coordinates | null) {
  return origin ? queryKeys.stores(origin.latitude, origin.longitude) : queryKeys.storesAnywhere();
}

export function useStores(origin?: Coordinates) {
  const coordinates = useFulfilmentStore((state) => state.coordinates);
  const resolved = originFor(coordinates, origin);

  return useQuery({
    queryKey: keyFor(resolved),
    queryFn: () => fetchStores(resolved),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStoresForFulfilment(fulfilmentType: FulfilmentType) {
  const coordinates = useFulfilmentStore((state) => state.coordinates);
  const resolved = originFor(coordinates);

  return useQuery({
    queryKey: [...keyFor(resolved), fulfilmentType],
    queryFn: () => fetchStoresForFulfilment(fulfilmentType, resolved),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStore(storeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.store(storeId ?? ''),
    queryFn: () => fetchStore(storeId as string),
    enabled: Boolean(storeId),
  });
}

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

/**
 * Foreground location request.
 *
 * Denial is a supported outcome, not an error: the app falls back to the
 * default centre and the customer picks a store by hand.
 */
export function useDeviceLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const setCoordinates = useFulfilmentStore((state) => state.setCoordinates);
  const markAsked = useFulfilmentStore((state) => state.markLocationPermissionAsked);

  const requestLocation = useCallback(async (): Promise<Coordinates | null> => {
    setStatus('requesting');
    markAsked();

    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setStatus('denied');
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinates: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setCoordinates(coordinates);
      setStatus('granted');
      return coordinates;
    } catch {
      setStatus('unavailable');
      return null;
    }
  }, [markAsked, setCoordinates]);

  return { status, requestLocation };
}
