import type { FulfilmentType } from '@/types';

/**
 * Whether a branch can do this kind of order.
 *
 * One line of business logic that was written out three times — once in
 * `StoreCard` to decide whether the card is tappable, once in the fulfilment
 * store to decide whether a chosen branch survives a change of fulfilment
 * type, and once in `storeService` to filter the list. All three agreed, which
 * is the most that can be said for three copies of a rule.
 *
 * Worth collapsing rather than leaving: this codebase has twice shipped a bug
 * whose whole cause was one rule written more than once — the route guard that
 * existed in two states of wrongness and a third place with none, and the phone
 * number that a regex and a normaliser disagreed about. Adding a fourth
 * fulfilment type would have been three edits, and a check that everything
 * still routes through here is in `__tests__/fulfilment.test.ts`.
 */
export interface FulfilmentCapable {
  supportsDelivery: boolean;
  supportsCollection: boolean;
  supportsDineIn: boolean;
}

export function supportsFulfilment(
  store: FulfilmentCapable,
  fulfilmentType: FulfilmentType,
): boolean {
  if (fulfilmentType === 'delivery') return store.supportsDelivery;
  if (fulfilmentType === 'collection') return store.supportsCollection;
  return store.supportsDineIn;
}
