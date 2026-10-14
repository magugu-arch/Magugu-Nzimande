import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DemoCheckout } from '@/components/checkout/DemoCheckout';
import { PageHero } from '@/components/layout/PageHero';
import { Section } from '@/components/ui/Section';
import { IS_PREVIEW } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Checkout',
  description: 'Demo payment step for reviewing the checkout journey.',
  path: '/checkout/demo',
  noindex: true,
});

/**
 * Preview only. Stands in for Stripe's hosted checkout while no Stripe key is
 * set; production answers 404 and never links here.
 */
export default function DemoCheckoutPage() {
  if (!IS_PREVIEW) notFound();
  return (
    <>
      <PageHero
        variant="plain"
        eyebrow="Checkout"
        title="Payment"
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Cart', path: '/cart' },
          { name: 'Payment', path: '/checkout/demo' },
        ]}
      />
      <Section tone="charcoal" className="!pt-10">
        <div className="container-site">
          <DemoCheckout />
        </div>
      </Section>
    </>
  );
}
