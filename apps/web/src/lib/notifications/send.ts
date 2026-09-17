import type { Order } from '@bbq/types';
import { mutateState, pushAudit, readState } from '../demo-state';
import { claimOnce } from '../once';
import { describe, orderMoved, orderPlaced, passwordReset, paymentRefunded } from './messages';
import { publicBaseUrl } from '../deployment';
import { routedTransport } from './registry';
import type { Message, NotificationTransport } from './transport';

/**
 * Sending, and not sending twice.
 *
 * Every message carries an id derived from the order and the thing that
 * happened, so a retried request, a redelivered webhook or an operator pressing
 * the button twice produce the same id and the second one is dropped. A
 * customer who gets two "your order is on its way" messages for one order stops
 * trusting all of them.
 *
 * Nothing here throws. A message that cannot be sent is recorded and the caller
 * carries on: a confirmation that fails must not fail the order it confirms,
 * because the food is already being cooked and a 500 tells the customer the
 * opposite of the truth.
 */

function transport(): NotificationTransport {
  // Routed per channel: Mailgun for email, Clickatell for SMS, and the audit
  // log for whichever of the two this deployment has not configured.
  return routedTransport((message) => {
    mutateState((state) => pushAudit(state, 'notifications', describe(message)));
  });
}

async function send(messages: Message[]): Promise<number> {
  const sender = transport();
  let sent = 0;

  for (const message of messages) {
    /**
     * Claimed, not asked about.
     *
     * This read `alreadySent(id)` and then called `markSent(id)` as a separate
     * write. The write was careful — it re-checked inside its own mutation and
     * refused to add a duplicate — so the ledger never held one, and two
     * callers arriving together both delivered anyway. The guard was in the
     * write while the decision was up here.
     *
     * The claim is also taken before the attempt rather than after. A transport
     * that half-succeeds — delivers, then times out returning — would otherwise
     * be retried, and one message missed is better than one message twice.
     */
    if (!claimOnce('messages', message.id)) continue;

    const result = await sender.deliver(message);
    if (result.ok) sent += 1;
    else {
      mutateState((state) =>
        pushAudit(state, 'notifications', `Could not send ${message.id}: ${result.error}`),
      );
    }
  }

  return sent;
}

export async function notifyPlaced(order: Order): Promise<number> {
  return send(orderPlaced(order));
}

export async function notifyMoved(order: Order): Promise<number> {
  return send(orderMoved(order));
}

export async function notifyRefunded(order: Order, intentId: string): Promise<number> {
  return send(paymentRefunded(order, intentId));
}

export async function notifyPasswordReset(email: string, token: string): Promise<number> {
  // The deployment's own address, so the message can carry a link rather than
  // 43 characters to retype. Null when none is configured, and the message
  // falls back to the code alone.
  return send(passwordReset(email, token, publicBaseUrl()));
}

/** What was sent, for the console and for tests. */
export function sentMessageIds(): string[] {
  return [...readState().notifications.sent];
}
