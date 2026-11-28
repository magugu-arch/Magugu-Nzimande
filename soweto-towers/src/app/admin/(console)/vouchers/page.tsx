import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { voidVoucherAction } from '@/app/admin/actions';
import { StatusBadge } from '@/components/admin/BookingStatus';
import { PlainActionButton } from '@/components/admin/forms';
import { VoucherForm } from '@/components/admin/VoucherForm';
import styles from '@/components/admin/admin.module.css';
import { activities, packages } from '@/content/catalog';
import { requireStaff } from '@/lib/auth/session';
import { listVouchers } from '@/lib/data/admin';
import { rand } from '@/lib/format';
import { formatDayShort, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Vouchers' };

type SP = Promise<Record<string, string | string[] | undefined>>;

async function VoucherList({ searchParams }: { searchParams: SP }) {
  await requireStaff();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 60) : '';
  const rows = await listVouchers(q);
  const now = new Date();
  return (
    <section className={styles.panel} aria-labelledby="list-title">
      <div className={styles.panelHead}>
        <h2 id="list-title" className={styles.panelTitle}>
          {q ? `Matching “${q}”` : 'Latest vouchers'}
        </h2>
      </div>
      <form role="search" action="/admin/vouchers" className={styles.toolbar}>
        <div className="field">
          <label className="field-label" htmlFor="vq">
            Search
          </label>
          <input id="vq" name="q" className="input" defaultValue={q} placeholder="Code, recipient or buyer" />
        </div>
        <button className="btn btn--dark">Search</button>
        {q && (
          <Link href="/admin/vouchers" className="btn btn--light">
            Clear
          </Link>
        )}
      </form>
      {rows.length === 0 ? (
        <p className={styles.empty}>No vouchers {q ? 'match' : 'yet'}.</p>
      ) : (
        <ul className={styles.rows} role="list">
          {rows.map((v) => {
            const expired = v.expiresAt < now && v.status === 'active';
            return (
              <li key={v.code} className={`${styles.row} ${styles.rowSplit}`}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span className={styles.rowMain}>
                    <span className={`${styles.rowTitle} ${styles.mono}`}>{v.code}</span>
                    <StatusBadge status={expired ? 'expired' : v.status} />
                  </span>
                  <span className={styles.rowMeta}>
                    <span>{v.label}</span>
                    <span>
                      {rand(v.balance)} of {rand(v.value)} left
                    </span>
                    <span>For {v.recipientName}</span>
                    <span>From {v.purchaserName}</span>
                    <span>Expires {formatDayShort(ymdInSast(v.expiresAt))}</span>
                    {v.purchaseBookingId === null ? null : <span>Paid online</span>}
                  </span>
                </div>
                <span className={styles.rowActions}>
                  <a href={`/voucher/${v.code}?t=${v.token}`} target="_blank" rel="noopener" className={styles.linkBtn}>
                    Open
                  </a>
                  {v.status === 'active' && (
                    <PlainActionButton
                      action={voidVoucherAction}
                      fields={{ code: v.code }}
                      className={styles.linkBtn}
                      confirmText={`Void ${v.code}? It can no longer be used.`}
                    >
                      Void
                    </PlainActionButton>
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

export default function VouchersPage({ searchParams }: { searchParams: SP }) {
  const presets = [
    ...packages.map((p) => ({ label: `Complimentary ${p.name}`, value: p.price })),
    ...activities.filter((a) => a.booking.mode !== 'enquiry').map((a) => ({ label: `Complimentary ${a.name}`, value: a.price })),
  ];
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Vouchers</p>
          <h1 className={styles.pageTitle}>Gift a Jump</h1>
          <p className={styles.pageSub}>Paid vouchers arrive from the website. Issue complimentary ones here.</p>
        </div>
        <Link href={'/admin/vouchers#issue' as Route} className="btn btn--light">
          Issue a voucher
        </Link>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <VoucherList searchParams={searchParams} />
      </Suspense>
      <section className={styles.panel} id="issue" aria-labelledby="issue-title">
        <h2 id="issue-title" className={styles.panelTitle}>
          Issue a complimentary voucher
        </h2>
        <VoucherForm presets={presets} />
      </section>
    </>
  );
}
