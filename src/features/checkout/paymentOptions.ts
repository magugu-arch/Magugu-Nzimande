import type { FulfilmentType, PaymentMethod } from '@/types';

/**
 * How a customer can pay, which is not the same thing as what they have saved.
 *
 * Checkout offered exactly what `/v1/account/payment-methods` returned, and
 * the seeded version of that list mixed two unrelated things: saved cards,
 * which belong to a customer, and rails like cash on delivery, which belong to
 * the business and are saved by nobody.
 *
 * Against the mock that looked fine, because the seed handed back all five
 * together. Against a backend that implements the endpoint the obvious way —
 * this customer's saved cards — a brand-new customer gets an empty list.
 * Driven in a browser with the saved list emptied: nought payment options
 * offered, an empty Payment section, and no way to pay. Not by card, not by
 * SnapScan, not even cash on arrival.
 *
 * That is a customer who has just installed the app on opening day.
 *
 * So the rails live here, on the client, where they are a fact about what
 * bb.q accepts rather than something a customer had to set up first.
 */
export const STANDING_RAILS: PaymentMethod[] = [
  { id: 'rail-snapscan', type: 'snapscan', label: 'SnapScan', isDefault: false },
  { id: 'rail-eft', type: 'eft', label: 'Instant EFT', isDefault: false },
  { id: 'rail-cash', type: 'cash', label: 'Cash on delivery', isDefault: false },
];

/**
 * Everything this order can be paid with, saved cards first.
 *
 * The merge is by `type` and deliberately tolerant: nobody has settled whether
 * the backend returns rails alongside saved cards, and if it does they must
 * not appear twice. Whatever the server sends wins, because it knows things
 * this list cannot — a rail withdrawn for a region, say.
 */
export function offeredPaymentMethods(
  saved: PaymentMethod[],
  fulfilmentType: FulfilmentType,
): PaymentMethod[] {
  const seen = new Set(saved.map((method) => method.type));

  const merged = [...saved, ...STANDING_RAILS.filter((rail) => !seen.has(rail.type))];

  // There is nobody to hand the money to on a collection or a dine-in order
  // placed in advance, so cash is a delivery rail only.
  return merged.filter((method) => method.type !== 'cash' || fulfilmentType === 'delivery');
}
