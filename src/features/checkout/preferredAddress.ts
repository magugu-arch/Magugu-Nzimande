import type { Address } from '@/types';

/**
 * The address to pre-select for someone who has not chosen one.
 *
 * Checkout auto-selects two of its three choices already — the nearest branch
 * that can take the order, and the customer's default card — and left the
 * third to them. That looked harmless because every journey ever driven
 * through this app places a *first* order, and a first order has an address in
 * hand: the customer has just typed it in, or just tapped it on the address
 * screen.
 *
 * `reset()` nulls it once the order is placed. So the second order, and every
 * order after it, arrived at checkout with a store chosen, a card chosen, and
 * "Add a delivery address" under a disabled button — for a customer with an
 * address saved and flagged as their default. Driven in a browser:
 *
 *     FIRST order  : {"disabled":null,  "reason":"(none)"}
 *     SECOND order : {"disabled":"true","reason":"Add a delivery address"}
 *
 * Which is the most common journey there is, blocked on a detour to a picker
 * to re-tap the answer the app already knew.
 *
 * The rule is deliberately narrow. Their default is the address they mean. A
 * single saved address is also unambiguous — and it is the common case here,
 * because the address form only marks one default when the customer ticks the
 * box, so the first address most people save is not flagged at all. Beyond
 * that, several addresses and none preferred, this returns nothing and lets
 * them choose: picking one would be the app deciding where they live.
 *
 * Deliverability is not part of it, on purpose. If the branch will not reach
 * their default address, the right outcome is being told exactly that —
 * "…does not deliver to Rosebank — collect instead" — not having a different
 * address quietly substituted because it happens to be in range.
 */
export function preferredAddress(addresses: Address[]): Address | undefined {
  const preferred = addresses.find((address) => address.isDefault);
  if (preferred) return preferred;
  return addresses.length === 1 ? addresses[0] : undefined;
}
