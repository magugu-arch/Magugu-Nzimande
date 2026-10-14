import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/PageHero';
import { ButtonLink } from '@/components/ui/Button';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Checkout cancelled',
  description: 'You left checkout before paying.',
  path: '/bookings/cancelled',
  noindex: true,
});

/** Where Stripe sends people who leave checkout. Nothing was charged; say so first. */
export default function CheckoutCancelledPage() {
  return (
    <PageHero
      variant="plain"
      eyebrow="Checkout cancelled"
      title="Nothing was charged"
      intro={
        <p>
          You left checkout before paying, so no seats were booked. You can start again from the
          event whenever you are ready.
        </p>
      }
      actions={
        <>
          <ButtonLink href="/events" size="lg" arrow>
            Back to events
          </ButtonLink>
          <ButtonLink href="/contact?topic=support" size="lg" variant="secondary">
            Ask the team a question
          </ButtonLink>
        </>
      }
    />
  );
}
