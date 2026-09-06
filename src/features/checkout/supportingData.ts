import { didNotArrive, isOfflinePending, type PhasedQuery } from '@/features/system/queryPhase';

/**
 * What checkout is entitled to say when its supporting data never turned up.
 *
 * ── What the screen did ────────────────────────────────────────────────────
 * Checkout renders from the cart, so it has no loading or error branch of its
 * own — and it reads three queries it does not own: the customer's saved
 * cards, their saved addresses, and the branches that can take this order.
 * Each was read as `query.data ?? []`.
 *
 * Driven in Chromium against a dead API host, with a signed-in customer and an
 * item in the basket, the whole screen came up looking perfectly ordinary:
 *
 *     Cooked at      Choose a store
 *     Delivering to  Add a delivery address
 *     Payment        SnapScan · Instant EFT · Cash on delivery
 *
 * Every line of that is a lie, and the worst of them is the payment section.
 * `offeredPaymentMethods` falls back to the standing rails when the saved list
 * is empty — which is right, and is there so a customer who has just installed
 * the app can pay at all. An empty list because the customer is new and an
 * empty list because the request failed are indistinguishable to it, so a
 * customer with three saved cards was shown the new-customer screen: their
 * cards gone, no explanation, and SnapScan sitting where their Visa was.
 *
 * The other two rows say the customer has no address and has chosen no branch.
 * The pickers behind them are honest — both use `isOfflinePending` — but the
 * customer has to tap through to find out, and the screen they tapped from
 * told them the opposite.
 *
 * `audit:offline` never saw any of it, because `/checkout` is not one of its
 * eleven routes: it needs a basket, and the route that needs setting up is the
 * route that goes unswept. It is also the route where the money is.
 *
 * ── What it says now ───────────────────────────────────────────────────────
 * Nothing is blocked and nothing is blanked. A customer on a bad connection
 * can still pay by a rail, which is exactly what the rails are for. What
 * changes is that the screen stops presenting an absence as a fact:
 *
 *     Cooked at      Couldn't load branches
 *     Delivering to  Couldn't load your addresses
 *     Payment        We couldn't load your saved cards — Try again
 *
 * The same rule the rest of the app follows: an empty state is a claim about
 * the world, an error state is a claim about the app.
 */

/** The saved-card list is missing, so the rails are not "your options". */
export function savedCardsUnavailable(cards: PhasedQuery): boolean {
  return didNotArrive(cards);
}

/**
 * The sentence under the Payment heading when the cards did not arrive.
 *
 * Two versions, because the app can often tell which of two quite different
 * things happened, and `audit:offline` exists to insist that it says so. A
 * paused query means this device has no connection; anything else means the
 * request was made and did not come back, which is bb.q's problem and not the
 * customer's lift.
 *
 * "Something went wrong" for a phone in a basement is honest and worse than it
 * needs to be — it reads as a fault in the app, and the customer restarts it,
 * and it happens again.
 */
export function savedCardsNotice(cards: PhasedQuery): string {
  return isOfflinePending(cards)
    ? "You're offline, so we couldn't load your saved cards. You can still pay another way."
    : "We couldn't load your saved cards. You can still pay another way.";
}

/**
 * What the branch row should read when no branch is chosen.
 *
 * Takes the query rather than a boolean so the call site cannot get the
 * question the wrong way round, and returns the ordinary prompt untouched
 * whenever the data did arrive — an empty list of branches is still a real
 * answer, and "Choose a store" is the right thing to say to somebody who has
 * simply not chosen one yet.
 */
export function storeRowValue(stores: PhasedQuery, chosen: string | undefined): string {
  if (chosen !== undefined) return chosen;
  return didNotArrive(stores) ? "Couldn't load branches" : 'Choose a store';
}

/** The same, for the address row. */
export function addressRowValue(addresses: PhasedQuery, chosen: string | undefined): string {
  if (chosen !== undefined) return chosen;
  return didNotArrive(addresses) ? "Couldn't load your addresses" : 'Add a delivery address';
}

/**
 * The reason the button is disabled, said as the app's problem when it is one.
 *
 * `blocker` told the customer to choose a store or add an address — an
 * instruction they cannot follow, because the picker cannot load either. It is
 * the difference between "you have not done this yet" and "we cannot show you
 * the list", and a customer given the first will tap the row, find an error,
 * come back and read the same instruction again.
 *
 * Returns null when the app has no complaint of its own to make, which leaves
 * `blocker`'s ordinary wording exactly as it was.
 */
export function unreachableBlocker(args: {
  needsStore: boolean;
  needsAddress: boolean;
  stores: PhasedQuery;
  addresses: PhasedQuery;
}): string | null {
  const { needsStore, needsAddress, stores, addresses } = args;

  // The branch first: an order with no kitchen behind it cannot be placed
  // whatever address it is going to, and a customer told about both at once is
  // told about neither.
  if (needsStore && didNotArrive(stores)) {
    return isOfflinePending(stores)
      ? "You're offline, so we couldn't load the branches near you"
      : "We couldn't load the branches near you";
  }
  if (needsAddress && didNotArrive(addresses)) {
    return isOfflinePending(addresses)
      ? "You're offline, so we couldn't load your saved addresses"
      : "We couldn't load your saved addresses";
  }
  return null;
}
