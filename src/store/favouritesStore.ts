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
  isFavourite: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      productIds: [],

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
    }),
    {
      name: 'bbq.favourites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ productIds: state.productIds }),
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
