import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { StatusBadge } from '@/components/admin/BookingStatus';
import styles from '@/components/admin/admin.module.css';
import { requireStaff } from '@/lib/auth/session';
import { listEventsAdmin } from '@/lib/data/admin';
import { rand } from '@/lib/format';
import { formatDayShort, hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Events' };

async function EventList() {
  await requireStaff();
  const rows = await listEventsAdmin();
  const now = new Date();
  return (
    <section className={styles.panel}>
      {rows.length === 0 ? (
        <p className={styles.empty}>No events yet.</p>
      ) : (
        <ul className={styles.rows} role="list">
          {rows.map((e) => {
            const past = e.endsAt < now;
            return (
              <li key={e.id} className={`${styles.row} ${styles.rowSplit}`} style={{ opacity: past ? 0.6 : 1 }}>
                <Link href={`/admin/events/${e.id}` as Route} className={styles.rowLink}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{e.title}</span>
                    <span className={styles.st}>{e.tag}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    <span>
                      {formatDayShort(ymdInSast(e.startsAt))} {hmInSast(e.startsAt)}
                      {ymdInSast(e.startsAt) !== ymdInSast(e.endsAt) ? ` – ${formatDayShort(ymdInSast(e.endsAt))}` : ''}
                    </span>
                    <span>{e.price ? `${rand(e.price)} per ticket` : 'Free RSVP'}</span>
                    <span>
                      {e.sold} of {e.capacity} {e.price ? 'sold' : 'RSVPs'}
                    </span>
                    {past && <span>Finished</span>}
                  </span>
                </Link>
                <span className={styles.rowActions}>
                  <StatusBadge status={e.status} />
                  {e.status !== 'draft' && (
                    <a href={`/events/${e.slug}`} target="_blank" rel="noopener" className={styles.linkBtn}>
                      View
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function EventsAdminPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Events</p>
          <h1 className={styles.pageTitle}>What’s on</h1>
          <p className={styles.pageSub}>Published events appear on the website, in Google event results and in the sitemap.</p>
        </div>
        <Link href="/admin/events/new" className="btn btn--primary">
          New event
        </Link>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <EventList />
      </Suspense>
    </>
  );
}
