import 'server-only';
import {
  CHECKOUT_SESSION_ID,
  type CheckoutSession,
  paymentsState,
  retrieveCheckoutSession,
  StripeError,
} from './payments';

/**
 * What a return from Stripe Checkout actually means. Pages never trust the
 * URL: they ask Stripe for the session, and only Stripe's answer can say
 * "paid". Shared by event bookings and book orders.
 */
export type CheckoutOutcome =
  | { kind: 'paid'; session: CheckoutSession }
  | { kind: 'processing'; session: CheckoutSession }
  | { kind: 'unfinished'; session: CheckoutSession }
  | { kind: 'expired' }
  | { kind: 'unknown' }
  | { kind: 'unavailable' };

export async function lookupCheckout(id: string | undefined): Promise<CheckoutOutcome> {
  if (!id || !CHECKOUT_SESSION_ID.test(id)) return { kind: 'unknown' };
  const payments = paymentsState();
  if (!payments.ready) return { kind: 'unavailable' };
  try {
    const session = await retrieveCheckoutSession({ secretKey: payments.secretKey }, id);
    if (session.status === 'expired') return { kind: 'expired' };
    if (session.payment_status === 'paid') return { kind: 'paid', session };
    if (session.status === 'complete') return { kind: 'processing', session };
    return { kind: 'unfinished', session };
  } catch (error) {
    // Stripe answers 404 for a session it does not know; anything else is an outage.
    return error instanceof StripeError && error.status === 404
      ? { kind: 'unknown' }
      : { kind: 'unavailable' };
  }
}
