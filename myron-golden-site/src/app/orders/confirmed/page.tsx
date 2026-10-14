import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackOnce } from '@/components/booking/TrackOnce';
import { ClearCartOnPaid } from '@/components/shop/ClearCartOnPaid';
import { ButtonLink } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { CheckIcon, ClockIcon } from '@/components/ui/icons';
import { BOOKING_REFERENCE, formatUsd } from '@/lib/booking';
import { type CheckoutOutcome, lookupCheckout } from '@/lib/checkout-result';
import { getBook } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';
import { parseCartField } from '@/lib/shop';

export const metadata: Metadata = pageMetadata({
  title: 'Your order',
  description: 'The result of your book order checkout.',
  path: '/orders/confirmed',
  noindex: true,
});

/** Where Stripe sends people after paying for books. "Paid" only when Stripe says so. */
export default function OrderConfirmedPage({ searchParams }: PageProps<'/orders/confirmed'>) {
  return (
    <Section tone="ink" className="pt-[calc(var(--header-h)+4rem)]">
      <div className="container-site max-w-2xl">
        <Suspense
          fallback={
            <div role="status">
              <h1 className="type-display-md">Checking your payment…</h1>
              <p className="mt-4 text-ivory/75">This takes a moment.</p>
            </div>
          }
        >
          <Result searchParams={searchParams} />
        </Suspense>
      </div>
    </Section>
  );
}

async function Result({ searchParams }: Pick<PageProps<'/orders/confirmed'>, 'searchParams'>) {
  const { session_id } = await searchParams;
  const outcome = await lookupCheckout(typeof session_id === 'string' ? session_id : undefined);

  if (
    (outcome.kind === 'paid' || outcome.kind === 'processing') &&
    outcome.session.metadata?.kind === 'books'
  ) {
    const { session } = outcome;
    const paid = outcome.kind === 'paid';
    const items = parseCartField(session.metadata?.items ?? '') ?? [];
    const reference =
      session.client_reference_id && BOOKING_REFERENCE.test(session.client_reference_id)
        ? session.client_reference_id
        : null;
    return (
      <div>
        {paid ? (
          <>
            <ClearCartOnPaid />
            <TrackOnce event="checkout_complete" params={{ order: 'books' }} />
          </>
        ) : null}
        <span className="grid size-14 place-items-center rounded-full bg-gold text-ink">
          {paid ? <CheckIcon size={28} /> : <ClockIcon size={28} />}
        </span>
        <h1 className="type-display-md mt-6">
          {paid ? 'Thank you for your order' : 'Payment processing'}
        </h1>
        <p className="type-lede mt-4 text-ivory/80">
          {paid
            ? 'Stripe has confirmed your payment for the books below.'
            : 'Stripe has your payment details and is processing them. Nothing more is needed from you now.'}
        </p>
        <dl className="mt-10 grid gap-x-8 gap-y-5 rounded-2xl bg-charcoal p-7 ring-1 ring-ivory/10 sm:grid-cols-2">
          {reference ? (
            <div className="min-w-0">
              <dt className="type-eyebrow text-ivory/55">Reference</dt>
              <dd className="mt-1 font-display text-[1.5rem] tracking-[0.04em] text-gold-bright">
                {reference}
              </dd>
            </div>
          ) : null}
          {session.amount_total !== null && session.currency === 'usd' ? (
            <div className="min-w-0">
              <dt className="type-eyebrow text-ivory/55">{paid ? 'Paid' : 'Amount'}</dt>
              <dd className="mt-1">{formatUsd(session.amount_total)}</dd>
            </div>
          ) : null}
          {items.length > 0 ? (
            <div className="min-w-0 sm:col-span-2">
              <dt className="type-eyebrow text-ivory/55">Books</dt>
              <dd className="mt-1">
                <ul className="space-y-1">
                  {items.map((i) => (
                    <li key={i.slug}>
                      {getBook(i.slug)?.title ?? i.slug} × {i.qty}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {session.customer_details?.email ? (
            <div className="min-w-0 sm:col-span-2">
              <dt className="type-eyebrow text-ivory/55">Email</dt>
              <dd className="mt-1 break-words">{session.customer_details.email}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-6 text-ivory/70">
          Quote your reference if you contact the team about this order.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/books" variant="secondary">
            Back to books
          </ButtonLink>
          <ButtonLink href="/contact?topic=support" variant="ghost">
            Contact the team
          </ButtonLink>
        </div>
      </div>
    );
  }

  const copy: Record<Exclude<CheckoutOutcome['kind'], 'paid' | 'processing'>, [string, string]> = {
    unfinished: [
      'Checkout was not finished',
      'Stripe has not taken a payment for this order. Your cart is saved, so you can go back and try again.',
    ],
    expired: [
      'This checkout has expired',
      'Nothing was charged. Your cart is saved; check out again when you are ready.',
    ],
    unknown: [
      'We could not find that order',
      'The link may be incomplete. If you completed a payment, contact the team and they will find your order.',
    ],
    unavailable: [
      'We could not check this payment just now',
      'Please refresh this page in a moment. If it keeps happening, contact the team before ordering again, so you are not charged twice.',
    ],
  };
  const kind = outcome.kind === 'paid' || outcome.kind === 'processing' ? 'unknown' : outcome.kind;
  const [title, body] = copy[kind];
  return (
    <div>
      <h1 className="type-display-md">{title}</h1>
      <p className="type-lede mt-4 text-ivory/80">{body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/cart" arrow>
          Go to your cart
        </ButtonLink>
        <ButtonLink href="/contact?topic=support" variant="secondary">
          Contact the team
        </ButtonLink>
      </div>
    </div>
  );
}
