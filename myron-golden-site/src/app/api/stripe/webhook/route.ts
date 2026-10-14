import { deliver } from '@/lib/delivery';
import { verifyWebhookSignature } from '@/lib/payments';

/**
 * Stripe → this site, once a payment settles. The booking reference links it
 * to the details the team received when checkout started. Anything but a
 * 2xx makes Stripe retry for up to three days, so a delivery failure answers
 * 500 rather than dropping a paid booking. Stripe can deliver an event more
 * than once: the receiver should de-duplicate on `stripeEventId`.
 */

interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: {
    object: {
      id: string;
      payment_status?: string;
      amount_total?: number | null;
      currency?: string | null;
      client_reference_id?: string | null;
      payment_intent?: string | null;
      customer_details?: {
        email?: string | null;
        name?: string | null;
        phone?: string | null;
      } | null;
      /** Where Stripe puts the delivery address depends on the API version. */
      shipping_details?: unknown;
      collected_information?: { shipping_details?: unknown } | null;
      shipping_cost?: { amount_total?: number | null } | null;
      metadata?: Record<string, string> | null;
    };
  };
}

const SETTLED = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response('Payments are not configured.', { status: 503 });

  // The signature covers the raw body, so read it as text before parsing.
  const payload = await request.text();
  if (!verifyWebhookSignature(payload, request.headers.get('stripe-signature'), secret)) {
    return new Response('Invalid signature.', { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return new Response('Invalid payload.', { status: 400 });
  }

  const session = event.data?.object;
  const failed = event.type === 'checkout.session.async_payment_failed';
  const settled = SETTLED.has(event.type) && session?.payment_status === 'paid';

  // Other events, and card-on-file sessions still settling, need nothing from us yet.
  if (!session || (!settled && !failed)) return Response.json({ received: true });

  // Book orders carry the delivery address the team ships to.
  if (session.metadata?.kind === 'books') {
    const order = await deliver(
      'order',
      {
        stage: failed ? 'payment-failed' : 'paid',
        reference: session.client_reference_id ?? null,
        items: session.metadata.items ?? null,
        amountTotalCents: session.amount_total ?? null,
        shippingCents: session.shipping_cost?.amount_total ?? null,
        currency: session.currency ?? null,
        name: session.customer_details?.name ?? null,
        email: session.customer_details?.email ?? null,
        phone: session.customer_details?.phone ?? null,
        shipping:
          session.collected_information?.shipping_details ?? session.shipping_details ?? null,
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent ?? null,
        stripeEventId: event.id,
        livemode: event.livemode,
      },
      { sourcePage: '/api/stripe/webhook' },
    );
    if (!order.ok) return new Response('Could not record the order.', { status: 500 });
    return Response.json({ received: true });
  }

  const result = await deliver(
    'booking',
    {
      stage: failed ? 'payment-failed' : 'paid',
      reference: session.client_reference_id ?? null,
      eventId: session.metadata?.eventId ?? null,
      eventSlug: session.metadata?.eventSlug ?? null,
      quantity: Number(session.metadata?.quantity) || null,
      amountTotalCents: session.amount_total ?? null,
      currency: session.currency ?? null,
      email: session.customer_details?.email ?? null,
      stripeSessionId: session.id,
      stripePaymentIntent: session.payment_intent ?? null,
      stripeEventId: event.id,
      livemode: event.livemode,
    },
    { sourcePage: '/api/stripe/webhook' },
  );
  if (!result.ok) return new Response('Could not record the booking.', { status: 500 });
  return Response.json({ received: true });
}
