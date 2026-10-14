'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { primaryCta, primaryNav } from '@/content/site';
import { cn } from '@/lib/cn';
import { MenuIcon, SearchIcon } from '../ui/icons';
import { MobileDrawer } from './MobileDrawer';
import { Wordmark } from './Wordmark';

function subscribeScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

/**
 * Transparent over the hero; once the page moves, a translucent material
 * arrives under it (blur and tint animate together) with a soft scroll-edge
 * fade instead of a hard divider.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const elevated = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 16,
    () => false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <header className="site-header" data-elevated={elevated || menuOpen ? 'true' : 'false'}>
        <div className="container-site relative flex h-full items-center justify-between gap-4">
          <Wordmark />

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-[clamp(0.9rem,1.6vw,1.75rem)]">
              {primaryNav.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative py-2 text-[0.8125rem] font-medium tracking-[0.01em] whitespace-nowrap transition-colors duration-200 xl:text-[0.875rem]',
                        active ? 'text-ivory' : 'text-ivory/72 hover:text-ivory',
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-x-0 -bottom-0.5 h-px origin-left bg-gold transition-transform duration-500 ease-[var(--ease-out-quint)]',
                          active ? 'scale-x-100' : 'scale-x-0',
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/search"
              className="pressable grid size-11 place-items-center rounded-full text-ivory/85 hover:bg-ivory/10 hover:text-ivory"
            >
              <SearchIcon size={20} />
              <span className="sr-only">Search</span>
            </Link>
            <Link
              href={primaryCta.href}
              className="pressable hidden h-10 items-center rounded-full bg-gold px-4.5 text-[0.85rem] font-semibold text-ink hover:bg-gold-bright sm:inline-flex"
            >
              {primaryCta.label}
            </Link>
            <button
              ref={menuButton}
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen(true)}
              className="pressable -mr-2 grid size-11 place-items-center rounded-full text-ivory hover:bg-ivory/10 lg:hidden"
            >
              <MenuIcon size={22} />
              <span className="sr-only">Open menu</span>
            </button>
          </div>
        </div>
      </header>
      <MobileDrawer
        open={menuOpen}
        onClose={closeMenu}
        returnFocusTo={menuButton}
        pathname={pathname}
      />
    </>
  );
}
