import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Address, FulfilmentType, Store } from '@/types';
import { distanceKm, type Coordinates } from '@/utils/geo';
import { formatShortDate } from '@/utils/datetime';
import { isTradingNow } from '@/utils/tradingHours';

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
  /** Injected so the opening-date rule is testable without mocking the clock. */
  now?: Date;
}

/** Whether this branch is listed but not yet trading. */
export function isOpeningLater(store: Store, now: Date = new Date()): boolean {
  if (!store.opensOn) return false;
  const opens = new Date(store.opensOn);
  if (Number.isNaN(opens.getTime())) return false;
  return opens.getTime() > now.getTime();
}

/**
 * Whether a branch will deliver to an address, by straight-line distance.
 *
 * Straight-line understates road distance, so this is generous by design — the
 * point is to refuse the order from another province, not to shave the last
 * kilometre off a delivery the driver would have taken.
 */
export function deliversTo(store: Store, address: Address): boolean {
  return (
    distanceKm(
      { latitude: store.latitude, longitude: store.longitude },
      { latitude: address.latitude, longitude: address.longitude },
    ) <= store.deliveryRadiusKm
  );
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
  now = new Date(),
}: FulfilmentRequirements): string | null {
  if (!store) return 'Choose a store';

  // A branch that has not opened yet cannot cook, and scheduling does not help
  // if the schedule horizon ends before the opening date. Checked before the
  // trading-hours rule below, which would otherwise report it as "closed" — a
  // store that opens in six weeks is not the same thing as one that shut at
  // ten last night, and telling a customer to schedule for later is wrong.
  if (isOpeningLater(store, now)) {
    return `${store.name} opens on ${formatShortDate(store.opensOn!)}`;
  }

  // A shut kitchen cannot cook. Nothing stopped an order going to a closed
  // store before this — the screens showed "Closed" on the store card and then
  // took the money anyway. Scheduling for later is the exception: that is
  // exactly what a customer ordering out of hours wants to do.
  //
  // Asked of the timetable, not of `store.isOpenNow` alone. This store is
  // persisted whole, so the flag here can be days old — and while it was
  // trusted, the guard could not fire at all: an order placed at 03:30 went
  // through against a branch that shut at 22:00.
  const trading = isTradingNow(store, now);
  if (!trading && !scheduledFor) return `${store.name} is closed — schedule for later`;

  if (fulfilmentType === 'delivery' && !address) return 'Add a delivery address';

  // How far the branch will actually drive. Nothing enforced this, which did
  // not show while the seeded store list covered four cities; against a real
  // network of two, most addresses in the country are out of range and were
  // being quoted a delivery anyway.
  if (fulfilmentType === 'delivery' && address && !deliversTo(store, address)) {
    return `${store.name} does not deliver to ${address.suburb} — collect instead`;
  }
  if (fulfilmentType === 'dinein' && tableNumber.trim().length === 0) {
    return 'Enter your table number';
  }

  // Dine-in at a closed store makes no sense even scheduled: there is nowhere
  // to sit until it opens.
  if (fulfilmentType === 'dinein' && !trading) {
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
