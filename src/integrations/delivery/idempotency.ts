/**
 * Idempotency keys for order creation — extension §5 and §11.
 *
 * The rule that makes a key useful: **one key per intent, not per attempt.**
 *
 * A customer taps "Place order". The request times out — the phone lost
 * signal in the seconds after the provider accepted it. The app retries. If
 * the retry carries a fresh key, the provider sees an unrelated order and
 * cooks dinner twice. If it carries the same key, the provider recognises it
 * and returns the original result. So the key is minted when the customer
 * commits and travels with the order through every retry, including one
 * after the app has been killed and reopened.
 *
 * That last clause is why the key is derived rather than random. A UUID lost
 * with the process is no protection against the one case where protection
 * matters most: a crash between sending and confirming. Deriving the key
 * from the order's own content means the same cart, to the same store,
 * through the same channel, in the same commit window, produces the same key
 * on a cold start.
 */

import type { ProviderOrderRequest } from './types';

/**
 * How wide a window two identical attempts collapse into, in milliseconds.
 *
 * Fifteen minutes. Long enough to cover a retry after a crash and a cold
 * start; short enough that a customer who genuinely wants the same order
 * again — the same dishes, to the same address, half an hour later — is not
 * told they already placed it.
 *
 * This is the one real trade-off in the file and it is a trade between two
 * failures: a duplicate order, and a refused legitimate reorder. A duplicate
 * costs Pappas food, a refund and trust; a refused reorder costs one
 * confused customer who taps again. Fifteen minutes leans toward the cheaper
 * failure.
 */
const COMMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * A small, stable, non-cryptographic hash.
 *
 * FNV-1a. Chosen because it needs no dependency and no platform crypto —
 * `crypto.subtle` is async and not uniformly present across the Expo
 * runtimes this app targets, and an idempotency key does not need to resist
 * an adversary. It needs to differ when the order differs, which this does.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The parts of an order that make it a distinct intent. */
export interface OrderIntent {
  provider: string;
  storeId: string;
  customerId?: string;
  fulfilment: string;
  scheduledFor?: string;
  totalCents: number;
  items: { sku: string; quantity: number; modifiers?: { id: string }[] }[];
}

/**
 * Mint the key for an order intent.
 *
 * `now` is injected so tests can pin the window rather than sleep, and so a
 * caller that already knows the commit instant can pass it rather than
 * letting two calls straddle a boundary.
 */
export function idempotencyKeyFor(intent: OrderIntent, now: number = Date.now()): string {
  // Items are sorted so that reordering the cart does not mint a new key:
  // the same dishes in a different sequence are the same order.
  const items = intent.items
    .map(
      (item) =>
        `${item.sku}x${item.quantity}:${(item.modifiers ?? [])
          .map((m) => m.id)
          .sort()
          .join('+')}`,
    )
    .sort()
    .join('|');

  const window = Math.floor(now / COMMIT_WINDOW_MS);

  const fingerprint = [
    intent.provider,
    intent.storeId,
    intent.customerId ?? 'guest',
    intent.fulfilment,
    intent.scheduledFor ?? 'asap',
    intent.totalCents,
    items,
    window,
  ].join('~');

  // Prefixed so a key is recognisable in a provider dashboard and a support
  // log without anyone having to ask what the hex string is.
  return `pappas-${intent.provider}-${fnv1a(fingerprint)}-${window.toString(36)}`;
}

/** Convenience for a request that is already assembled. */
export function keyForRequest(
  request: Omit<ProviderOrderRequest, 'idempotencyKey'>,
  now?: number,
): string {
  return idempotencyKeyFor(
    {
      provider: request.provider,
      storeId: request.storeId,
      customerId: request.customerId,
      fulfilment: request.fulfilment,
      scheduledFor: request.scheduledFor,
      totalCents: request.totalCents,
      items: request.items,
    },
    now,
  );
}
