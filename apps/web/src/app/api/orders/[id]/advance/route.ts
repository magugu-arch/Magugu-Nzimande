import { NextResponse } from 'next/server';
import { advanceOrder, labelFor } from '@/lib/order-store';
import { notifyMoved } from '@/lib/notifications/send';

/**
 * POST /api/orders/:id/advance — move an order to its next state.
 *
 * Standing in for the kitchen display system until one is wired in. The journey
 * screen calls it on a timer so the states can be watched end to end, and the
 * operations console calls it when a cook actually moves an order along.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const order = advanceOrder(id);
  if (!order) {
    return NextResponse.json({ error: 'No such order' }, { status: 404 });
  }
  // Only some transitions are worth a message, and notifyMoved decides which.
  // Telling a customer four times about one order is how they stop reading the
  // one that matters.
  await notifyMoved(order);

  return NextResponse.json({ order, statusLabel: labelFor(order) });
}
