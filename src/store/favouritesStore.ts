import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isStringArray, keepValid, PERSIST_VERSION } from '@/store/persistence';
import { config } from '@/constants/config';

/**
 * Dishes already hearted, on a demo build only.
 *
 * Nothing had ever put anything in this list, and three surfaces are hidden
 * until it is non-empty: Home's "Your favourites" carousel, which onboarding
 * promises will keep them "one tap away"; the Menu tab's Favourites filter;
 * and the filled heart on every row and card. All three were written, styled
 * and shipped for a list that was empty by construction.
 *
 * Local rather than seeded into `accountService`'s ledger, and deliberately.
 * That ledger is keyed by a customer id derived from whatever email is typed
 * at sign-in, so seeding it would either belong to every account or belong to
 * the audit harness's own address — the first is the bug the file warns about
 * and the second is rigging the sweep. A favourite is device state; this is
 * the device.
 *
 * `claimFor` keeps it: `ownerId` starts null, and claiming an unowned list
 * sets the owner without clearing it — a guest may be the same person, signed
 * out for a moment. Signing in as somebody else still empties it.
 *
 * Cheesling Fries is in here on purpose. Its sizes have all been withdrawn, so
 * it is a favourite that cannot currently be ordered — which is the state a
 * real favourites list reaches within a week, and the one the carousel had
 * never been asked to draw.
 */
const SEEDED_FAVOURITES = ['honey-garlic', 'cheesling-fries', 'korean-rice-bowl'];

/**
 * Products the customer has hearted.
 *
 * Onboarding promises to "keep your favourites one tap away" and the sign-in
 * screen offers to "reorder your favourites", so the app owed them a way to
 * mark one. §23.6's icon set names a Heart for exactly this.
 *
 * Local and persisted rather than server-side: a favourite is a preference,
 * not a transaction, and it should survive a signed-out browse and still be
 * there when they come back. Syncing it to an account is a backend concern —
 * `POST /v1/account/favourites` when there is a backend to send it to.
 *
 * Stored as an array because JSON has no Set, and read through a Set so the
 * hot path (is this one hearted?) stays O(1) on a long menu.
 */
interface FavouritesState {
  productIds: string[];
  /**
   * Whose these are, so they can outlive a sign-out without outliving the
   * person.
   *
   * Surviving a signed-out browse is the point of keeping them local, and
   * `useSignOut` deliberately leaves them alone for that reason. But nothing
   * asked whose they were, so signing in as somebody else showed them a
   * stranger's hearted dishes as their own — and the menu has a Favourites tab
   * to show them on.
   *
   * Null while nobody is signed in, which is the state a guest browse leaves
   * it in: unclaimed, not owned by nobody.
   */
  ownerId: string | null;
  isFavourite: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /**
   * Hand the list to whoever has just signed in, emptying it first if it
   * belonged to somebody else.
   *
   * A guest (`null`) claims nothing and clears nothing — they may be the same
   * person, signed out for a moment, and taking their favourites away for
   * browsing is the behaviour this store was written to avoid.
   */
  claimFor: (userId: string | null) => void;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      productIds: config.useMockApi ? [...SEEDED_FAVOURITES] : [],
      ownerId: null,

      isFavourite: (productId) => get().productIds.includes(productId),

      toggle: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds.filter((id) => id !== productId)
            : // Newest first, so the list reads as a history of what they liked
              // rather than whatever order the menu happened to be in.
              [productId, ...state.productIds],
        })),

      remove: (productId) =>
        set((state) => ({ productIds: state.productIds.filter((id) => id !== productId) })),

      clear: () => set({ productIds: [] }),

      claimFor: (userId) =>
        set((state) => {
          if (userId === null) return state;
          if (state.ownerId !== null && state.ownerId !== userId) {
            return { productIds: [], ownerId: userId };
          }
          return { ownerId: userId };
        }),
    }),
    {
      name: 'bbq.favourites',
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      // The owner is persisted too, or the check cannot survive the restart it
      // most needs to survive: a phone handed over and opened fresh.
      partialize: (state) => ({ productIds: state.productIds, ownerId: state.ownerId }),
      /*
        This one never crashed, and is guarded anyway. `productIds` is read
        with `.map` and `.filter` on Home and behind a menu filter, so a value
        that is not an array is the same class of failure the cart had; it has
        simply never been written as one. A guard that only covers the shapes
        that have already broken is a guard against the past.
      */
      merge: (persisted, current) => ({
        ...current,
        ...keepValid<{ productIds: string[]; ownerId: string | null }>(persisted, {
          productIds: isStringArray,
          ownerId: (value: unknown) => value === null || typeof value === 'string',
        }),
      }),
    },
  ),
);

/**
 * Subscribe to one product's state without re-rendering on every other change.
 *
 * A menu of sixteen rows each subscribing to the whole array would re-render
 * all of them on every heart. This selects a boolean, so only the row that
 * changed re-renders.
 */
export function useIsFavourite(productId: string): boolean {
  return useFavouritesStore((state) => state.productIds.includes(productId));
}

export function useFavouriteCount(): number {
  return useFavouritesStore((state) => state.productIds.length);
}
