import { CRAFT_LINE } from '@bbq/seed';
import type { Route } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { DemoNotice } from '@/components/ui/DemoValue';

const COLUMNS: { heading: string; links: { href: Route; label: string }[] }[] = [
  {
    heading: 'Order',
    links: [
      { href: '/menu', label: 'Menu' },
      { href: '/offers', label: 'Offers' },
      { href: '/rewards', label: 'Rewards' },
      { href: '/checkout', label: 'Checkout' },
    ],
  },
  {
    heading: 'Visit',
    links: [
      { href: '/stores', label: 'Find a store' },
      { href: '/journey', label: 'My journey' },
      { href: '/account', label: 'Account' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/help', label: 'Help and allergens' },
      { href: '/app', label: 'The app' },
      { href: '/admin', label: 'Operations console' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-black text-white">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo reversed height={30} />
            <p className="mt-4 max-w-xs text-sm text-white/70">{CRAFT_LINE}</p>
            <p className="mt-3 text-sm text-white/50">
              Korean fried chicken in Johannesburg. Delivery, collection and dine-in.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="display text-base tracking-[0.14em] text-gold">{column.heading}</h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-white/15 pt-6">
          <DemoNotice className="max-w-2xl text-white/50" />
          <p className="mt-3 text-xs text-white/40">
            &copy; {new Date().getFullYear()} bb.q Chicken South Africa. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
