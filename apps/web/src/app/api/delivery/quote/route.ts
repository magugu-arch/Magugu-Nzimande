import { FEES } from '@bbq/seed';
import { DeliveryQuoteRequestSchema, type DeliveryQuote } from '@bbq/types';
import { NextResponse } from 'next/server';
import { currentStores } from '@/lib/catalogue-state';

/** POST /api/delivery/quote — { suburb, subtotalCents } to a fee and an ETA. */
export async function POST(request: Request) {
  const parsed = DeliveryQuoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid quote request', issues: parsed.error.issues },
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
