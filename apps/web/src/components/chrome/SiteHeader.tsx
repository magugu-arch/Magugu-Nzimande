'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Price } from '@/components/ui/Price';
import { useCartDrawer } from '@/components/cart/CartDrawerProvider';

const NAV: { href: Route; label: string }[] = [
  { href: '/menu', label: 'Menu' },
  { href: '/offers', label: 'Offers' },
  { href: '/rewards', label: 'Rewards' },
  { href: '/stores', label: 'Find a store' },
  { href: '/help', label: 'Help' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { itemCount, totals, hydrated } = useOrdering();
  const { open: openCart } = useCartDrawer();
  const [menuOpen, setMenuOpen] = useState(false);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="mx-auto flex h-[68px] w-full max-w-[1240px] items-center gap-5 px-5">
        <Link href="/" className="flex-none py-2" aria-label="bb.q Chicken, home">
          <Logo height={30} priority />
        </Link>

        <nav className="hidden lg:flex" aria-label="Primary">
          <ul className="flex gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent(item.href) ? 'page' : undefined}
                  className={[
                    'relative block rounded-sm px-3 py-2.5 text-[13px] font-bold transition-colors',
                    isCurrent(item.href) ? 'text-red' : 'text-black hover:bg-paper',
                  ].join(' ')}
                >
                  {item.label}
                  {isCurrent(item.href) && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-1 block h-0.5 rounded-full bg-red"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/account"
            className="grid size-10 place-items-center rounded-full border border-line bg-white transition-colors hover:border-line-strong hover:bg-paper"
            aria-label="Your account"
          >
            <svg viewBox="0 0 20 20" className="size-4.5" aria-hidden="true">
              <path
                fill="currentColor"
                d="M10 10a3.6 3.6 0 1 0 0-7.2A3.6 3.6 0 0 0 10 10Zm0 1.8c-3.1 0-7 1.6-7 3.9V18h14v-2.3c0-2.3-3.9-3.9-7-3.9Z"
              />
            </svg>
          </Link>

          <button
            type="button"
            onClick={openCart}
            className="flex h-11 items-center gap-2.5 rounded-full bg-red pl-4 pr-2 text-[13px] font-bold text-white transition-colors hover:bg-red-deep"
            aria-label={
              hydrated && itemCount > 0
                ? `View basket, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                : 'View basket'
            }
          >
            <span className="hidden sm:inline">
              {hydrated && itemCount > 0 ? <Price cents={totals.totalCents} compact /> : 'Basket'}
            </span>
            <span className="grid h-6.5 min-w-6.5 place-items-center rounded-full bg-white px-1.5 text-xs font-extrabold text-red">
              {hydrated ? itemCount : 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="grid size-10 place-items-center rounded-full border border-line bg-white lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              {menuOpen ? (
                <path
                  fill="currentColor"
                  d="m5.3 4 10.7 10.7-1.3 1.3L4 5.3 5.3 4Zm10.7 1.3L5.3 16 4 14.7 14.7 4 16 5.3Z"
                />
              ) : (
                <path fill="currentColor" d="M3 5h14v1.8H3V5Zm0 4.1h14v1.8H3V9.1ZM3 13.2h14V15H3v-1.8Z" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-line bg-white lg:hidden"
        >
          <ul className="mx-auto w-full max-w-[1240px] px-5 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isCurrent(item.href) ? 'page' : undefined}
                  className={[
                    'block border-b border-line py-3.5 text-sm font-bold last:border-b-0',
                    isCurrent(item.href) ? 'text-red' : 'text-black',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
