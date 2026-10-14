'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { bookingReference } from '@/lib/booking';
import { getShopCatalog } from '@/lib/content';
import { deliver } from '@/lib/delivery';
import { absoluteUrl, IS_PREVIEW, SITE_MODE } from '@/lib/env';
import {
  createBookOrderSession,
  paymentsBlockText,
  paymentsState,
  shippingSetup,
  StripeError,
} from '@/lib/payments';
import { createRateLimiter } from '@/lib/rate-limit';
import { normaliseCart, parseCartField, summariseCart } from '@/lib/shop';

/**
 * Book checkout. The browser sends slugs and quantities only; the server
 * rebuilds the order from its own catalog (so prices cannot be edited in the
 * browser), checks payments and shipping are set up, sends the order to the
 * team, then hands over to Stripe's hosted checkout.
 */

export type CheckoutState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      /** Checkout is off: nothing charged. */
      status: 'payments-off';
      message: string;
      /** Why, for whoever configures the site. Preview only. */
      detail: string | null;
    };

const limiter = createRateLimiter({ limit: 8, windowMs: 10 * 60 * 1000 });

const FAILED =
  'We could not open checkout just now, and nothing was charged. Please try again in a few minutes.';

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

export async function startBookCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  // Bots fill the hidden field: nothing to do.
  const trap = formData.get('website');
  if (typeof trap === 'string' && trap.trim() !== '') return { status: 'idle' };

  const field = formData.get('items');
  const submitted = typeof field === 'string' ? parseCartField(field) : null;
  if (!submitted || submitted.length === 0) {
    return { status: 'error', message: 'Your cart is empty, so there is nothing to check out.' };
  }

  const catalog = getShopCatalog();
  const lines = normaliseCart(submitted, catalog);
  // Anything the catalog changed (an unknown book, too many copies) means the
  // cart on screen is out of date: say so rather than charge something else.
  const same =
    lines.length === submitted.length &&
    lines.every((l, i) => l.slug === submitted[i]!.slug && l.qty === submitted[i]!.qty);
  if (!same) {
    return {
      status: 'error',
      message:
        'Your cart has changed since this page loaded: a book is no longer available or has a lower limit per order. Refresh the page to see the current cart.',
    };
  }

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  if (!limiter.check(`checkout:${ip}`)) {
    return {
      status: 'error',
      message:
        'That is a lot of checkouts in a short time. Please wait a few minutes and try again.',
    };
  }

  const payments = paymentsState();
  const shipping = shippingSetup();
  if (!payments.ready || (SITE_MODE === 'production' && !shipping.rateId)) {
    return {
      status: 'payments-off',
      message:
        'Online payment is not switched on yet, so nothing was charged. Your cart is saved, and each book can still be bought from its official page.',
      detail: IS_PREVIEW
        ? payments.ready
          ? 'Set STRIPE_SHIPPING_RATE_ID to a Stripe shipping rate.'
          : paymentsBlockText[payments.reason]
        : null,
    };
  }

  const summary = summariseCart(lines, catalog);
  const reference = bookingReference(secureRandom);
  const recorded = await deliver(
    'order',
    {
      stage: 'checkout-started',
      reference,
      items: summary.lines.map((l) => ({
        slug: l.slug,
        title: l.item.title,
        quantity: l.qty,
        unitPriceCents: l.item.priceCents,
      })),
      subtotalCents: summary.subtotalCents,
      currency: 'usd',
    },
    { sourcePage: '/cart' },
  );
  if (!recorded.ok) return { status: 'error', message: FAILED };

  let checkoutUrl: string;
  try {
    const session = await createBookOrderSession(
      { secretKey: payments.secretKey },
      {
        reference,
        lines: summary.lines.map((l) => ({
          slug: l.slug,
          title: l.item.title,
          unitAmountCents: l.item.priceCents,
          quantity: l.qty,
        })),
        shipping,
        successUrl: absoluteUrl('/orders/confirmed?session_id={CHECKOUT_SESSION_ID}'),
        cancelUrl: absoluteUrl('/cart?checkout=cancelled'),
      },
    );
    if (!session.url) throw new StripeError('Checkout Session has no URL', 502);
    checkoutUrl = session.url;
  } catch (error) {
    const detail =
      error instanceof StripeError
        ? `${error.status}${error.code ? ` ${error.code}` : ''}`
        : (error as Error).name;
    console.error(`[payments] book checkout for ${reference} failed (${detail}).`);
    return { status: 'error', message: FAILED };
  }
  // Outside the try: redirect() works by throwing.
  redirect(checkoutUrl);
}
