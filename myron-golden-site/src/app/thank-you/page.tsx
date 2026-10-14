import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/PageHero';
import { ButtonLink } from '@/components/ui/Button';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Thank you',
  description: 'Your subscription is confirmed.',
  path: '/thank-you',
  noindex: true,
});

/** Where the email provider sends people after they confirm their subscription. */
export default function ThankYouPage() {
  return (
    <PageHero
      variant="plain"
      eyebrow="You’re confirmed"
      title="Thank you for signing up"
      intro={
        <p>
          You will receive new teaching, resources and event dates by email. While you wait, the
          free library is a good place to start.
        </p>
      }
      actions={
        <>
          <ButtonLink href="/learn" size="lg" arrow>
            Browse free learning
          </ButtonLink>
          <ButtonLink href="/" size="lg" variant="secondary">
            Back to home
          </ButtonLink>
        </>
      }
    />
  );
}
