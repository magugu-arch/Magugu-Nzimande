import { FEES } from '@bbq/seed';
import { DeliveryQuoteRequestSchema, type DeliveryQuote } from '@bbq/types';
import { NextResponse } from 'next/server';
import { currentStores } from '@/lib/catalogue-state';

/** POST /api/delivery/quote — { suburb, subtotalCents } to a fee and an ETA. */
export async function POST(request: Request) {
  const parsed = DeliveryQuoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    /**
     * The schema's wording, and the field it belongs to.
     *
     * This answered "Invalid quote request" with the raw Zod issues attached
     * under `issues` — a key no client has ever read, describing our schema
     * rather than the customer's problem. Meanwhile the rule they had actually
     * broken carried "Enter your suburb" and nobody ever saw it.
     *
     * The order route found the same thing on the endpoint one step later and
     * wrote down why: a message that is not about what the person did is a form
     * they cannot fix. This runs earlier — it is what decides whether they can
     * have it delivered at all — so it is the first refusal at checkout most
     * customers will ever meet.
     */
    const fields = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return NextResponse.json(
      { error: fields[0]?.message ?? 'Check the delivery address', fields },
      { status: 400 },
    );
  }

  const { suburb, subtotalCents } = parsed.data;
  const wanted = suburb.trim().toLowerCase();

  const store = currentStores().find(
    (candidate) =>
      candidate.services.Delivery &&
      candidate.zones.some((zone) => zone.toLowerCase() === wanted),
  );

  if (!store) {
    const quote: DeliveryQuote = {
      serviceable: false,
      reason:
        'We do not deliver to this suburb yet. Collection is available at both stores.',
    };
    return NextResponse.json({ quote });
  }

  const quote: DeliveryQuote = {
    serviceable: true,
    feeCents: subtotalCents >= FEES.freeDeliveryOverCents ? 0 : FEES.deliveryCents,
    // The quoted window's upper bound, so the number at checkout is never
    // beaten by the one the customer is actually waiting for.
    etaMinutes: FEES.deliveryEtaMinutes.max,
    storeId: store.id,
  };
  return NextResponse.json({ quote });
}
