import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import QRCode from 'qrcode';
import { Suspense } from 'react';
import { Mark } from '@/components/brand/Logo';
import { absoluteUrl } from '@/content/site';
import { getVoucherForPage } from '@/lib/data/bookings';
import { rand } from '@/lib/format';
import { formatDate, ymdInSast } from '@/lib/time';
import { PrintButton } from './PrintButton';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Gift a Jump voucher', robots: { index: false, follow: false } };

async function Voucher({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  await connection();
  const [{ code }, { t }] = await Promise.all([params, searchParams]);
  const v = await getVoucherForPage(code, t ?? '');
  if (!v) notFound();
  const bookUrl = absoluteUrl(`/book?voucher=${v.code}`);
  const qr = await QRCode.toString(bookUrl, { type: 'svg', margin: 0, color: { dark: '#F3EFE7', light: '#00000000' } });
  const expires = formatDate(ymdInSast(v.expiresAt));
  const usable = v.status === 'active' && v.balance > 0 && v.expiresAt > new Date();
  return (
    <div className={styles.wrap}>
      <article className={styles.voucher} aria-label={`Gift a Jump voucher ${v.code}`}>
        <div className={styles.top}>
          <Mark tone="paper" size={52} />
          <div>
            <p className={styles.brand}>Soweto Towers</p>
            <p className={styles.kicker}>Gift a Jump</p>
          </div>
        </div>
        <p className={styles.for}>For {v.recipientName}</p>
        <h1 className={styles.label}>{v.label}</h1>
        {v.message && <p className={styles.msg}>“{v.message}”</p>}
        <p className={styles.from}>From {v.purchaserName.split(' ')[0]}</p>
        <div className={styles.bottom}>
          <div>
            <p className={styles.codeLabel}>Your code</p>
            <p className={styles.code}>{v.code}</p>
            <p className={styles.small}>
              {usable ? `${rand(v.balance)} to spend · valid until ${expires}` : v.status === 'redeemed' ? 'Fully used' : `Not valid (${v.status})`}
            </p>
          </div>
          <div className={styles.qr} role="img" aria-label="QR code to book with this voucher" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </article>
      <div className={styles.actions}>
        {usable && (
          <Link href={`/book?voucher=${v.code}` as Route} className="btn btn--primary btn--lg">
            Book with this voucher
          </Link>
        )}
        <PrintButton />
      </div>
      <p className={styles.howto}>
        Book a timed slot at sowetotowers.co.za/book and enter the code at the details step. Any value left over stays on the code. Valid for 365 days from
        purchase; not exchangeable for cash.
      </p>
    </div>
  );
}

export default function VoucherPage(props: PageProps<'/voucher/[code]'>) {
  return (
    <div className="container">
      <Suspense fallback={<div className={styles.wrap} aria-busy="true" />}>
        <Voucher params={props.params} searchParams={props.searchParams as Promise<{ t?: string }>} />
      </Suspense>
    </div>
  );
}
