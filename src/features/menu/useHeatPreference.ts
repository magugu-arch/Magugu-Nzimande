import { useAuthStore } from '@/store/authStore';

/**
 * Whether this customer asked for the gentler flavours first.
 *
 * A hook rather than a prop threaded through every call site: the cards and
 * rows are rendered from eight places — the menu, search results, favourites,
 * Home's carousels, the category tiles, the product screen's recommendations,
 * reorder and the cart — and a prop that eight call sites have to remember to
 * pass is a rule seven of them will eventually forget. That is how the
 * preference came to be read by nobody in the first place.
 *
 * Kept out of `heat.ts` on purpose. The rules there are pure functions with no
 * React and no store behind them, which is what lets a test state them
 * directly; this is the one line that reaches for state.
 */
export function useHeatPreference(): boolean {
  return useAuthStore((state) => state.preferences.preferMildFirst);
}
