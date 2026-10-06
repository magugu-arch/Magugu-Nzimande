import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/auth/admin';
import { getStore } from '@/lib/store';
import { logoutAction } from '../actions';
import { AdminNav } from './AdminNav';
import styles from '../admin.module.css';

export const metadata: Metadata = { title: 'Management', robots: { index: false, follow: false } };

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const store = getStore();
  const [fresh, inbox] = await Promise.all([store.count('bookings', { where: { status: 'NEW' } }), store.count('collaboration_requests', { where: { status: 'new' } })]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          <strong>Zakes Bantwini</strong>
          <span className="eyebrow eyebrow-accent">Management</span>
        </Link>
        <AdminNav counts={{ '/admin/bookings': fresh, '/admin/inbox': inbox }} />
        <div className={styles.who}>
          <span>
            {admin.name} · {admin.role}
          </span>
          <form action={logoutAction}>
            <button type="submit">Sign out</button>
          </form>
          <Link href="/" className={styles.small}>
            View site ↗
          </Link>
        </div>
      </aside>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
