import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import type { FulfilmentType } from '@/types';
import { queryKeys } from '@/services/queryKeys';
import { fetchStore, fetchStores, fetchStoresForFulfilment } from '@/services/storeService';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { DEFAULT_COORDINATES, type Coordinates } from '@/utils/geo';

export function useStores(origin?: Coordinates) {
  const coordinates = useFulfilmentStore((state) => state.coordinates);
  const resolved = origin ?? coordinates ?? DEFAULT_COORDINATES;

  return useQuery({
    queryKey: queryKeys.stores(resolved.latitude, resolved.longitude),
    queryFn: () => fetchStores(resolved),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStoresForFulfilment(fulfilmentType: FulfilmentType) {
  const coordinates = useFulfilmentStore((state) => state.coordinates);
  const resolved = coordinates ?? DEFAULT_COORDINATES;

  return useQuery({
    queryKey: [...queryKeys.stores(resolved.latitude, resolved.longitude), fulfilmentType],
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
