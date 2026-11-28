import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { BroadcastForm } from '@/components/admin/BroadcastForm';
import { StatusBadge } from '@/components/admin/BookingStatus';
import styles from '@/components/admin/admin.module.css';
import { requireStaff } from '@/lib/auth/session';
import { audienceCounts, listNotifications } from '@/lib/data/admin';
import { formatDayShort, hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Outbox' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

const channelLabel: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp', push: 'Push' };
const templateLabel = (t: string) => {
  const words = t.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

async function OutboxContent({ searchParams }: { searchParams: SP }) {
  await requireStaff();
  const sp = await searchParams;
  const channel = ['email', 'whatsapp', 'push'].includes(one(sp.channel)) ? one(sp.channel) : '';
  const status = ['sent', 'simulated', 'failed'].includes(one(sp.status)) ? one(sp.status) : '';
  const [rows, audience] = await Promise.all([listNotifications({ channel: channel || undefined, status: status || undefined }), audienceCounts()]);
  const anySimulated = rows.some((r) => r.status === 'simulated');
  const filterHref = (c: string, s: string) =>
    `/admin/outbox${c || s ? `?${[c && `channel=${c}`, s && `status=${s}`].filter(Boolean).join('&')}` : ''}` as Route;

  return (
    <>
      <section className={styles.tiles} aria-label="Audience">
        <div className={styles.tile}>
          <span className={styles.tileValue}>{audience.whatsapp}</span>
          <span className={styles.tileLabel}>WhatsApp opt-ins</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{audience.email}</span>
          <span className={styles.tileLabel}>Email opt-ins</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{audience.push}</span>
          <span className={styles.tileLabel}>Devices with status alerts</span>
        </div>
        <a className={`${styles.tile} ${styles.tileDark}`} href="/admin/outbox/export" download>
          <span className={styles.tileValue} style={{ fontSize: '1.2rem' }}>
            Export CSV
          </span>
          <span className={styles.tileLabel}>Opt-ins for your WhatsApp and email tools</span>
        </a>
      </section>

      <section className={styles.panel} aria-labelledby="bc-title">
        <h2 id="bc-title" className={styles.panelTitle}>
          Push alert
        </h2>
        <BroadcastForm devices={audience.push} />
      </section>

      <section className={styles.panel} aria-labelledby="log-title">
        <div className={styles.panelHead}>
          <h2 id="log-title" className={styles.panelTitle}>
            Everything sent
          </h2>
          <div className={styles.tabs}>
            {[
              ['', 'All'],
              ['email', 'Email'],
              ['whatsapp', 'WhatsApp'],
              ['push', 'Push'],
            ].map(([v, l]) => (
              <Link key={v} href={filterHref(v!, status)} className={styles.tab} aria-current={channel === v ? 'page' : undefined}>
                {l}
              </Link>
            ))}
            {[
              ['failed', 'Failed'],
              ['simulated', 'Simulated'],
            ].map(([v, l]) => (
              <Link key={v} href={filterHref(channel, status === v ? '' : v!)} className={styles.tab} aria-current={status === v ? 'page' : undefined}>
                {l}
              </Link>
            ))}
          </div>
        </div>
        {anySimulated && (
          <p className={`${styles.small} ${styles.muted}`}>
            “Simulated” means the channel has no live keys yet: the message was written and logged but not delivered. Add the Resend, WhatsApp Cloud API or
            VAPID keys to send for real.
          </p>
        )}
        {rows.length === 0 ? (
          <p className={styles.empty}>Nothing sent {channel || status ? 'with these filters' : 'yet'}.</p>
        ) : (
          <ul className={styles.rows} role="list">
            {rows.map((n) => (
              <li key={n.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{n.subject || templateLabel(n.template)}</span>
                  <StatusBadge status={n.status} />
                  <span className={styles.st}>{channelLabel[n.channel] ?? n.channel}</span>
                </div>
                <div className={styles.rowMeta}>
                  <span>
                    {formatDayShort(ymdInSast(n.createdAt))} {hmInSast(n.createdAt)}
                  </span>
                  <span style={{ overflowWrap: 'anywhere' }}>To {n.to}</span>
                  {n.bookingRef && (
                    <Link href={`/admin/bookings/${n.bookingRef}` as Route} className={styles.mono}>
                      {n.bookingRef}
                    </Link>
                  )}
                </div>
                <details className={styles.details}>
                  <summary className={styles.small}>Message</summary>
                  <p className={styles.small} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 6 }}>
                    {n.body}
                  </p>
                  {n.error && (
                    <p className={`${styles.small}`} style={{ color: '#8a2414', overflowWrap: 'anywhere' }}>
                      {n.error}
                    </p>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function OutboxPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Outbox</p>
          <h1 className={styles.pageTitle}>Messages sent</h1>
          <p className={styles.pageSub}>Confirmations, reminders, weather holds, Scream Clips, vouchers and staff alerts, newest first.</p>
        </div>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <OutboxContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
