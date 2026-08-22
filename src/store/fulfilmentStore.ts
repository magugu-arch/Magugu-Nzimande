import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Address, FulfilmentType, Store } from '@/types';
import type { Coordinates } from '@/utils/geo';

/**
 * Where and how this order is being fulfilled: type, store, address, table and
 * scheduling. Checkout reads from here rather than passing a dozen params
 * between screens.
 */

interface FulfilmentState {
  fulfilmentType: FulfilmentType;
  store: Store | null;
  address: Address | null;
  deliveryInstructions: string;
  tableNumber: string;
  /** ISO timestamp, or null for "as soon as possible". */
  scheduledFor: string | null;
  /** Last known device location; drives nearest-store ordering. */
  coordinates: Coordinates | null;
  locationPermissionAsked: boolean;

  setFulfilmentType: (fulfilmentType: FulfilmentType) => void;
  setStore: (store: Store | null) => void;
  setAddress: (address: Address | null) => void;
  setDeliveryInstructions: (instructions: string) => void;
  setTableNumber: (tableNumber: string) => void;
  setScheduledFor: (scheduledFor: string | null) => void;
  setCoordinates: (coordinates: Coordinates | null) => void;
  markLocationPermissionAsked: () => void;
  reset: () => void;

  /** True when everything checkout needs for this fulfilment type is present. */
  isReadyForCheckout: () => boolean;
  /** What is still missing, phrased for the customer. */
  missingRequirement: () => string | null;
}

export const useFulfilmentStore = create<FulfilmentState>()(
  persist(
    (set, get) => ({
      fulfilmentType: 'delivery',
      store: null,
      address: null,
      deliveryInstructions: '',
      tableNumber: '',
      scheduledFor: null,
      coordinates: null,
      locationPermissionAsked: false,

      setFulfilmentType: (fulfilmentType) => {
        set((state) => {
          // A store chosen for one fulfilment type may not support another.
          const keepsStore =
            state.store === null ||
            (fulfilmentType === 'delivery' && state.store.supportsDelivery) ||
            (fulfilmentType === 'collection' && state.store.supportsCollection) ||
            (fulfilmentType === 'dinein' && state.store.supportsDineIn);

          return {
            fulfilmentType,
            store: keepsStore ? state.store : null,
            ...(fulfilmentType === 'dinein' ? {} : { tableNumber: '' }),
          };
        });
      },

      setStore: (store) => set({ store }),
      setAddress: (address) =>
        set({ address, deliveryInstructions: address?.instructions ?? '' }),
      setDeliveryInstructions: (deliveryInstructions) => set({ deliveryInstructions }),
      setTableNumber: (tableNumber) => set({ tableNumber }),
      setScheduledFor: (scheduledFor) => set({ scheduledFor }),
      setCoordinates: (coordinates) => set({ coordinates }),
      markLocationPermissionAsked: () => set({ locationPermissionAsked: true }),

      reset: () =>
        set({
          store: null,
          address: null,
          deliveryInstructions: '',
          tableNumber: '',
          scheduledFor: null,
        }),

      isReadyForCheckout: () => get().missingRequirement() === null,

      missingRequirement: () => {
        const { fulfilmentType, store, address, tableNumber } = get();
        if (!store) return 'Choose a store';
        if (fulfilmentType === 'delivery' && !address) return 'Add a delivery address';
        if (fulfilmentType === 'dinein' && tableNumber.trim().length === 0) {
          return 'Enter your table number';
        }
        return null;
      },
    }),
    {
      name: 'bbq.fulfilment',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        fulfilmentType: state.fulfilmentType,
        store: state.store,
        address: state.address,
        deliveryInstructions: state.deliveryInstructions,
        coordinates: state.coordinates,
        locationPermissionAsked: state.locationPermissionAsked,
      }),
    },
  ),
);
