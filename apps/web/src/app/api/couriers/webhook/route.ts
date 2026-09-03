import { NextResponse } from 'next/server';
import { orderIdForReference } from '@/lib/fulfilment/handoff';
import { activeCourier, courierWebhookSecret } from '@/lib/fulfilment/registry';
import { orderStatusFor, phaseOf } from '@/lib/fulfilment/uber/status';
import { parseDeliveryEvent, verifyWebhook } from '@/lib/fulfilment/uber/webhook';
import { notifyMoved } from '@/lib/notifications/send';
import { readOrder, setCourierEta, setOrderStatus } from '@/lib/order-store';
import { logger } from '@/lib/observability/log';

/**
 * POST /api/couriers/webhook — the courier telling us where the food is.
 *
 * Same order of operations as the payment callback, for the same reason: read
 * the raw bytes, verify, and only then treat the body as meaning anything. This
 * URL moves orders to `out_for_delivery` and `completed`, so an unverified one
 * is a way to tell a customer their dinner has arrived.
 */
export async function POST(request: Request) {
  const secret = courierWebhookSecret();
  if (!secret || !activeCourier()) {
    return NextResponse.json({ error: 'No courier is configured' }, { status: 501 });
  }

  const rawBody = await request.text();
  if (!verifyWebhook(rawBody, request.headers, secret)) {
    return NextResponse.json({ error: 'Signature rejected' }, { status: 401 });
  }

  const event = parseDeliveryEvent(rawBody);
  if (!event) {
    // Verified, so it is genuinely Uber — a courier position update or an event
    // kind we do not act on. 200, because refusing makes them redeliver
    // something we will refuse again.
    return NextResponse.json({ received: true, acted: false });
  }

  /**
   * The order is found by our own id where Uber echoed it, and only otherwise
   * by their delivery reference. Trusting `external_id` alone would let a
   * caller name any order; it is inside the signed body, so it is as trusted as
   * the signature — but the recorded handoff is the stronger link, because we
   * wrote it.
   */
  const orderId = event.orderId ?? orderIdForReference('courier', event.deliveryId);
  const order = orderId ? readOrder(orderId) : null;
  if (!order) {
    logger.warn('courier.unknown_delivery', { deliveryId: event.deliveryId });
    return NextResponse.json({ received: true, acted: false });
  }

  /**
   * The driver's estimate, recorded whatever else this event is.
   *
   * Before the status is looked at, because most events carrying an ETA are
   * courier position updates that move no state at all — and those were the
   * ones being thrown away. The journey shows this in place of the window
   * quoted at checkout, which never moves.
   */
  if (event.etaMinutes !== null) setCourierEta(order.id, event.etaMinutes);

  const phase = phaseOf(event.status);
  if (!phase) {
    // A status Uber has added since this was written. Logged and left alone
    // rather than guessed at — marking an order delivered that is sitting in a
    // car is not a recoverable mistake.
    logger.warn('courier.unknown_status', { status: event.status, orderId: order.id });
    return NextResponse.json({ received: true, acted: false });
  }

  const next = orderStatusFor(phase);
  if (!next || next === order.status) {
    return NextResponse.json({ received: true, acted: false, phase });
  }

  const updated = setOrderStatus(order.id, next);
  if (updated) await notifyMoved(updated);

  logger.info('courier.moved', { orderId: order.id, phase, status: next });
  return NextResponse.json({ received: true, acted: true, phase, status: next });
}
