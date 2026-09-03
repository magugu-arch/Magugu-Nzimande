import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Address, FulfilmentType, Store } from '@/types';
import { supportsFulfilment } from '@/utils/fulfilment';
import { distanceKm, type Coordinates } from '@/utils/geo';
import { formatShortDate, formatTime } from '@/utils/datetime';
import { closureReason, isStoreOpenAt, isTradingNow } from '@/utils/tradingHours';
import { track } from '@/ux/analytics';

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
 * Three answers, not two. `'unknown'` is the one that had to be added, and the
 * commonest: the add-address form has no geocoder behind it, so an address a
 * customer typed carries no coordinates at all.
 *
 * It used to carry `DEFAULT_COORDINATES` — the Johannesburg CBD — stamped on by
 * the form under a comment saying a real implementation would geocode here.
 * That was fine while nothing read the field. This function reads it, and the
 * pair of them decided where a customer lived from a constant: measured from
 * the CBD, six of the seven seeded branches sit outside their own 10 km radius
 * and one sits inside it, so every typed-in address in the country was refused
 * by six branches and accepted by Rosebank. Someone standing across the road
 * from bb.q Chicken Sandton City was told it does not deliver to Sandhurst.
 *
 * Straight-line understates road distance, so `'out'` is generous by design —
 * the point is to refuse the order from another province, not to shave the last
 * kilometre off a delivery the driver would have taken.
 */
export type DeliveryRange = 'in' | 'out' | 'unknown';

export function deliveryRange(store: Store, address: Address): DeliveryRange {
  const { latitude, longitude } = address;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return 'unknown';

  const km = distanceKm(
    { latitude: store.latitude, longitude: store.longitude },
    { latitude: latitude as number, longitude: longitude as number },
  );
  return km <= store.deliveryRadiusKm ? 'in' : 'out';
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
  /**
   * A branch shut by its own flag cannot be scheduled around.
   *
   * The rule below offers "schedule for later" and the scheduling checks after
   * it validate the chosen time against the *timetable*. For a branch closed
   * because it is three in the morning that is exactly right. For one whose
   * kitchen has declared itself shut while its published hours say it is open,
   * it is a way straight through: pick a time an hour from now, the timetable
   * says the branch is open then, every check passes, and the order goes to a
   * kitchen that has told the app it is not cooking.
   *
   * Nothing had ever exercised it because every seeded branch was open. The
   * comment on the scheduling rule below says it exists to stop scheduling
   * being a way around the closed-kitchen rule; it stopped it for one of the
   * two ways a kitchen closes.
   *
   * An unplanned closure carries no reopening time, so there is no later to
   * schedule for and the copy does not pretend otherwise.
   */
  const closure = closureReason(store, now);
  if (closure === 'unavailable') {
    return `${store.name} is not taking orders right now`;
  }

  if (closure === 'hours' && !scheduledFor) return `${store.name} is closed — schedule for later`;

  // A scheduled time is chosen once and then sat on, and nothing rechecked it.
  // Verified in a browser: pick 18:00 at five o'clock, put the phone down,
  // place the order at half past seven — accepted, and the confirmation read
  // "Scheduled for Mon, 24 Aug · 18:00", ninety minutes in the past.
  //
  // This is the check that stops "schedule for later" being a way around the
  // closed-kitchen rule directly above it.
  if (scheduledFor) {
    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) return 'Pick a time for your order';
    if (when.getTime() <= now.getTime()) return 'That time has passed — pick another';
    // Same fallback as everywhere else: no published hours means no opinion,
    // not a refusal.
    if (store.openingHours.length > 0 && !isStoreOpenAt(store, when)) {
      return `${store.name} is closed at ${formatTime(when)} — pick another time`;
    }
  }

  if (fulfilmentType === 'delivery' && !address) return 'Add a delivery address';

  // How far the branch will actually drive. Nothing enforced this, which did
  // not show while the seeded store list covered four cities; against a real
  // network of two, most addresses in the country are out of range and were
  // being quoted a delivery anyway.
  //
  // Only a measured `'out'` refuses. An address nobody has located is let
  // through, because the alternative is refusing a delivery on the strength of
  // a coordinate the app made up — which is exactly what it was doing. This
  // leaves the other half open: an address that really is out of range is
  // accepted, because there is no geocoder to say otherwise. That is a gap in
  // what the app can know rather than in what it does with what it knows, and
  // `audit:launch` names it.
  if (fulfilmentType === 'delivery' && address && deliveryRange(store, address) === 'out') {
    return `${store.name} does not deliver to ${address.suburb} — collect instead`;
  }
  if (fulfilmentType === 'dinein' && tableNumber.trim().length === 0) {
    return 'Enter your table number';
  }

  // Dine-in at a closed store makes no sense even scheduled: there is nowhere
  // to sit until it opens.
  if (fulfilmentType === 'dinein' && closure !== null) {
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
  /**
   * Everything about the person, gone — for a sign-out or an expired session.
   *
   * `reset` is the after-an-order clear and deliberately keeps the device's
   * coordinates, because the same customer is still standing in the same
   * place. This is the other thing entirely: a different person is about to
   * use this phone.
   */
  forgetPerson: () => void;

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
        // §15 `select_fulfilment` — the event the "fulfilment mix" dashboard is
        // built from. Here rather than in the switcher component, because Home,
        // checkout and onboarding all set this and only one of them is a
        // switcher.
        track('select_fulfilment', { fulfilment: fulfilmentType });

        set((state) => {
          // A store chosen for one fulfilment type may not support another.
          const keepsStore =
            state.store === null || supportsFulfilment(state.store, fulfilmentType);

          return {
            fulfilmentType,
            store: keepsStore ? state.store : null,
            ...(fulfilmentType === 'dinein' ? {} : { tableNumber: '' }),
          };
        });
      },

      setStore: (store) => {
        // §15 `select_store`. `isOpen` rides along because "chose a branch that
        // was shut" and "chose a branch that was open" are different events for
        // anyone reading a drop-off chart, and the two are indistinguishable
        // from a store id alone.
        if (store) {
          track('select_store', {
            storeId: store.id,
            fulfilment: get().fulfilmentType,
            isOpen: isTradingNow(store, new Date()),
          });
        }
        set({ store });
      },
      setAddress: (address) => set({ address, deliveryInstructions: address?.instructions ?? '' }),
      setDeliveryInstructions: (deliveryInstructions) => set({ deliveryInstructions }),
      setTableNumber: (tableNumber) => set({ tableNumber }),
      setScheduledFor: (scheduledFor) => set({ scheduledFor }),
      setCoordinates: (coordinates) => set({ coordinates }),
      markLocationPermissionAsked: () => set({ locationPermissionAsked: true }),

      /**
       * The end of an order, not the end of a customer.
       *
       * What this clears is what belonged to the order that just went through:
       * the table they were sitting at, the slot they picked, the branch it
       * went to. What it keeps is what is still true a minute later — the same
       * person is still at the same address, with the same note for the
       * driver.
       *
       * It used to null the address too, and that is the whole of why a
       * returning customer was met with "Add a delivery address" on every
       * order after their first. Same reasoning as `coordinates` below: an
       * order ending does not move anybody.
       */
      reset: () =>
        set({
          store: null,
          tableNumber: '',
          scheduledFor: null,
        }),

      forgetPerson: () =>
        set({
          fulfilmentType: 'delivery',
          store: null,
          address: null,
          deliveryInstructions: '',
          tableNumber: '',
          scheduledFor: null,
          // Where they live. The one field `reset` keeps on purpose and this
          // must not.
          coordinates: null,
          // Kept: whether the OS permission sheet has been shown is a fact
          // about the handset, not about whoever is holding it.
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
