import { CreateOrderRequestSchema } from '@bbq/types';
import { NextResponse } from 'next/server';
import { deliversTo, findStore, servesMode } from '@/lib/catalogue-state';
import { repriceLines } from '@/lib/order-integrity';
import { currentAccount } from '@/lib/accounts/session';
import { createOrder, ordersForAccount } from '@/lib/order-store';
import { notifyPlaced } from '@/lib/notifications/send';
import type { Promotion } from '@bbq/types';
import { totalsFor } from '@/lib/pricing';
import { promotionFor } from '@/lib/promotions';
import { isOpenNow } from '@/lib/trading';

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

  /**
   * The store has to be open.
   *
   * The site displayed "Open" and "Closed" in the header and on the store list
   * from the day it was built and never checked either: an order at three in
   * the morning was accepted, priced, confirmed and sent to a kitchen nobody
   * was standing in. Refused here rather than in the browser, because a clock
   * is the easiest thing in the world for a client to be wrong about.
   *
   * Refusing is the whole behaviour. Ordering ahead for a later slot is a
   * feature this build does not have, and pretending to take an order now for
   * a kitchen that opens in nine hours would be worse than saying no.
   */
  if (!isOpenNow(store)) {
    return NextResponse.json(
      { error: `${store.name} is closed. Trading hours are ${store.hours.label}.` },
      { status: 409 },
    );
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

  /**
   * Bound to the signed-in customer, if there is one.
   *
   * Read off the session cookie rather than taken from the body: an accountId a
   * caller could send is an accountId a caller could send somebody else's, and
   * the order history endpoint trusts this field. A guest checkout stays a
   * guest checkout and gets null.
   */
  const account = currentAccount(request);

  /**
   * The offer, against its own advertised conditions.
   *
   * Checked here and nowhere else that matters. The browser applies what it can
   * see for the basket preview, but a day, a time and a first-order rule are
   * all things a client can simply not send — so the server resolves the code
   * itself and prices from what it resolved.
   */
  let promotion: Promotion | null = null;
  if (order.promoCode) {
    const eligible = promotionFor(order.promoCode, {
      mode: order.mode,
      // A guest is never on their first order in the sense the offer means:
      // there is no account to remember that they used it.
      isFirstOrder: account ? ordersForAccount(account.id).length === 0 : false,
    });

    if (!eligible.ok) {
      return NextResponse.json({ error: eligible.reason }, { status: 409 });
    }
    promotion = eligible.promotion;
  }

  // Totals come from the re-priced lines, never from the request.
  const lines = repriced.lines;
  const totals = totalsFor(lines, order.mode, promotion);

  const created = createOrder({ ...order, lines }, account?.id ?? null, promotion);

  /**
   * Points are deliberately not credited here.
   *
   * They post when the order completes, in `postPoints` inside the order store.
   * Crediting them at placement meant a signed-in customer could place an
   * order, take the points and cancel it — and it contradicted the rewards
   * page, which says points post once an order is completed.
   *
   * They still follow the account rather than the browser, so they survive a
   * new phone; a guest earns none, because there is no account for them to
   * land on.
   */

  // Awaited, but it cannot fail the order: `notifyPlaced` records what it could
  // not send and returns. The food is already being made by this point, and a
  // 500 because a confirmation bounced tells the customer the opposite of what
  // has happened.
  await notifyPlaced({ ...created, totals });

  return NextResponse.json(
    { order: { ...created, totals } },
    { status: 201 },
  );
}
