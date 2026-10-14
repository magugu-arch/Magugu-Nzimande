'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  availabilityMessages,
  bookingAvailability,
  bookingMode,
  bookingReference,
  formatUsd,
  orderTotal,
  seatsLabel,
} from '@/lib/booking';
import { getEvent } from '@/lib/content';
import { deliver } from '@/lib/delivery';
import { absoluteUrl, IS_PREVIEW } from '@/lib/env';
import { formatEventDate, formatEventTime } from '@/lib/events';
import {
  createCheckoutSession,
  paymentsBlockText,
  paymentsState,
  StripeError,
} from '@/lib/payments';
import { createRateLimiter } from '@/lib/rate-limit';
import { bookingSchema, type FieldErrors, fieldErrors, formDataToObject } from '@/lib/validation';

/**
 * Event bookings. The server decides everything that matters — whether the
 * event takes bookings, how many seats, and the price, which only ever comes
 * from the event record. Nobody is told they are booked unless the details
 * reached the team; nobody pays until Stripe's own page takes the card.
 */

export type BookingState =
  | { status: 'idle' }
  | {
      status: 'error';
      message: string;
      errors: FieldErrors;
      values: Record<string, string | string[]>;
    }
  | {
      /** Paid booking while checkout is off: nothing charged, a request offered instead. */
      status: 'payments-off';
      message: string;
      /** Why, for whoever configures the site. Preview only. */
      detail: string | null;
      values: Record<string, string | string[]>;
    }
  | {
      status: 'success';
      kind: 'request' | 'free';
      title: string;
      message: string;
      reference: string;
      preview: boolean;
    };

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const NOT_SENT =
  'We could not send this just now, so nothing was booked. Please try again in a few minutes.';
const CHECKOUT_FAILED =
  'We could not open checkout just now. Nothing was charged and no seats were booked. Please try again in a few minutes.';
const LIMITED =
  'That is a lot of bookings in a short time, so this one was not sent. Please wait a few minutes and try again.';

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

function echo(raw: Record<string, unknown>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'website' || k === 'intent') continue;
    if (typeof v === 'string') out[k] = v.slice(0, 1000);
  }
  return out;
}

export async function submitBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const raw = formDataToObject(formData);
  const fail = (message: string, errors: FieldErrors = {}): BookingState => ({
    status: 'error',
    message,
    errors,
    values: echo(raw),
  });

  // Bots fill the hidden field: answer as if it worked, record nothing.
  if (typeof raw.website === 'string' && raw.website.trim() !== '') {
    return {
      status: 'success',
      kind: 'request',
      title: 'Request sent',
      message: 'The team will reply by email.',
      reference: bookingReference(secureRandom),
      preview: false,
    };
  }

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return fail('Some details need attention before you continue.', fieldErrors(parsed.error));
  }
  const data = parsed.data;

  const event = getEvent(data.eventSlug);
  if (!event?.booking) return fail('This event does not take bookings on this site.');
  const availability = bookingAvailability(event, Date.now());
  if (availability === 'none') return fail('This event does not take bookings on this site.');
  if (availability !== 'open') return fail(availabilityMessages[availability]);
  const booking = event.booking;
  if (data.quantity > booking.maxPerOrder) {
    return fail('Some details need attention before you continue.', {
      quantity: `Book up to ${booking.maxPerOrder} seats in one order.`,
    });
  }

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  if (!limiter.check(`booking:${ip}`)) return fail(LIMITED);

  const mode = bookingMode(booking);
  const reference = bookingReference(secureRandom);
  const sourcePage = `/events/${event.slug}/book`;
  const total = orderTotal(booking, data.quantity);
  const details = {
    reference,
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    eventStart: event.start,
    ticketName: booking.ticketName,
    quantity: data.quantity,
    unitPriceCents: booking.priceCents,
    totalCents: total,
    currency: 'usd',
    name: data.name,
    email: data.email,
    phone: data.phone,
    attendees: data.attendees,
    accessNeeds: data.accessNeeds,
    termsAcceptedAt: new Date().toISOString(),
  };

  if (mode === 'paid' && data.intent !== 'request') {
    const payments = paymentsState();
    if (!payments.ready) {
      return {
        status: 'payments-off',
        message:
          'Online payment is not switched on for this event yet, so you have not been charged and no seats are booked. You can send a booking request instead, and the team will reply by email.',
        detail: IS_PREVIEW ? paymentsBlockText[payments.reason] : null,
        values: echo(raw),
      };
    }

    // The team gets the full details first; Stripe only gets the reference.
    const recorded = await deliver(
      'booking',
      { stage: 'checkout-started', ...details },
      { sourcePage },
    );
    if (!recorded.ok) return fail(CHECKOUT_FAILED);

    let checkoutUrl: string;
    try {
      const session = await createCheckoutSession(
        { secretKey: payments.secretKey },
        {
          reference,
          eventId: event.id,
          eventSlug: event.slug,
          productName: `${event.title} — ${booking.ticketName}`,
          productDescription: `${formatEventDate(event)} · ${formatEventTime(event)} · ${event.location}`,
          unitAmountCents: booking.priceCents!,
          quantity: data.quantity,
          email: data.email,
          successUrl: absoluteUrl('/bookings/confirmed?session_id={CHECKOUT_SESSION_ID}'),
          cancelUrl: absoluteUrl('/bookings/cancelled'),
        },
      );
      if (!session.url) throw new StripeError('Checkout Session has no URL', 502);
      checkoutUrl = session.url;
    } catch (error) {
      const detail =
        error instanceof StripeError
          ? `${error.status}${error.code ? ` ${error.code}` : ''}`
          : (error as Error).name;
      console.error(`[payments] checkout session for ${reference} failed (${detail}).`);
      return fail(CHECKOUT_FAILED);
    }
    // Outside the try: redirect() works by throwing.
    redirect(checkoutUrl);
  }

  const stage = mode === 'free' ? 'free-registration' : 'request';
  const result = await deliver('booking', { stage, ...details }, { sourcePage });
  if (!result.ok) return fail(NOT_SENT);

  const preview = result.channel === 'preview-log';
  if (mode === 'free') {
    return {
      status: 'success',
      kind: 'free',
      title: 'Registration sent',
      message: `${seatsLabel(data.quantity)} at ${event.title}. The team will email ${data.email} to confirm your place.`,
      reference,
      preview,
    };
  }
  return {
    status: 'success',
    kind: 'request',
    title: 'Request sent',
    message: `This is a request, not a confirmed booking. The team will check availability for ${seatsLabel(data.quantity)} and reply to ${data.email} to confirm${
      total === null ? ' the price,' : ''
    } your seats and how to pay${total === null ? '' : ` (${formatUsd(total)} in total)`}.`,
    reference,
    preview,
  };
}
