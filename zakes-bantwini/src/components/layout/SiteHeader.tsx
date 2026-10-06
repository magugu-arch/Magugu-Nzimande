'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PRIMARY_NAV } from '@/lib/site';
import { SiteMenu } from './SiteMenu';
import styles from './SiteHeader.module.css';

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Transparent over the hero, solid black once the page scrolls (brief §03).
 * Desktop: wordmark | Music | Videos | Live | Book Zakes | Story | Legacy | Menu.
 * Mobile: Menu | Zakes | Book.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the menu when the route changes (state adjusted during render, not in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  const closeMenu = () => {
    setMenuOpen(false);
    menuButton.current?.focus();
  };

  return (
    <>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={`${styles.header} ${solid ? styles.solid : ''}`} data-solid={solid || undefined}>
        <div className={styles.inner}>
          <button
            ref={menuButton}
            type="button"
            className={`${styles.menuButton} ${styles.mobileOnly}`}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            Menu
          </button>

          <Link href="/" className={styles.wordmark} aria-label="Zakes Bantwini — home">
            <span className={styles.desktopOnly}>Zakes Bantwini</span>
            <span className={styles.mobileOnly} aria-hidden="true">
              Zakes
            </span>
          </Link>

          <nav className={`${styles.nav} ${styles.desktopOnly}`} aria-label="Primary">
            <ul role="list">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={item.href === '/book' ? styles.book : styles.link}
                    aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                    data-cursor={item.href === '/book' ? 'Book' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            className={`${styles.menuButton} ${styles.desktopOnly}`}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            Menu
            <span className={styles.menuGlyph} aria-hidden="true" />
          </button>

          <Link href="/book" className={`${styles.book} ${styles.mobileOnly}`} aria-label="Book Zakes">
            Book
          </Link>
        </div>
      </header>
      <SiteMenu open={menuOpen} onClose={closeMenu} pathname={pathname} />
    </>
  );
}
