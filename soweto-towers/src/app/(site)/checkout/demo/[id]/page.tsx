import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { bookingById } from '@/lib/data/bookings';
import { rand } from '@/lib/format';
import { activeProvider } from '@/lib/payments';
import { formatDayLong } from '@/lib/time';
import { DemoPay } from './DemoPay';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Test checkout', robots: { index: false, follow: false } };

async function Checkout({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || activeProvider() !== 'demo') notFound();
  const d = await bookingById(id);
  if (!d) notFound();
  const b = d.booking;
  const due = b.total - b.voucherApplied;
  const summary = (b.meta as { summary?: string }).summary ?? 'Your booking';
  return (
    <div className={`card ${styles.card}`}>
      <p className={styles.badge}>Test mode · no money moves</p>
      <p className="eyebrow">Secure checkout</p>
      <h1 className="h2">{rand(due)}</h1>
      <p className={styles.summary}>
        {summary}
        {b.visitDate ? ` · ${formatDayLong(b.visitDate)}` : ''}
      </p>
      <p className="muted small">
        Booking {b.ref} for {b.name}
      </p>
      {b.status === 'paid' ? (
        <p className={styles.paid}>Already paid.</p>
      ) : b.status === 'pending_payment' ? (
        <DemoPay id={b.id} amount={rand(due)} />
      ) : (
        <p className={styles.paid}>This booking is {b.status.replace('_', ' ')}. Please book again.</p>
      )}
      <p className={styles.note}>
        This preview uses a simulated payment page. On the live site this step is PayFast (cards, instant EFT and phone wallets), switched on by adding the
        merchant keys.
      </p>
    </div>
  );
}

export default function DemoCheckoutPage({ params }: PageProps<'/checkout/demo/[id]'>) {
  return (
    <div className={`container ${styles.page}`}>
      <Suspense fallback={<div className={`card ${styles.card}`} aria-busy="true" />}>
        <Checkout params={params} />
      </Suspense>
    </div>
  );
}
