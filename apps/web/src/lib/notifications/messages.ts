import type { Order } from '@bbq/types';
import type { Message } from './transport';

/**
 * What the customer is actually sent.
 *
 * Written here rather than in the route that triggers them, because copy that
 * lives next to a route handler is copy nobody proofreads. All of it goes
 * through the brand rules like every other string in this repository: the mark
 * is `bb.q Chicken`, and the craft line is the approved one.
 *
 * SMS is kept to one segment where it can be. A message that runs to 161
 * characters costs twice as much to send as one that runs to 160, and status
 * updates go out several times per order.
 */

const rand = (cents: number) => `R${(cents / 100).toFixed(2)}`;

export function orderPlaced(order: Order): Message[] {
  const collection =
    order.mode === 'Delivery'
      ? `We will bring it to ${order.address ?? 'your address'}.`
      : `It will be ready to ${order.mode === 'Collection' ? 'collect' : 'serve'} shortly.`;

  return [
    {
      id: `${order.id}:placed:email`,
      channel: 'email',
      to: order.customer.email,
      subject: `Your bb.q Chicken order ${order.orderNumber}`,
      body: [
        `Thank you, ${order.customer.name}.`,
        '',
        `We have your order ${order.orderNumber}, ${rand(order.totals.totalCents)}.`,
        collection,
        `About ${order.etaMinutes} minutes.`,
        '',
        'Twice fried in olive oil. Tossed to order.',
      ].join('\n'),
    },
    {
      id: `${order.id}:placed:sms`,
      channel: 'sms',
      to: order.customer.mobile,
      subject: '',
      body: `bb.q Chicken: order ${order.orderNumber} received, ${rand(order.totals.totalCents)}. About ${order.etaMinutes} min.`,
    },
  ];
}

/**
 * A status change worth telling somebody about.
 *
 * Not every transition is. `preparing` follows `received` within a minute or
 * two and tells the customer nothing they did not already assume, so it sends
 * nothing — a customer who is messaged four times about one order stops reading
 * the one that matters.
 */
export function orderMoved(order: Order): Message[] {
  const worthSending: Record<string, string | null> = {
    received: null,
    preparing: null,
    ready: order.mode === 'Collection' ? 'is ready to collect' : 'is ready',
    out_for_delivery: 'is on its way',
    completed: null,
    cancelled: 'has been cancelled',
  };

  const what = worthSending[order.status];
  if (!what) return [];

  const reason =
    order.status === 'cancelled' && order.cancelledReason ? ` ${order.cancelledReason}.` : '';

  return [
    {
      id: `${order.id}:${order.status}:sms`,
      channel: 'sms',
      to: order.customer.mobile,
      subject: '',
      body: `bb.q Chicken: order ${order.orderNumber} ${what}.${reason}`,
    },
  ];
}

/** What the console shows an operator about a message that was not sent. */
export function describe(message: Message): string {
  return `${message.channel} to ${message.to}: ${labelOf(message)}`;
}

function labelOf(message: Message): string {
  return message.subject || message.body.slice(0, 60);
}

/**
 * The reset link.
 *
 * Email only. A password reset sent by text lands on the device most likely to
 * be the one that was lost or taken, and a link in an SMS is unverifiable to
 * the person reading it.
 */
export function passwordReset(email: string, token: string, baseUrl?: string | null): Message[] {
  const link = baseUrl ? `${baseUrl}/account?reset=${encodeURIComponent(token)}` : null;

  return [
    {
      // Not keyed on the token: two resets requested a minute apart are two
      // messages, and deduplicating them would strand the customer on a link
      // the second request has already invalidated.
      id: `reset:${token.slice(0, 12)}`,
      channel: 'email',
      to: email,
      subject: 'Reset your bb.q Chicken password',
      /**
       * The link when this deployment knows its own address, and the code
       * either way.
       *
       * The token is 43 characters of base64url. Sending only that asked a
       * customer to retype it into a form, which most people get wrong at least
       * once and some abandon. The code stays for anyone whose mail client
       * strips links, and for a deployment with no public URL configured.
       */
      body: [
        'Somebody asked to reset the password on this address.',
        '',
        ...(link ? [`Open this within the hour: ${link}`, ''] : []),
        `Or use this code: ${token}`,
        '',
        'If it was not you, nothing has changed and you can ignore this.',
      ].join('\n'),
    },
  ];
}
