import type { Address, FulfilmentType, Store } from '@/types';
import { preferredAddress } from './preferredAddress';
import { preferredStore } from '@/features/stores/opening';

/**
 * What checkout fills in for somebody who has chosen nothing, and in what order.
 *
 * This began as two effects in the checkout screen — one picking a branch, one
 * picking an address — and it had to become one thing, then a testable thing,
 * because the order they run in decides whether the answer is right.
 *
 * The branch depends on the address. The store list is only sorted by distance
 * when the app knows where the customer is, and it usually does not; with no
 * location it arrives alphabetically, so "first" is a coin toss and a branch
 * that cannot deliver to their address is no more use as a default than one
 * that has not opened yet. `preferredStore` therefore takes the address.
 *
 * Two ways that went wrong in the screen, both invisible until an audit tried
 * to place an order:
 *
 *  1. As two effects, both ran in the same commit — so the store effect read
 *     `address` as null on the very render where the address effect was setting
 *     it. Merging them fixed that.
 *  2. Merged, it still picked blind: the store list resolves before the address
 *     list, so the first run had stores and no addresses. Both guards are
 *     "only when nothing is chosen", so the wrong branch was chosen once and
 *     never revisited. `audit:points` failed on exactly that — "bb.q Chicken
 *     Canal Walk does not deliver to Melrose Arch" for a customer who had
 *     picked neither.
 *
 * So the rule is: for a delivery order, do not choose a branch until the
 * address question has an answer. Waiting is cheap — the effect re-runs when
 * the addresses land — and guessing is not, because the guess is permanent.
 *
 * Pure, and returns what to set rather than setting it, so the ordering can be
 * asserted without a renderer.
 */
export interface CheckoutDefaultsInput {
  fulfilmentType: FulfilmentType;
  /** What the customer has already chosen. Neither is ever overruled. */
  store: Store | null;
  address: Address | null;
  savedAddresses: Address[];
  /**
   * Whether the addresses are still on their way.
   *
   * The reason this function exists. A disabled query — a guest, who has no
   * addresses to fetch — reports false here and rightly does not hold up the
   * branch; so does a query paused for want of a network, which would
   * otherwise leave somebody staring at "Choose a store" forever.
   */
  addressesLoading: boolean;
  availableStores: Store[];
  now?: Date;
}

export interface CheckoutDefaults {
  /** Set this address, or leave it alone. */
  address?: Address;
  /** Set this store, or leave it alone. */
  store?: Store;
}

export function checkoutDefaults({
  fulfilmentType,
  store,
  address,
  savedAddresses,
  addressesLoading,
  availableStores,
  now = new Date(),
}: CheckoutDefaultsInput): CheckoutDefaults {
  const defaults: CheckoutDefaults = {};

  // Only for delivery. Quietly attaching an address to a collection order would
  // put a front door on a receipt for food somebody carried home themselves.
  const forDelivery = fulfilmentType === 'delivery';

  let decidedAddress = forDelivery ? address : null;
  if (forDelivery && !decidedAddress) {
    decidedAddress = preferredAddress(savedAddresses) ?? null;
    if (decidedAddress) defaults.address = decidedAddress;
  }

  if (store) return defaults;

  // The wait. Only when the address could still change the answer: a customer
  // who already has one chosen, or who is collecting, is not held up.
  if (forDelivery && !decidedAddress && addressesLoading) return defaults;

  const suggested = preferredStore(availableStores, now, decidedAddress);
  if (suggested) defaults.store = suggested;

  return defaults;
}
