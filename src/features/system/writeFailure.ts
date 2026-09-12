import { ApiRequestError } from '@/services/apiClient';

/**
 * What to say when a write does not go through — the other half of
 * `queryPhase`.
 *
 * That file exists because screens were written to a pattern with a hole in
 * it, and eleven of fourteen claimed something false rather than admitting
 * they could not reach the server. Its rule is the one this app keeps coming
 * back to: **an empty state is a claim about the world; an error state is a
 * claim about the app.**
 *
 * Reads were fixed. Writes were not, and nobody noticed because a failed write
 * does not render anything at all — there is no empty state to go wrong, just
 * a screen that sits there. Swept across the app, six of them said nothing
 * whatsoever when the server refused:
 *
 *   - the contact form `await`ed `mutateAsync` with no `catch`, so a rejection
 *     became an unhandled promise, the spinner stopped and the screen did not
 *     move. A customer reporting a wrong order taps Send, sees nothing happen,
 *     and taps again — and every tap that later succeeds is another ticket.
 *   - deleting a saved card left the card on the list and said nothing.
 *   - making a card the default changed nothing and said nothing.
 *   - deleting an address said nothing *and* cleared the delivery address the
 *     basket was using, so a refused delete still cost the customer something.
 *   - marking a notification read, and marking all of them read, both
 *     silently did not.
 *
 * `cancelOrder` is the one that was already right — `onError` and a `tell` —
 * and it is the shape the rest now follow.
 *
 * ## The distinction worth making
 *
 * Not "it failed", but **whether it might have happened anyway**. If the
 * server answered — any status, 403 or 500 alike — it made a decision and
 * nothing changed. If no answer came back, the request may well have been
 * carried out and the reply lost, which is a completely different thing to
 * tell somebody who has just tried to delete a card.
 *
 * It is the same rule `safeToRetry` applies to a payment, where `declined` and
 * `uncertain` are treated as opposites. A write is smaller than a payment and
 * the reasoning is identical: an app that says "that didn't save" about
 * something that did is lying in the direction that gets the action repeated.
 */

/** Whether the server got far enough to decide. */
export type WriteOutcome = 'refused' | 'unreachable';

export function writeOutcome(error: unknown): WriteOutcome {
  // A status means a reply came back, so the server considered it and said no.
  // Anything else — a transport failure, an abort, a timeout — means the
  // request may have been carried out with the answer lost on the way home.
  return error instanceof ApiRequestError && error.status !== undefined ? 'refused' : 'unreachable';
}

/**
 * What the customer is told, as a title and a sentence.
 *
 * `action` is the thing they were doing, in the present tense and lower case —
 * "delete that card", "send your message" — so it reads inside both sentences
 * below. Passed in rather than derived, because only the screen knows what the
 * customer thought they were doing, and a generic "that didn't work" is the
 * message this whole file exists to replace.
 *
 * The server's own words are preferred when there are any: a backend that says
 * "This card is attached to an active subscription" knows something no message
 * written here could. It is only used for a `refused`, because a transport
 * failure's message is about sockets rather than about cards.
 */
export function writeFailureMessage(
  error: unknown,
  action: string,
): { title: string; message: string } {
  if (writeOutcome(error) === 'refused') {
    const fromServer =
      error instanceof ApiRequestError && error.message.trim().length > 0
        ? error.message.trim()
        : null;

    return {
      title: `We couldn’t ${action}`,
      // "Nothing has changed" is safe to say here and only here: the server
      // answered, so it decided, so it did not act.
      message: fromServer ?? 'Nothing has changed. Please try again.',
    };
  }

  return {
    title: `We couldn’t ${action}`,
    /*
      Deliberately not "nothing has changed", which would be a guess.

      This is the same honesty the checkout screen already owes a customer
      whose payment timed out — "we cannot tell whether your card was
      authorised" — scaled down to a card being deleted. Telling somebody their
      card is still saved when it may not be is worse than telling them to
      look.
    */
    message:
      'We couldn’t reach bb.q, so this may not have gone through. Check your connection and have a look before trying again.',
  };
}
