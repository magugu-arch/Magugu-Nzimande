'use client';

import { usePathname } from 'next/navigation';
import { useCartDrawer } from '@/components/cart/CartDrawerProvider';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Price } from '@/components/ui/Price';

/**
 * The running basket total on small screens, where the header's basket button
 * scrolls away. Hidden on checkout, where the same numbers are already on screen.
 */
export function StickyBasketBar() {
  const { itemCount, totals, hydrated } = useOrdering();
  const { open, isOpen } = useCartDrawer();
  const pathname = usePathname();

  const suppressed = pathname.startsWith('/checkout') || isOpen;
  if (!hydrated || itemCount === 0 || suppressed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white p-3 shadow-e2 lg:hidden">
      <button
        type="button"
        onClick={open}
        className="flex h-12 w-full items-center justify-between rounded-full bg-red px-5 text-sm font-bold text-white"
      >
        <span>
          View basket ({itemCount})
        </span>
        <Price cents={totals.totalCents} />
      </button>
    </div>
  );
}
