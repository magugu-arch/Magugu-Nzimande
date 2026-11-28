import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingFlow } from '@/components/book/BookingFlow';
import { getLiveCatalog } from '@/lib/data/settings';
import { pageMeta } from '@/lib/seo';
import styles from './page.module.css';

export const metadata: Metadata = pageMeta({
  title: 'Book Your Jump: Timed Slots',
  description:
    'Book a timed slot for the 100m bungee, SCAD freefall, zipline, paintball or lift ride at Soweto Towers (Orlando Towers). Prices up front, group rates from 6, tickets on WhatsApp.',
  path: '/book',
  image: '/og/book.jpg',
});

async function Flow() {
  const catalog = await getLiveCatalog();
  return <BookingFlow catalog={catalog} />;
}

export default function BookPage() {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="eyebrow">Book your jump</p>
        <h1 className="h1">Soweto, from the top.</h1>
        <p className="lede">Six quick steps. Your slot is held while you pay, and your ticket lands on WhatsApp.</p>
      </header>
      <Suspense fallback={<div className={styles.skeleton} role="status" aria-busy="true" aria-label="Loading booking" />}>
        <Flow />
      </Suspense>
    </div>
  );
}
