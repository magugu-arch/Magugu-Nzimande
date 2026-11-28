'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Close, Menu, Phone, WhatsAppGlyph } from '@/components/ui/icons';
import { primaryNav, secondaryNav } from '@/content/nav';
import { site, whatsappLink } from '@/content/site';
import styles from './SiteHeader.module.css';

/** Reads the URL, so the layout renders it inside <Suspense> with SiteHeaderView as the fallback. */
export function SiteHeader() {
  return <SiteHeaderView pathname={usePathname()} />;
}

export function SiteHeaderView({ pathname }: { pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  // A new page closes the menu (React's "adjust state when a prop changes" pattern).
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isActive = (href: string) => !!pathname && (pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)));

  // Critically damped: the sheet arrives without overshoot and can be reversed mid-flight.
  const spring = reduce ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.42 };

  return (
    <header className={`${styles.header} ${scrolled || open ? styles.scrolled : ''}`}>
      <div className={`container ${styles.bar}`}>
        <Link href="/" className={styles.brand} aria-label="Soweto Towers, home">
          <Logo />
        </Link>

        <nav aria-label="Main" className={styles.nav}>
          <ul role="list">
            {primaryNav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={styles.navLink} aria-current={isActive(l.href) ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <Link href="/book" className={`btn btn--primary btn--sm ${styles.book}`}>
            <span className={styles.bookLong}>Book your jump</span>
            <span className={styles.bookShort} aria-hidden>
              Book
            </span>
          </Link>
          <button
            ref={menuButton}
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <Close /> : <Menu />}
            <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            className={styles.sheet}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
          >
            <nav aria-label="Menu" className={`container ${styles.sheetInner}`}>
              <ul role="list" className={styles.sheetPrimary}>
                {primaryNav.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: reduce ? 0 : 0.03 * i }}
                  >
                    <Link href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>
                      {l.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <ul role="list" className={styles.sheetSecondary}>
                {secondaryNav.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
              <div className={styles.sheetActions}>
                <Link href="/book" className="btn btn--primary btn--lg btn--block">
                  Book your jump
                </Link>
                <div className={styles.sheetContact}>
                  <a href={whatsappLink('Hi Soweto Towers! ')} className="btn btn--light" target="_blank" rel="noopener">
                    <WhatsAppGlyph size={18} /> WhatsApp
                  </a>
                  <a href={`tel:${site.phone.e164}`} className="btn btn--light">
                    <Phone width={18} height={18} /> Call
                  </a>
                </div>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
