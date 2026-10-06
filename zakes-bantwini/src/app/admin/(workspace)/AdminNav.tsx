'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '../admin.module.css';

const ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/events', label: 'Public events' },
  { href: '/admin/inbox', label: 'Inbox' },
  { href: '/admin/content', label: 'Content & media' },
  { href: '/admin/team', label: 'Team' },
];

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Management">
      {ITEMS.map((i) => {
        const current = i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={current ? 'page' : undefined}>
            {i.label}
            {counts[i.href] ? (
              <span className={styles.count} aria-label={`${counts[i.href]} new`}>
                {counts[i.href]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
