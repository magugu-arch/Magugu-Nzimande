'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import styles from './admin.module.css';

const items: { href: Route; label: string; admin?: boolean; inbox?: boolean }[] = [
  { href: '/admin', label: 'Today' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/scan', label: 'Scan' },
  { href: '/admin/inbox', label: 'Inbox', inbox: true },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/vouchers', label: 'Vouchers' },
  { href: '/admin/settings', label: 'Settings', admin: true },
  { href: '/admin/outbox', label: 'Outbox' },
  { href: '/admin/reports', label: 'Reports' },
  // Everyone: crew see their own password and two-step sign-in here.
  { href: '/admin/team', label: 'Team' },
];

/** Reads the URL for the active item, so it must render inside a Suspense boundary. */
export function ConsoleNav({ isAdmin, inboxCount }: { isAdmin: boolean; inboxCount: number }) {
  const pathname = usePathname();
  return <ConsoleNavView isAdmin={isAdmin} inboxCount={inboxCount} pathname={pathname} />;
}

/** Pure view: the loading shell renders it with no active item. */
export function ConsoleNavView({ isAdmin, inboxCount, pathname }: { isAdmin: boolean; inboxCount: number; pathname: string | null }) {
  const active = (href: string) => pathname !== null && (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Console" className={styles.nav}>
      <ul className={`${styles.navInner} ${styles.navList}`} role="list">
        {items
          .filter((i) => !i.admin || isAdmin)
          .map((i) => (
            <li key={i.href}>
              <Link href={i.href} className={styles.navLink} aria-current={active(i.href) ? 'page' : undefined}>
                {i.label}
                {i.inbox && inboxCount > 0 && (
                  <span className={styles.count} aria-label={`${inboxCount} waiting`}>
                    {inboxCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
