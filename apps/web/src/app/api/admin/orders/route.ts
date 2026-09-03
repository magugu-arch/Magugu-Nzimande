import { OrderStatusSchema, z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { refuseUnlessOperator } from '@/lib/admin-auth';
import { readAudit } from '@/lib/catalogue-state';
import { labelFor, listOrders, setOrderStatus } from '@/lib/order-store';
import { notifyMoved } from '@/lib/notifications/send';
import { requestCourier, unacknowledged } from '@/lib/fulfilment/handoff';
import { listSuppressed } from '@/lib/notifications/suppression';
import { activeCourier } from '@/lib/fulfilment/registry';

/**
 * GET /api/admin/orders — the queue, the audit log, and the two things that
 * have gone wrong quietly.
 *
 * `unacknowledged` is the end-of-service question: which orders did the kitchen
 * system never accept. It was recorded from the first handoff and displayed
 * nowhere, which made it a log nobody reads rather than a report.
 *
 * `suppressed` is the same shape of problem for email. A customer whose
 * confirmation bounced never got their order number, and until an operator can
 * see that, the only symptom is a phone call.
 */
export function GET(request: Request) {
  const refusal = refuseUnlessOperator(request);
  if (refusal) return refusal;

  return NextResponse.json({
    orders: listOrders().map((order) => ({ ...order, statusLabel: labelFor(order) })),
    audit: readAudit(),
    unacknowledged: unacknowledged(),
    suppressed: listSuppressed(),
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
  const refusal = refuseUnlessOperator(request);
  if (refusal) return refusal;

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

  await notifyMoved(order);

  // A driver is asked for when the kitchen marks it ready, not when the order
  // is placed: a courier standing in a shop watching chicken fry is a courier
  // Uber charges for. requestCourier is a no-op for a collection order and for
  // one already handed off.
  if (order.status === 'ready') await requestCourier(order, activeCourier());

  return NextResponse.json({
    orders: listOrders().map((candidate) => ({ ...candidate, statusLabel: labelFor(candidate) })),
    audit: readAudit(),
    unacknowledged: unacknowledged(),
    suppressed: listSuppressed(),
  });
}
