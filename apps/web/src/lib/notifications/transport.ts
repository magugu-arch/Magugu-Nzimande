/**
 * How a message leaves the building.
 *
 * No messaging provider has been contracted, so there is no adapter here for
 * one. The interface is what an adapter implements, and it is deliberately
 * small: a channel, a recipient, a subject, a body, and an id to deduplicate on.
 *
 * `deliver` returns rather than throws. A confirmation email that fails must not
 * fail the order it is confirming — the customer's food is already being made,
 * and a 500 at that point tells them the opposite of the truth.
 */

export type Channel = 'email' | 'sms';

export type Message = {
  /** Stable per event, so a retry does not send twice. */
  id: string;
  channel: Channel;
  to: string;
  subject: string;
  body: string;
};

export type Delivery = { ok: true; id: string } | { ok: false; error: string };

export interface NotificationTransport {
  readonly name: string;
  deliver(message: Message): Promise<Delivery>;
}

/**
 * The transport this deployment has: it writes to the audit log and sends
 * nothing.
 *
 * It is not a pretend email service. Nothing about it suggests a message
 * reached anybody — the console shows exactly what would have been sent, to
 * whom, which is what an operator needs to see while there is no provider, and
 * `name` says `log` so no dashboard can be misread as delivery.
 */
export function loggingTransport(record: (message: Message) => void): NotificationTransport {
  return {
    name: 'log',
    async deliver(message) {
      record(message);
      return { ok: true, id: message.id };
    },
  };
}
