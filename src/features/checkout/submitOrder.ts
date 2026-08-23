import type { Order, PlaceOrderInput } from '@/types';
import type { AuthorisePaymentInput, PaymentResult } from '@/services/paymentService';

/**
 * Authorise, then create the order, and give the money back if the order does
 * not happen.
 *
 * This lives here rather than inline in the checkout screen because it is the
 * one sequence in the app where getting it wrong costs a customer money. The
 * screen used to authorise the card and then create the order with nothing in
 * between: a dropped connection, a 500 or an expired session left a hold
 * against an order that never existed, and the error shown — "please try
 * again" — invited a second authorisation.
 *
 * The dependencies are passed in so the sequence can be tested without a
 * renderer, a router or a network.
 */

export type SubmitOutcome =
  | { status: 'placed'; order: Order }
  /** Nothing was authorised, so retrying is free. */
  | { status: 'declined'; message: string }
  /** Authorised, order failed, hold released. Retrying is free. */
  | { status: 'reversed'; message: string }
  /**
   * Authorised, order failed, and the release could not be confirmed. The one
   * case where the customer must not be told to try again.
   */
  | { status: 'stranded'; message: string };

export interface SubmitOrderDeps {
  authorise: (input: AuthorisePaymentInput) => Promise<PaymentResult>;
  place: (input: PlaceOrderInput) => Promise<Order>;
  release: (intentId: string) => Promise<boolean>;
}

const GENERIC = 'We could not place that order. Please try again.';

function reasonFor(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : GENERIC;
}

export async function submitOrder(
  payment: AuthorisePaymentInput,
  order: PlaceOrderInput,
  { authorise, place, release }: SubmitOrderDeps,
): Promise<SubmitOutcome> {
  let authorisation: PaymentResult;

  try {
    authorisation = await authorise(payment);
  } catch (error) {
    // The authorisation call itself failed, so there is nothing to release.
    return { status: 'declined', message: reasonFor(error) };
  }

  if (!authorisation.success) {
    return {
      status: 'declined',
      message: authorisation.message ?? 'That payment did not go through.',
    };
  }

  try {
    return { status: 'placed', order: await place(order) };
  } catch (error) {
    const reason = reasonFor(error);
    const released = await release(authorisation.intentId).catch(() => false);

    if (released) {
      return { status: 'reversed', message: `${reason} Your card was not charged.` };
    }

    return {
      status: 'stranded',
      message:
        'Your order did not go through, but your card was authorised. ' +
        'The hold should clear shortly — call the store if it does not.',
    };
  }
}
