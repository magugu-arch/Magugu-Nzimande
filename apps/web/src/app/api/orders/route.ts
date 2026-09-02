import { CreateOrderRequestSchema } from '@bbq/types';
import { NextResponse } from 'next/server';
import { deliversTo, findStore, servesMode } from '@/lib/catalogue-state';
import { repriceLines } from '@/lib/order-integrity';
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

  // The schema already guarantees a delivery order carries a suburb; this is
  // whether the store it was addressed to actually covers it.
  if (order.mode === 'Delivery' && !deliversTo(store, order.suburb ?? '')) {
    return NextResponse.json(
      { error: `${store.name} does not deliver to ${order.suburb}` },
      { status: 409 },
    );
  }

  /**
   * Every line is priced again from the catalogue. This subsumes the sold-out
   * and hidden checks that used to stand here and closes what they missed: an
   * unknown slug is on neither list, so an invented product used to pass, and
   * the price on every line was whatever the client said it was.
   */
  const repriced = repriceLines(order.lines);
  if (!repriced.ok) {
    return NextResponse.json(
      {
        error: 'Some items are no longer available at the price in your basket',
        problems: repriced.problems,
        slugs: repriced.problems.map((problem) => problem.slug),
      },
      { status: 409 },
    );
  }

  if (order.promoCode && !findPromotion(order.promoCode)) {
    return NextResponse.json({ error: 'That promo code is not valid' }, { status: 409 });
  }

  // Totals come from the re-priced lines, never from the request.
  const lines = repriced.lines;
  const totals = totalsFor(lines, order.mode, order.promoCode);
  const created = createOrder({ ...order, lines });

  return NextResponse.json(
    { order: { ...created, totals } },
    { status: 201 },
  );
}
