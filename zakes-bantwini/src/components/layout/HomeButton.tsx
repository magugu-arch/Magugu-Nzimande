'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './HomeButton.module.css';

/**
 * Always one tap from the home page: a floating pill, bottom left, on every
 * page but home itself. It rises above the mini-player when that is open.
 */
export function HomeButton() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return (
    <Link href="/" className={styles.home} data-home-button="">
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.glyph}>
        <path d="M3.5 11 12 4l8.5 7" />
        <path d="M6 9.2V20h4.5v-5.5h3V20H18V9.2" />
      </svg>
      <span>Home</span>
    </Link>
  );
}
