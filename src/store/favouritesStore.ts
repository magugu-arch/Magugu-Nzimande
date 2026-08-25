import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      productIds: [],
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
      storage: createJSONStorage(() => AsyncStorage),
      // The owner is persisted too, or the check cannot survive the restart it
      // most needs to survive: a phone handed over and opened fresh.
      partialize: (state) => ({ productIds: state.productIds, ownerId: state.ownerId }),
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
