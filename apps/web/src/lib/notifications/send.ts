import type { Order } from '@bbq/types';
import { mutateState, pushAudit, readState } from '../demo-state';
import { describe, orderMoved, orderPlaced, passwordReset } from './messages';
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

/** Message ids already delivered, so a repeat is a no-op rather than a second send. */
function alreadySent(id: string): boolean {
  return readState().notifications.sent.includes(id);
}

function markSent(id: string): void {
  mutateState((state) => {
    if (state.notifications.sent.includes(id)) return;
    state.notifications.sent.push(id);
    // Bounded like every other list in this file. Old ids only need to outlive
    // the retries that would duplicate them.
    if (state.notifications.sent.length > 2_000) state.notifications.sent.shift();
  });
}

async function send(messages: Message[]): Promise<number> {
  const sender = transport();
  let sent = 0;

  for (const message of messages) {
    if (alreadySent(message.id)) continue;

    // Marked before the attempt, not after. A transport that half-succeeds —
    // delivers, then times out returning — would otherwise be retried, and one
    // message missed is better than one message twice.
    markSent(message.id);

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
