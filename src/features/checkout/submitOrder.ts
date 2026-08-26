import type { Order, PlaceOrderInput } from '@/types';
import type { AuthorisePaymentInput, PaymentResult } from '@/services/paymentService';
import { didNotHearBack } from '@/services/apiClient';

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
  /**
   * The authorisation was attempted and no answer came back, so nobody knows
   * whether it was taken. The other case where the customer must not be told to
   * try again.
   */
  | { status: 'uncertain'; message: string }
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
    /**
     * A failed authorisation call is two different things.
     *
     * A refusal is an answer — the gateway received the request, considered it,
     * and said no. Nothing was taken, so "please try again" is sound advice.
     *
     * A timeout, a dropped connection or a 5xx is not an answer. The gateway
     * may have authorised the card and lost the reply on the way back, and
     * there is no `intentId` to release because the call that would have
     * returned one never did. Telling that customer to try again is how one
     * order becomes two holds — precisely what the sequence below exists to
     * prevent, missed on the first call because it was reasoned about only for
     * the second.
     */
    if (didNotHearBack(error)) {
      return {
        status: 'uncertain',
        message:
          'We could not reach the payment provider, and we cannot tell whether ' +
          'your card was authorised. Check your banking app before trying again — ' +
          'if a hold is showing, call the store rather than paying twice.',
      };
    }

    // A refusal, so there is nothing to release.
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
