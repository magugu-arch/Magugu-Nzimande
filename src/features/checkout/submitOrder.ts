import type { Order, PlaceOrderInput } from '@/types';
import type { AuthorisePaymentInput, PaymentResult } from '@/services/paymentService';
import { didNotHearBack, holdSessionExpiryWhile } from '@/services/apiClient';

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

/**
 * Everything except success — which is to say, everything that leaves the
 * customer on the checkout screen with a decision to make.
 */
export type SubmitFailure = Exclude<SubmitOutcome, { status: 'placed' }>;

/**
 * Whether the customer can safely press the button again.
 *
 * The four failures above are not one failure. Two of them mean nothing was
 * taken and a retry costs nothing; two mean the card may be — or definitely is
 * — held, and a second attempt is how one order becomes two holds.
 *
 * That distinction was the entire reason this sequence was lifted out of the
 * checkout screen, and the screen then threw it away: every outcome went to the
 * same `setSubmitError(outcome.message)`, under a "Place order" button that
 * stayed live. So the `uncertain` message read "we cannot tell whether your
 * card was authorised — call the store rather than paying twice" with a working
 * Place order button directly beneath it. The words said stop and the button
 * said go.
 *
 * Exported from here rather than decided in the screen because this is the file
 * that knows what each status means.
 */
export function safeToRetry(failure: SubmitFailure): boolean {
  switch (failure.status) {
    case 'declined': // The gateway answered no. Nothing was taken.
    case 'reversed': // Authorised, then released, and the release was confirmed.
      return true;
    case 'uncertain': // No answer came back. Nobody knows.
    case 'stranded': // Authorised, and the release was not confirmed.
      return false;
  }
}

export interface SubmitOrderDeps {
  authorise: (input: AuthorisePaymentInput) => Promise<PaymentResult>;
  place: (input: PlaceOrderInput) => Promise<Order>;
  release: (intentId: string) => Promise<boolean>;
}

const GENERIC = 'We could not place that order. Please try again.';

function reasonFor(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : GENERIC;
}

/**
 * The whole sequence, with session expiry held back until it has an answer.
 *
 * Driven by `audit:wire`: the card authorises, `/v1/orders` answers 401, the
 * refresh fails, and the app's session-expired handler clears the basket and
 * replaces the route — while this function is still awaiting. By the time it
 * returns `stranded`, the outcome that exists to say "your card was authorised
 * and there is no order; call the store", there is no screen to say it on. The
 * customer reads "Welcome back" with a hold on their card.
 *
 * The one failure this file was written to prevent, arriving through a door it
 * did not know about.
 *
 * `holdSessionExpiryWhile` defers the handler until this returns and tells it
 * the expiry happened during a payment, so the app forgets everything as usual
 * and leaves the message on screen. See `apiClient` and `useSessionExpiry`.
 */
export async function submitOrder(
  payment: AuthorisePaymentInput,
  order: PlaceOrderInput,
  deps: SubmitOrderDeps,
): Promise<SubmitOutcome> {
  return holdSessionExpiryWhile(() => attemptOrder(payment, order, deps));
}

async function attemptOrder(
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
