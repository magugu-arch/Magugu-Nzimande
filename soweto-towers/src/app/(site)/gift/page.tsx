import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Photo } from '@/components/ui/Photo';
import { getLiveCatalog } from '@/lib/data/settings';
import { pageMeta } from '@/lib/seo';
import { GiftForm } from './GiftForm';
import styles from './page.module.css';

export const metadata: Metadata = pageMeta({
  title: 'Gift a Jump: Vouchers',
  description:
    'Give a 100m bungee, Jump + Film, The Full Tower or any amount at Soweto Towers (Orlando Towers). Sent by WhatsApp or email on the day you choose, valid for a year.',
  path: '/gift',
  image: '/og/gift.jpg',
});

async function Form() {
  const catalog = await getLiveCatalog();
  return <GiftForm catalog={catalog.filter((a) => !a.disabled && a.booking.mode !== 'enquiry').map((a) => ({ id: a.id, name: a.name, price: a.price }))} />;
}

export default function GiftPage() {
  return (
    <>
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroMedia}>
          <Photo slug="gift-a-jump" sizes="(min-width: 960px) 50vw, 100vw" eager />
        </div>
        <div className={styles.heroText}>
          <p className="eyebrow">Gift a Jump</p>
          <h1 className="h1">Give someone a story.</h1>
          <p className="lede">
            A voucher for a jump, a package or any amount. We send it by WhatsApp or email on the day you choose, or you print it yourself. Valid for 365 days.
          </p>
          <ul className={styles.points}>
            <li>Arrives instantly, or on the birthday</li>
            <li>They pick their own timed slot</li>
            <li>Works for any adventure; leftover value stays on the code</li>
          </ul>
        </div>
      </section>
      <section className="container section--tight">
        <Suspense fallback={<div className={styles.formSkeleton} aria-busy="true" />}>
          <Form />
        </Suspense>
      </section>
    </>
  );
}
