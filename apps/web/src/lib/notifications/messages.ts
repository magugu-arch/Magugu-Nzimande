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
