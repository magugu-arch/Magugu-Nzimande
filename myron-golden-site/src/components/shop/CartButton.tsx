'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { springs } from '@/lib/motion';
import { normaliseCart, type ShopItem, summariseCart } from '@/lib/shop';
import { BagIcon } from '../ui/icons';
import { useCartLines, useCartPulse } from './cart-store';

/**
 * The bag in the header. When a book is added the count badge pops — a
 * small spring from slightly larger back to rest, so the add is felt where
 * the cart lives. It stays still on page load, on removals and with reduced
 * motion.
 */
export function CartButton({ catalog }: { catalog: ShopItem[] }) {
  const lines = useCartLines();
  const { count } = summariseCart(normaliseCart(lines, catalog), catalog);
  const pulse = useCartPulse();
  const reduce = useReducedMotion();

  return (
    <Link
      href="/cart"
      data-cart-link
      aria-label={count > 0 ? `Cart, ${count} ${count === 1 ? 'book' : 'books'}` : 'Cart, empty'}
      className="pressable relative grid size-11 place-items-center rounded-full text-ivory/85 hover:bg-ivory/10 hover:text-ivory"
    >
      <BagIcon size={20} />
      <motion.span
        key={pulse}
        data-cart-count
        hidden={count === 0}
        aria-hidden="true"
        initial={pulse > 0 && !reduce ? { scale: 1.45 } : false}
        animate={{ scale: 1 }}
        transition={springs.flick}
        className="absolute top-1 right-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-gold px-1 text-[0.6875rem] leading-none font-bold text-ink tabular-nums"
      >
        {count}
      </motion.span>
    </Link>
  );
}
