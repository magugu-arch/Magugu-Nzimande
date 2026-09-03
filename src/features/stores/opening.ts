import type { Address, Store } from '@/types';
import { deliveryRange, isOpeningLater } from '@/store/fulfilmentStore';
import { isTradingNow } from '@/utils/tradingHours';

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
 * So: the first branch that could actually take the order, and only if none
 * can, the first branch at all. Falling back rather than returning nothing
 * matters — "opens on 1 November" tells a customer something, and "Choose a
 * store" from an empty list tells them nothing.
 *
 * `address` is the second half of "could actually take the order", and it had
 * to be added the moment the store list stopped being sorted by distance for
 * customers the app cannot locate. Alphabetically, bb.q Chicken Canal Walk is
 * first — so a Johannesburg customer who declined the location prompt arrived
 * at checkout with a Cape Town branch chosen for them and the order blocked on
 * "does not deliver to Melrose Arch", for a branch they never picked and a
 * reason that was not their fault. The same shape as the opening-date case
 * above, and it deserves the same treatment rather than a different one.
 *
 * A branch is skipped only for a *measured* refusal. An address nobody has
 * located rules nothing out, exactly as it refuses nothing at checkout.
 */
export function preferredStore(
  stores: Store[],
  now: Date = new Date(),
  address: Address | null = null,
): Store | undefined {
  /**
   * First in the list, which is nearest only when the app has a location.
   *
   * It used to be nearest always, because the store service measured every
   * branch from the Johannesburg CBD when it had no coordinates — so "nearest"
   * meant "nearest to the CBD" for a customer in Durban. That is gone: with no
   * location the list arrives alphabetically and carries no distances, so this
   * returns a branch rather than a recommendation.
   *
   * Deliberately still returns one. Checkout names it plainly on a card the
   * customer taps to change, and claims nothing about it being close — the
   * label reads "Cooked at", not "Nearest". A default they can see and change
   * is better than a blocker, and with two branches opening it is a choice
   * between two.
   */
  /**
   * A branch that has declared itself shut is the third way this goes wrong,
   * and it was the one this function did not ask about.
   *
   * The two cases above are both "a customer arrives at checkout, finds a
   * branch chosen for them, and is blocked on it for a reason that is not
   * their fault". A branch flagged closed by its own kitchen is exactly that
   * again — and it went unnoticed because every seeded store was open, so
   * `isTradingNow` had nothing to exclude and nothing to prove it should.
   * `audit:coldstart` found it the moment one branch was seeded shut: a new
   * customer was dropped into "bb.q Chicken Menlyn Park is not taking orders
   * right now" for a branch they had never heard of.
   *
   * Only the flag matters here, not the timetable. Outside trading hours
   * *nothing* is trading, and the fallback below would hand back the same
   * branch anyway — but skipping a branch shut for the night, when the next
   * one is shut too, would be work that changes no answer. `isTradingNow`
   * covers both and the fallback chain handles the case where it excludes
   * everything.
   */
  const canTakeIt = (store: Store) =>
    !isOpeningLater(store, now) &&
    isTradingNow(store, now) &&
    (!address || deliveryRange(store, address) !== 'out');

  return stores.find(canTakeIt) ?? stores.find((store) => !isOpeningLater(store, now)) ?? stores[0];
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
