import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Calendar, Clock, Pin, Shield } from '@/components/ui/icons';
import { absoluteUrl, directions, site } from '@/content/site';
import { ticketFor } from '@/lib/data/bookings';
import { rand } from '@/lib/format';
import { formatDayLong } from '@/lib/time';
import { TicketActions } from './TicketActions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Your ticket', robots: { index: false, follow: false } };

async function Ticket({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string }> }) {
  await connection();
  const [{ ref }, { t }] = await Promise.all([params, searchParams]);
  const d = await ticketFor(ref, t ?? '');
  if (!d) notFound();
  const b = d.booking;
  const url = absoluteUrl(`/ticket/${b.ref}?t=${b.ticketToken}`);
  const qr = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#151412', light: '#00000000' } });
  const slots = d.items.filter((i) => i.slotTime && (i.kind === 'activity' || i.kind === 'event'));
  const addons = d.items.filter((i) => i.kind === 'addon');
  const paid = b.status === 'paid';
  const summary = (b.meta as { summary?: string }).summary ?? 'Your booking';

  return (
    <div className={styles.wrap}>
      <article className={styles.ticket} aria-label={`Ticket ${b.ref}`}>
        <header className={styles.head}>
          <p className="eyebrow">Soweto Towers · {b.kind === 'event' ? 'Event ticket' : 'Adventure ticket'}</p>
          <h1 className={`h2 ${styles.title}`}>{summary}</h1>
          <p className={styles.when}>
            <Calendar width={18} height={18} /> {b.visitDate ? formatDayLong(b.visitDate) : ''}
          </p>
        </header>

        <div className={styles.qrRow}>
          {paid ? (
            <div className={styles.qr} role="img" aria-label={`QR code for booking ${b.ref}`} dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className={styles.unpaid}>Not paid ({b.status.replace('_', ' ')})</div>
          )}
          <div className={styles.refBox}>
            <span className="tiny muted">Reference</span>
            <span className={`num ${styles.ref}`}>{b.ref}</span>
            <span className="tiny muted">{b.checkedInAt ? 'Checked in' : 'Show this at the gate'}</span>
          </div>
        </div>

        <div className={styles.perforation} aria-hidden />

        <ul role="list" className={styles.slots}>
          {slots.map((s) => (
            <li key={s.id}>
              <Clock width={18} height={18} />
              <span>
                <strong className="num">{s.slotTime}</strong> {s.label} × {s.qty}
              </span>
            </li>
          ))}
          {addons.map((a) => (
            <li key={a.id} className={styles.addon}>
              <span>
                + {a.label} × {a.qty}
              </span>
            </li>
          ))}
        </ul>

        {d.people.length > 0 && <p className={styles.people}>{d.people.map((p) => p.name).join(' · ')}</p>}

        <div className={styles.meta}>
          <span>Paid {rand(b.total - b.voucherApplied)}</span>
          {b.voucherApplied > 0 && <span>Voucher {rand(b.voucherApplied)}</span>}
          <span>{b.name}</span>
        </div>
      </article>

      <TicketActions refCode={b.ref} token={b.ticketToken} date={b.visitDate} summary={summary} />

      <section className={styles.info}>
        <div className="card">
          <Shield />
          <h2 className="h3">On the day</h2>
          <ul className={styles.list}>
            <li>Arrive 20 minutes before your slot.</li>
            <li>Closed shoes, clothes you can jump in, sunscreen.</li>
            <li>Entrance R{site.entranceFee} per person at the gate, card only.</li>
            <li>Under-18s: a parent or guardian signs consent at the gate.</li>
            <li>Rain or lightning? We pause; move your slot for free.</li>
          </ul>
        </div>
        <div className="card">
          <Pin />
          <h2 className="h3">Getting here</h2>
          <p>
            {site.address.street}, {site.address.suburb}, {site.address.city}
          </p>
          <div className="cluster">
            <a className="pill pill--outline" href={directions.google} target="_blank" rel="noopener">
              Google Maps
            </a>
            <a className="pill pill--outline" href={directions.apple} target="_blank" rel="noopener">
              Apple Maps
            </a>
            <a className="pill pill--outline" href={directions.uber} target="_blank" rel="noopener">
              Uber
            </a>
          </div>
          <Link href={'/visit#status' as Route} className="link-arrow">
            Live tower status
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function TicketPage(props: PageProps<'/ticket/[ref]'>) {
  return (
    <div className="container">
      <Suspense fallback={<div className={styles.wrap} aria-busy="true" />}>
        <Ticket params={props.params} searchParams={props.searchParams as Promise<{ t?: string }>} />
      </Suspense>
    </div>
  );
}
