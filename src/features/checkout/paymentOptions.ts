import { describePaymentMethod } from '@/services/paymentService';
import type { FulfilmentType, PaymentMethod } from '@/types';
import { expiryLabel, methodHasExpired } from './cardExpiry';

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
  now: Date = new Date(),
): PaymentMethod[] {
  /**
   * A card that has run out cannot pay for this order, so it is not offered
   * for it.
   *
   * It is not deleted — it stays on the account screen, labelled "Expired", so
   * a customer who wonders where their card went has somewhere to find out.
   * What it must not be is one of the choices here, indistinguishable from a
   * working card until the gateway declines it after the order is committed.
   *
   * `seen` is computed from the surviving cards on purpose. If every saved
   * card has expired, the customer has no card — and must still be offered the
   * rails, which is exactly the "brand-new customer" case this function was
   * written for.
   */
  const usable = saved.filter((method) => !methodHasExpired(method, now));
  const seen = new Set(usable.map((method) => method.type));

  const merged = [...usable, ...STANDING_RAILS.filter((rail) => !seen.has(rail.type))];

  // There is nobody to hand the money to on a collection or a dine-in order
  // placed in advance, so cash is a delivery rail only.
  return merged.filter((method) => method.type !== 'cash' || fulfilmentType === 'delivery');
}

/**
 * The second line under a payment option, or nothing.
 *
 * Both screens wrote this as `expiry ? expiryLabel(…) : describePaymentMethod(…)`,
 * which reads sensibly and is wrong for every rail. A rail's `label` and its
 * description are the same sentence — `STANDING_RAILS` names it "SnapScan" and
 * `describePaymentMethod('snapscan')` returns "SnapScan" — so checkout drew
 *
 *     SnapScan
 *     SnapScan
 *
 * three times over. Caught in a browser; no test could have failed on it,
 * because both strings were exactly what their own unit tests expect. A screen
 * reader reads the row twice, and a caption that adds nothing teaches a
 * customer to stop reading captions.
 *
 * So the caption is whatever the label does not already say. A card's expiry
 * always qualifies. A description qualifies only when it differs from the
 * label — which is how "Credit or debit card" still appears under a saved card
 * with no expiry on it, and how a rail renamed in one place but not the other
 * starts explaining itself again rather than staying silent.
 */
export function paymentCaption(method: PaymentMethod, now: Date = new Date()): string | null {
  if (method.expiry) return expiryLabel(method, now);

  const description = describePaymentMethod(method.type);
  return description === method.label ? null : description;
}
