'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { rand } from '@/lib/format';
import { lowestJumpPrice } from '@/content/catalog';
import styles from './BookBar.module.css';

const HIDDEN_ON = ['/book', '/checkout', '/ticket', '/booking', '/gift', '/voucher', '/admin', '/events/'];

/** Mobile: the one button, always within thumb reach once the hero has scrolled away. */
export function BookBar() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const hidden = HIDDEN_ON.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    const onScroll = () => setShow(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hidden]);

  if (hidden) return null;

  return (
    <div className={`${styles.bar} ${show ? styles.show : ''}`} aria-hidden={!show}>
      <div className={`glass-light ${styles.inner}`}>
        <div className={styles.copy}>
          <span className={styles.from}>From {rand(lowestJumpPrice)}</span>
          <span className={styles.what}>100m bungee · timed slots</span>
        </div>
        <Link href="/book" className="btn btn--primary" tabIndex={show ? 0 : -1}>
          Book your jump
        </Link>
      </div>
    </div>
  );
}
