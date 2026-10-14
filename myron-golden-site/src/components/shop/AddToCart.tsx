'use client';

import Link from 'next/link';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import type { ShopItem } from '@/lib/shop';
import { type ButtonSize, type ButtonVariant, buttonClasses } from '../ui/Button';
import { BagIcon, CheckIcon } from '../ui/icons';
import { cart } from './cart-store';

/**
 * Adds one copy and says so right beside the button, with the way to the
 * cart — no modal, nothing to dismiss. At the per-order limit it explains
 * instead of silently doing nothing.
 */
export function AddToCart({
  item,
  variant = 'primary',
  size = 'lg',
  tone = 'dark',
}: {
  item: Pick<ShopItem, 'slug' | 'title' | 'maxPerOrder'>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: 'dark' | 'light';
}) {
  const [status, setStatus] = useState<{ qty: number; atLimit: boolean } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <button
        type="button"
        data-add-to-cart={item.slug}
        data-max={item.maxPerOrder}
        onClick={() => {
          const { before, after } = cart.add(item.slug, item.maxPerOrder);
          setStatus({ qty: after, atLimit: before === after });
          if (before !== after) track('add_to_cart', { item: item.slug });
        }}
        className={buttonClasses(variant, size)}
      >
        <BagIcon size={18} />
        Add to cart
      </button>
      <p
        role="status"
        data-cart-added
        className={cn(
          'flex min-h-6 items-center gap-1.5 text-[0.9rem]',
          tone === 'dark' ? 'text-ivory/80' : 'text-slate',
        )}
      >
        {status ? (
          <>
            <CheckIcon size={16} className={tone === 'dark' ? 'text-gold' : 'text-gold-deep'} />
            <span>
              {status.atLimit
                ? `${status.qty} is the most copies for one order.`
                : `Added. ${status.qty} in your cart.`}{' '}
              <Link
                href="/cart"
                className={cn(
                  'font-semibold underline underline-offset-4',
                  tone === 'dark' ? 'text-gold-bright hover:text-ivory' : 'text-ink',
                )}
              >
                View cart
              </Link>
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
