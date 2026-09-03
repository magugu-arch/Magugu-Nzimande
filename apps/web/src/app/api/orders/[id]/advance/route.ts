import { kitchenMayStart } from '@bbq/types';
import { NextResponse } from 'next/server';
import { advanceOrder, labelFor, readOrder } from '@/lib/order-store';
import { notifyMoved } from '@/lib/notifications/send';
import { requestCourier } from '@/lib/fulfilment/handoff';
import { activeCourier } from '@/lib/fulfilment/registry';
import { paymentFor } from '@/lib/payments/ledger';

/**
 * POST /api/orders/:id/advance — move an order to its next state.
 *
 * Standing in for the kitchen display system until one is wired in. The journey
 * screen calls it on a timer so the states can be watched end to end, and the
 * operations console calls it when a cook actually moves an order along.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  /**
   * Nothing moves on an order whose money has not arrived.
   *
   * Checked here rather than trusted to the screens, because the journey polls
   * this on a timer and the console has a button: a rule enforced in both
   * places is a rule enforced in neither once a third caller appears. On a
   * deployment with no gateway configured this is always allowed, which is what
   * makes the demonstration build cook.
   */
  const existing = readOrder(id);
  if (existing && !kitchenMayStart(paymentFor(existing.id))) {
    return NextResponse.json(
      { error: 'That order has not been paid for yet' },
      { status: 409 },
    );
  }

  const order = advanceOrder(id);
  if (!order) {
    return NextResponse.json({ error: 'No such order' }, { status: 404 });
  }
  // Only some transitions are worth a message, and notifyMoved decides which.
  // Telling a customer four times about one order is how they stop reading the
  // one that matters.
  await notifyMoved(order);
  if (order.status === 'ready') await requestCourier(order, activeCourier());

  return NextResponse.json({ order, statusLabel: labelFor(order), payment: paymentFor(order.id) });
}
