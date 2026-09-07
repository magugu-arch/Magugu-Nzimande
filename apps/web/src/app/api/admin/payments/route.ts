import { z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { refuseUnlessOperator } from '@/lib/admin-auth';
import { consoleView } from '@/lib/console-view';
import { notifyRefunded } from '@/lib/notifications/send';
import { readOrder } from '@/lib/order-store';
import { refundPayment } from '@/lib/payments/ledger';

/**
 * POST /api/admin/payments — send a captured payment back.
 *
 * The one operation on money an operator can start, and the gap this closes: a
 * store could cancel an order somebody had paid for and nothing anywhere could
 * return the money. `refunded` existed as a payment status from the beginning
 * and nothing could produce it.
 *
 * Narrow on purpose. There is no amount in the body — a partial refund is a
 * commercial policy nobody has set, and an amount a caller can name is an
 * amount a caller can get wrong. The reason is required for the same purpose as
 * a cancellation reason: it goes in the audit log and it is what somebody reads
 * six weeks later when the customer asks why.
 *
 * The refusals live in the ledger rather than here, so the rule is the same
 * whichever caller reaches it. This route only decides who may ask.
 */

const BodySchema = z.object({
  action: z.literal('refund'),
  orderId: z.string().min(1),
  reason: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const refusal = refuseUnlessOperator(request);
  if (refusal) return refusal;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { orderId, reason } = parsed.data;
  const result = await refundPayment(orderId, reason);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  /**
   * Told, not just recorded. A cancellation message says nothing about money,
   * so without this a customer who paid learns their order is off and is left
   * to wonder about the rest — which is the telephone call this whole path
   * exists to prevent.
   *
   * Not on a replay: the ledger has already handed back an intent that was
   * refunded earlier, and the customer was messaged then. `send` would dedupe
   * it anyway; not asking is clearer than relying on that.
   */
  const order = readOrder(orderId);
  if (order && !result.replayed) await notifyRefunded(order, result.intent.id);

  return NextResponse.json({ ...consoleView(), refunded: result.intent, replayed: result.replayed });
}
