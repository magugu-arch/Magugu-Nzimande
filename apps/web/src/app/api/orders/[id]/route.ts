import { publicOrder } from '@bbq/types';
import { NextResponse } from 'next/server';
import { labelFor, readOrder } from '@/lib/order-store';
import { paymentFor } from '@/lib/payments/ledger';

/**
 * GET /api/orders/:id — status for the journey screen.
 *
 * Open by design: a guest tracking their order has no session to check. So the
 * answer is narrowed instead — `publicOrder` keeps the customer's name, email,
 * mobile and street address behind the counter, where the console and the
 * account history reach them through a guard.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const order = readOrder(id);
  if (!order) {
    return NextResponse.json({ error: 'No such order' }, { status: 404 });
  }
  return NextResponse.json({
    order: publicOrder(order),
    statusLabel: labelFor(order),
    payment: paymentFor(order.id),
  });
}
