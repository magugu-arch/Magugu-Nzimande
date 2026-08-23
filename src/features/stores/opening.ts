import type { Store } from '@/types';
import { isOpeningLater } from '@/store/fulfilmentStore';

/**
 * Whether the business is trading at all yet, across every branch.
 *
 * Two branches open this year, a month apart, so there is a real period during
 * which the app exists and nothing can be ordered from it. The app said
 * nothing about that: Home offered "What are we eating?", "Order now" and the
 * full menu, and the customer only met the truth at checkout, after building
 * a cart. Bad news belongs at the top of a funnel, not the bottom.
 *
 * A branch with no `opensOn` counts as trading — an absent date means already
 * open, not unknown.
 */
export interface OpeningStatus {
  /** True when at least one branch is trading, whatever its hours today. */
  anyTrading: boolean;
  /** The soonest opening date among branches not yet trading, if any. */
  nextOpening: string | null;
}

/**
 * The store to pre-select for someone who has not chosen one.
 *
 * Checkout picked the nearest branch outright. With every branch trading that
 * was fine; with one opening in November it means a customer arrives at
 * checkout, finds a store silently chosen for them, and is blocked on it —
 * "bb.q Chicken Gateway opens on Sun, 1 Nov" — for a store they never picked.
 * The message is true and the obvious next action is not the one it suggests.
 *
 * So: the nearest branch that could actually take the order, and only if none
 * can, the nearest branch at all. Falling back rather than returning nothing
 * matters — "opens on 1 November" tells a customer something, and "Choose a
 * store" from an empty list tells them nothing.
 */
export function preferredStore(stores: Store[], now: Date = new Date()): Store | undefined {
  // The list arrives sorted by distance, so first match is nearest match.
  return stores.find((store) => !isOpeningLater(store, now)) ?? stores[0];
}

export function openingStatus(stores: Store[], now: Date = new Date()): OpeningStatus {
  // No stores at all is a loading or failed fetch, not a closed business.
  // Claiming "we open soon" on a network blip would be worse than saying
  // nothing, so this reports trading and lets the screen's own error state
  // speak.
  if (stores.length === 0) return { anyTrading: true, nextOpening: null };

  const pending = stores.filter((store) => isOpeningLater(store, now));
  const anyTrading = pending.length < stores.length;

  const soonest = pending
    .map((store) => store.opensOn as string)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  return { anyTrading, nextOpening: soonest ?? null };
}
