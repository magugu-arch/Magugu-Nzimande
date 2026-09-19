/**
 * The bridge between this app's fulfilment vocabulary and the providers'.
 *
 * The app has shipped `FulfilmentType = 'delivery' | 'collection' | 'dinein'`
 * since before the delivery-channel extension existed. The brief's provider
 * contract uses `FulfilmentMode = 'delivery' | 'pickup'`. These overlap but
 * are not the same set, and the difference matters in both directions:
 *
 *   - `collection` and `pickup` are the same act under two names. Uber Eats
 *     calls it Pickup in its own product; Pappas staff call it collection.
 *     Mapping them is safe.
 *
 *   - `dinein` has no provider equivalent at all. A customer eating at Nelson
 *     Mandela Square is a reservation, not a delivery order, and there is no
 *     honest `FulfilmentMode` for it. Rather than quietly folding it into
 *     `pickup` — which would let a dine-in booking be quoted a courier fee —
 *     `toProviderMode` returns null and callers must handle it.
 *
 * A one-line `as` cast would have done all of this invisibly and been wrong
 * in exactly the case nobody tests.
 */

import type { FulfilmentType } from '../../types/order';
import type { FulfilmentMode } from './types';

/**
 * Narrow an app fulfilment type to the provider vocabulary.
 *
 * Returns null for `dinein`, which no delivery provider can express. A null
 * here is not an error — it means "this journey does not belong to this
 * layer" — and the caller should route to reservations instead.
 */
export function toProviderMode(type: FulfilmentType): FulfilmentMode | null {
  switch (type) {
    case 'delivery':
      return 'delivery';
    case 'collection':
      return 'pickup';
    case 'dinein':
      return null;
  }
}

/**
 * Widen a provider mode back into the app vocabulary.
 *
 * Total in this direction: every `FulfilmentMode` has exactly one app
 * meaning. `pickup` becomes `collection` because that is the word Pappas
 * uses on its own surfaces, and the brief's §7 copy agrees — "Ready for
 * collection", not "ready for pickup".
 */
export function fromProviderMode(mode: FulfilmentMode): FulfilmentType {
  return mode === 'delivery' ? 'delivery' : 'collection';
}

/**
 * Which capability a provider must report to serve this mode.
 *
 * Used by the registry to answer "can this provider do what the customer is
 * asking for" without each screen re-deriving the mapping.
 */
export function capabilityForMode(mode: FulfilmentMode): 'delivery' | 'pickup' {
  return mode;
}
