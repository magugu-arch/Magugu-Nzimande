import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/layout/PageHero';
import { CartView } from '@/components/shop/CartView';
import { Section } from '@/components/ui/Section';
import { getShopCatalog } from '@/lib/content';
import { IS_PREVIEW, SITE_MODE } from '@/lib/env';
import { paymentsState, shippingSetup } from '@/lib/payments';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Your cart',
  description: 'Books in your cart, ready to check out.',
  path: '/cart',
  noindex: true,
});

/**
 * The page is static: the cart itself lives in the browser and is drawn
 * there. With no book on sale (production before prices are confirmed)
 * there is no cart at all.
 */
export default function CartPage() {
  const catalog = getShopCatalog();
  if (catalog.length === 0) notFound();
  const shipping = shippingSetup();
  const checkoutReady =
    paymentsState().ready && (SITE_MODE === 'preview' || shipping.rateId !== null);

  return (
    <>
      <PageHero
        variant="plain"
        eyebrow="Books"
        title="Your cart"
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Books', path: '/books' },
          { name: 'Cart', path: '/cart' },
        ]}
      />
      <Section tone="charcoal" className="!pt-10">
        <div className="container-site">
          <CartView
            catalog={catalog}
            checkoutReady={checkoutReady}
            shippingReady={shipping.rateId !== null}
            preview={IS_PREVIEW}
          />
        </div>
      </Section>
    </>
  );
}
