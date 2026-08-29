import { NextResponse } from 'next/server';
import { labelFor, readOrder } from '@/lib/order-store';

/** GET /api/orders/:id — status for the journey screen. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const order = readOrder(id);
  if (!order) {
    return NextResponse.json({ error: 'No such order' }, { status: 404 });
  }
  return NextResponse.json({ order, statusLabel: labelFor(order) });
}
