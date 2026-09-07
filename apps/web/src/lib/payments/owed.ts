import type { Order } from '@bbq/types';
import { readState } from '../demo-state';

/**
 * Orders that were cancelled with the customer's money still taken.
 *
 * Cancelling an order writes a status and a reason and does nothing about the
 * payment, which is correct as far as it goes — whether to refund, and how
 * fast, is a commercial decision that belongs to the franchisor rather than to
 * this file, and a cancellation for suspected fraud is not the same as one for
 * a kitchen that lost power. Nothing here refunds anything automatically.
 *
 * What was missing is that nobody was told. The order said cancelled, the
 * payment said captured, and the Problems tab — which reports handoffs the
 * kitchen never acknowledged and addresses we have stopped emailing — had no
 * row for a customer who had paid for food that will never arrive. The refund
 * endpoint existed and nothing pointed at the orders that needed it.
 *
 * So this is a report and not a rule. An operator sees what is owed and presses
 * the button that already exists.
 */

export type OwedRefund = {
  orderId: string;
  orderNumber: string;
  intentId: string;
  amountCents: number;
  /** Why the order was cancelled, which is usually why the refund is owed. */
  reason: string | null;
  cancelledMode: Order['mode'];
  providerRef: string | null;
};

/**
 * Cancelled, captured, and not yet refunded.
 *
 * `captured` only. An intent still `pending` took no money, and one already
 * `refunded` has given it back — listing either would make this report the
 * thing nobody reads, which is what the shortfall report was rescued from
 * when it listed every order on a deployment with no POS.
 */
export function owedRefunds(): OwedRefund[] {
  const { orders, payments } = readState();

  return orders
    .filter((order) => order.status === 'cancelled')
    .flatMap((order) => {
      const intent = payments.intents.find(
        (candidate) => candidate.orderId === order.id && candidate.status === 'captured',
      );
      if (!intent) return [];

      return [
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          intentId: intent.id,
          amountCents: intent.amountCents,
          reason: order.cancelledReason,
          cancelledMode: order.mode,
          providerRef: intent.providerRef,
        },
      ];
    });
}
