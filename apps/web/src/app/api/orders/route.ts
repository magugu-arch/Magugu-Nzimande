import { CreateOrderRequestSchema } from '@bbq/types';
import { NextResponse } from 'next/server';
import { findStore, isHidden, isSoldOut, servesMode } from '@/lib/catalogue-state';
import { createOrder } from '@/lib/order-store';
import { findPromotion, totalsFor } from '@/lib/pricing';

/**
 * POST /api/orders — create an order.
 *
 * Store service rules are enforced here as well as in the interface: a dine-in
 * order for a store with dine-in switched off is rejected, whatever the client
 * believed when it sent the request.
 */
export async function POST(request: Request) {
  const parsed = CreateOrderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid order', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const order = parsed.data;

  const store = findStore(order.storeId);
  if (!store) {
    return NextResponse.json({ error: 'No such store' }, { status: 404 });
  }

  if (!servesMode(store, order.mode)) {
    return NextResponse.json(
      { error: `${store.name} is not accepting ${order.mode.toLowerCase()} orders` },
      { status: 409 },
    );
  }

  const unavailable = order.lines.filter(
    (line) => isSoldOut(line.slug) || isHidden(line.slug),
  );
  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error: 'Some items are no longer available',
        slugs: unavailable.map((line) => line.slug),
      },
      { status: 409 },
    );
  }

  if (order.promoCode && !findPromotion(order.promoCode)) {
    return NextResponse.json({ error: 'That promo code is not valid' }, { status: 409 });
  }

  // Totals are recomputed from the lines rather than trusted from the client,
  // so a tampered basket cannot set its own price.
  const totals = totalsFor(order.lines, order.mode, order.promoCode);
  const created = createOrder(order);

  return NextResponse.json(
    { order: { ...created, totals } },
    { status: 201 },
  );
}
