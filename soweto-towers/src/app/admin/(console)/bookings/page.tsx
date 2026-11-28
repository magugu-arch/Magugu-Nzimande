import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { StatusBadge } from '@/components/admin/BookingStatus';
import styles from '@/components/admin/admin.module.css';
import { requireStaff } from '@/lib/auth/session';
import { listBookings } from '@/lib/data/bookings';
import { rand } from '@/lib/format';
import { formatDayShort, hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Bookings' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

const statuses = [
  ['', 'Any status'],
  ['paid', 'Paid'],
  ['pending_payment', 'Awaiting payment'],
  ['cancelled', 'Cancelled'],
  ['expired', 'Expired'],
] as const;

async function Results({ searchParams }: { searchParams: SP }) {
  await requireStaff();
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 80);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : '';
  const status = statuses.some(([v]) => v === one(sp.status)) ? one(sp.status) : '';
  const rows = await listBookings({ q: q || undefined, date: date || undefined, status: status || undefined, limit: 150 });
  const today = ymdInSast(new Date());

  return (
    <>
      <form className={`${styles.panel}`} role="search" action="/admin/bookings">
        <div className={styles.toolbar}>
          <div className="field">
            <label className="field-label" htmlFor="q">
              Search
            </label>
            <input id="q" name="q" className="input" defaultValue={q} placeholder="Reference, name, email or phone" />
          </div>
          <div className="field" style={{ flex: '0 1 180px' }}>
            <label className="field-label" htmlFor="date">
              Visit date
            </label>
            <input id="date" name="date" type="date" className="input" defaultValue={date} />
          </div>
          <div className="field" style={{ flex: '0 1 200px' }}>
            <label className="field-label" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" className="input" defaultValue={status}>
              {statuses.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn--dark">Search</button>
          <Link href={`/admin/bookings?date=${today}` as Route} className="btn btn--light">
            Today
          </Link>
        </div>
      </form>

      <section className={styles.panel} aria-label="Results">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>{rows.length === 150 ? 'Latest 150' : `${rows.length} ${rows.length === 1 ? 'booking' : 'bookings'}`}</h2>
          {(q || date || status) && (
            <Link href="/admin/bookings" className={styles.linkBtn}>
              Clear filters
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <p className={styles.empty}>No bookings match.</p>
        ) : (
          <ul className={styles.rows} role="list">
            {rows.map((b) => {
              const activityItems = b.items.filter((i) => i.kind === 'activity' || i.kind === 'event' || i.kind === 'voucher');
              const time = b.items
                .filter((i) => i.slotTime)
                .map((i) => i.slotTime!)
                .sort()[0];
              return (
                <li key={b.id} className={`${styles.row} ${styles.rowSplit}`}>
                  <Link href={`/admin/bookings/${b.ref}` as Route} className={styles.rowLink}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{b.name}</span>
                      <span className={`${styles.mono} ${styles.muted}`}>{b.ref}</span>
                    </span>
                    <span className={styles.rowMeta}>
                      <span>
                        {b.visitDate ? formatDayShort(b.visitDate) : b.kind === 'voucher' ? 'Voucher' : '—'}
                        {time ? ` · ${time}` : ''}
                      </span>
                      <span>{activityItems.map((i) => `${i.qty} × ${i.label}`).join(', ')}</span>
                      <span>{rand(b.total)}</span>
                      {b.source && <span>via {b.source}</span>}
                    </span>
                  </Link>
                  <span className={styles.rowActions}>
                    {b.checkedInAt && <span className={`${styles.st} ${styles.stDark}`}>In {hmInSast(b.checkedInAt)}</span>}
                    <StatusBadge status={b.status} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default function BookingsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Bookings</p>
          <h1 className={styles.pageTitle}>Find a booking</h1>
        </div>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}
