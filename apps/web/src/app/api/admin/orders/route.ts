import { OrderStatusSchema, z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { readAudit } from '@/lib/catalogue-state';
import { labelFor, listOrders, setOrderStatus } from '@/lib/order-store';

/** GET /api/admin/orders — the queue, plus the audit log. */
export function GET() {
  return NextResponse.json({
    orders: listOrders().map((order) => ({ ...order, statusLabel: labelFor(order) })),
    audit: readAudit(),
  });
}

const BodySchema = z.object({
  orderId: z.string().min(1),
  status: OrderStatusSchema,
  /** Required when cancelling: a cancellation without a reason is refused. */
  reason: z.string().trim().min(1).optional(),
});

/** POST /api/admin/orders — move an order's status. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { orderId, status, reason } = parsed.data;

  if (status === 'cancelled' && !reason) {
    return NextResponse.json({ error: 'A cancellation needs a reason' }, { status: 400 });
  }

  const order = setOrderStatus(orderId, status, reason);
  if (!order) {
    return NextResponse.json({ error: 'No such order' }, { status: 404 });
  }

  return NextResponse.json({
    orders: listOrders().map((candidate) => ({ ...candidate, statusLabel: labelFor(candidate) })),
    audit: readAudit(),
  });
}
