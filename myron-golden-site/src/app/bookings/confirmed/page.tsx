import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackOnce } from '@/components/booking/TrackOnce';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { CheckIcon, ClockIcon } from '@/components/ui/icons';
import { BOOKING_REFERENCE, formatUsd, seatsLabel } from '@/lib/booking';
import { getEvent } from '@/lib/content';
import { formatEventDate } from '@/lib/events';
import {
  CHECKOUT_SESSION_ID,
  type CheckoutSession,
  paymentsState,
  retrieveCheckoutSession,
  StripeError,
} from '@/lib/payments';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Booking',
  description: 'The result of your booking checkout.',
  path: '/bookings/confirmed',
  noindex: true,
});

/**
 * Where Stripe sends people after checkout. The page never trusts the URL:
 * it asks Stripe for the session and says "paid" only when Stripe does.
 */
export default function ConfirmedPage({ searchParams }: PageProps<'/bookings/confirmed'>) {
  return (
    <Section tone="ink" className="pt-[calc(var(--header-h)+4rem)]">
      <div className="container-site max-w-2xl">
        <Suspense fallback={<Checking />}>
          <Result searchParams={searchParams} />
        </Suspense>
      </div>
    </Section>
  );
}

function Checking() {
  return (
    <div role="status">
      <h1 className="type-display-md">Checking your payment…</h1>
      <p className="mt-4 text-ivory/75">This takes a moment.</p>
    </div>
  );
}

type Outcome =
  | { kind: 'paid'; session: CheckoutSession }
  | { kind: 'processing'; session: CheckoutSession }
  | { kind: 'unfinished'; session: CheckoutSession }
  | { kind: 'expired' }
  | { kind: 'unknown' }
  | { kind: 'unavailable' };

async function lookup(id: string | undefined): Promise<Outcome> {
  if (!id || !CHECKOUT_SESSION_ID.test(id)) return { kind: 'unknown' };
  const payments = paymentsState();
  if (!payments.ready) return { kind: 'unavailable' };
  try {
    const session = await retrieveCheckoutSession({ secretKey: payments.secretKey }, id);
    if (session.status === 'expired') return { kind: 'expired' };
    if (session.payment_status === 'paid') return { kind: 'paid', session };
    if (session.status === 'complete') return { kind: 'processing', session };
    return { kind: 'unfinished', session };
  } catch (error) {
    // Stripe answers 404 for a session it does not know; anything else is an outage.
    return error instanceof StripeError && error.status === 404
      ? { kind: 'unknown' }
      : { kind: 'unavailable' };
  }
}

async function Result({ searchParams }: Pick<PageProps<'/bookings/confirmed'>, 'searchParams'>) {
  const { session_id } = await searchParams;
  const outcome = await lookup(typeof session_id === 'string' ? session_id : undefined);

  if (outcome.kind === 'paid' || outcome.kind === 'processing') {
    const { session } = outcome;
    const event = session.metadata?.eventSlug ? getEvent(session.metadata.eventSlug) : undefined;
    const quantity = Number(session.metadata?.quantity) || null;
    const reference =
      session.client_reference_id && BOOKING_REFERENCE.test(session.client_reference_id)
        ? session.client_reference_id
        : null;
    const paid = outcome.kind === 'paid';
    return (
      <div>
        {paid ? (
          <TrackOnce event="checkout_complete" params={{ event: event?.slug ?? '' }} />
        ) : null}
        <span className="grid size-14 place-items-center rounded-full bg-gold text-ink">
          {paid ? <CheckIcon size={28} /> : <ClockIcon size={28} />}
        </span>
        <h1 className="type-display-md mt-6">{paid ? 'Payment received' : 'Payment processing'}</h1>
        <p className="type-lede mt-4 text-ivory/80">
          {paid
            ? 'Stripe has confirmed your payment, and your seats are booked.'
            : 'Stripe has your payment details and is processing them. Nothing more is needed from you now.'}
        </p>
        <dl className="mt-10 grid gap-x-8 gap-y-5 rounded-2xl bg-charcoal p-7 ring-1 ring-ivory/10 sm:grid-cols-2">
          {reference ? <Item label="Reference" value={reference} strong /> : null}
          {event ? <Item label="Event" value={event.title} /> : null}
          {event ? <Item label="Date" value={formatEventDate(event)} /> : null}
          {quantity ? <Item label="Seats" value={seatsLabel(quantity)} /> : null}
          {session.amount_total !== null && session.currency === 'usd' ? (
            <Item label={paid ? 'Paid' : 'Amount'} value={formatUsd(session.amount_total)} />
          ) : null}
          {session.customer_details?.email ? (
            <Item label="Email" value={session.customer_details.email} />
          ) : null}
        </dl>
        <p className="mt-6 text-ivory/70">
          Quote your reference if you contact the team about this booking.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {event ? (
            <ButtonLink href={`/events/${event.slug}`} variant="secondary">
              Back to the event
            </ButtonLink>
          ) : null}
          <ButtonLink href="/contact?topic=support" variant="ghost">
            Contact the team
          </ButtonLink>
        </div>
      </div>
    );
  }

  const copy: Record<Exclude<Outcome['kind'], 'paid' | 'processing'>, [string, string]> = {
    unfinished: [
      'Checkout was not finished',
      'Stripe has not taken a payment for this booking, so no seats are booked. You can go back to the event and start again.',
    ],
    expired: [
      'This checkout has expired',
      'Nothing was charged and no seats were booked. Start a new booking from the event page.',
    ],
    unknown: [
      'We could not find that checkout',
      'The link may be incomplete. If you completed a payment, contact the team and they will find your booking; otherwise start a new booking from the event page.',
    ],
    unavailable: [
      'We could not check this payment just now',
      'Please refresh this page in a moment. If it keeps happening, contact the team before booking again, so you are not charged twice.',
    ],
  };
  const [title, body] = copy[outcome.kind];
  const eventSlug = outcome.kind === 'unfinished' ? outcome.session.metadata?.eventSlug : undefined;
  return (
    <div>
      <h1 className="type-display-md">{title}</h1>
      <p className="type-lede mt-4 text-ivory/80">{body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={eventSlug ? `/events/${eventSlug}/book` : '/events'} arrow>
          {eventSlug ? 'Back to booking' : 'See events'}
        </ButtonLink>
        <ButtonLink href="/contact?topic=support" variant="secondary">
          Contact the team
        </ButtonLink>
      </div>
    </div>
  );
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow text-ivory/55">{label}</dt>
      <dd
        className={
          strong
            ? 'mt-1 font-display text-[1.5rem] tracking-[0.04em] text-gold-bright'
            : 'mt-1 break-words'
        }
      >
        {value}
      </dd>
    </div>
  );
}
