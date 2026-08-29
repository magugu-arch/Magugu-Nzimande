import type { Product, Store } from '@bbq/types';
import type { ReactNode } from 'react';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartDrawerProvider } from '@/components/cart/CartDrawerProvider';
import { OrderingProvider } from '@/components/ordering/OrderingProvider';
import { AnnouncementStrip } from './AnnouncementStrip';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { StickyBasketBar } from './StickyBasketBar';
import { UtilityBar } from './UtilityBar';

/**
 * The chrome every route sits inside. Stores, promo codes and side suggestions
 * are resolved on the server and handed down, so the client never reads seed
 * data and the header renders with real values on first paint.
 */
export function SiteShell({
  stores,
  promoCodes,
  suggestions,
  children,
}: {
  stores: readonly Store[];
  promoCodes: readonly string[];
  suggestions: readonly Product[];
  children: ReactNode;
}) {
  return (
    <OrderingProvider stores={stores} promoCodes={promoCodes}>
      <CartDrawerProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-full focus:bg-black focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
        >
          Skip to content
        </a>
        <AnnouncementStrip />
        <UtilityBar />
        <SiteHeader />
        <main id="main" className="min-h-[62vh]">
          {children}
        </main>
        <SiteFooter />
        <CartDrawer suggestions={suggestions} />
        <StickyBasketBar />
      </CartDrawerProvider>
    </OrderingProvider>
  );
}
