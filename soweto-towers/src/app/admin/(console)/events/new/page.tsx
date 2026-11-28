import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { EventForm } from '@/components/admin/EventForm';
import styles from '@/components/admin/admin.module.css';
import { allImages } from '@/content/images';
import { requireStaff } from '@/lib/auth/session';
import { addDays, ymdInSast } from '@/lib/time';

export const metadata = { title: 'New event' };

async function NewEvent() {
  await connection();
  await requireStaff();
  const day = addDays(ymdInSast(new Date()), 14);
  return (
    <EventForm
      images={allImages.map((i) => ({ slug: i.slug, alt: i.alt }))}
      values={{
        title: '',
        slug: '',
        tag: '',
        summary: '',
        body: '',
        startsAt: `${day}T10:00`,
        endsAt: `${day}T17:00`,
        image: 'towers-mural-hero',
        price: '',
        capacity: '200',
        status: 'draft',
      }}
    />
  );
}

export default function NewEventPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">
            <Link href="/admin/events" className={styles.rowLink}>
              Events
            </Link>
          </p>
          <h1 className={styles.pageTitle}>New event</h1>
          <p className={styles.pageSub}>Save as a draft first if you want to check it before it goes live.</p>
        </div>
      </header>
      <section className={styles.panel}>
        <Suspense fallback={<div className={styles.skeleton} />}>
          <NewEvent />
        </Suspense>
      </section>
    </>
  );
}
