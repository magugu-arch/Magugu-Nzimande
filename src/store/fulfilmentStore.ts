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

/** What this order still needs before it can be placed, or null if nothing. */
export interface FulfilmentRequirements {
  fulfilmentType: FulfilmentType;
  store: Store | null;
  address: Address | null;
  tableNumber: string;
  /** ISO timestamp, or null for "as soon as possible". */
  scheduledFor?: string | null;
}

/**
 * A pure function, not only a store method, and deliberately so.
 *
 * Read through the store it is a stable reference, which makes it invisible to
 * any `useMemo` that depends on it — the memo caches an answer derived from
 * state it never declared, and stops updating. Checkout shipped exactly that:
 * pick a store and the button stayed disabled, still saying "Choose a store".
 * Taking the state as an argument makes the dependency impossible to miss.
 */
export function missingFulfilmentRequirement({
  fulfilmentType,
  store,
  address,
  tableNumber,
  scheduledFor = null,
}: FulfilmentRequirements): string | null {
  if (!store) return 'Choose a store';

  // A shut kitchen cannot cook. Nothing stopped an order going to a closed
  // store before this — the screens showed "Closed" on the store card and then
  // took the money anyway. Scheduling for later is the exception: that is
  // exactly what a customer ordering out of hours wants to do.
  if (!store.isOpenNow && !scheduledFor) return `${store.name} is closed — schedule for later`;

  if (fulfilmentType === 'delivery' && !address) return 'Add a delivery address';
  if (fulfilmentType === 'dinein' && tableNumber.trim().length === 0) {
    return 'Enter your table number';
  }

  // Dine-in at a closed store makes no sense even scheduled: there is nowhere
  // to sit until it opens.
  if (fulfilmentType === 'dinein' && !store.isOpenNow) {
    return `${store.name} is closed`;
  }

  return null;
}

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
      setAddress: (address) => set({ address, deliveryInstructions: address?.instructions ?? '' }),
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

      missingRequirement: () => missingFulfilmentRequirement(get()),
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
