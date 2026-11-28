import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { EventForm } from '@/components/admin/EventForm';
import { StatusBadge } from '@/components/admin/BookingStatus';
import styles from '@/components/admin/admin.module.css';
import { allImages } from '@/content/images';
import { requireStaff } from '@/lib/auth/session';
import { eventAdmin } from '@/lib/data/admin';
import { eventSpacesLeft } from '@/lib/data/bookings';
import { hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Edit event' };

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

const local = (d: Date) => `${ymdInSast(d)}T${hmInSast(d)}`;

async function Edit({ params, searchParams }: { params: Params; searchParams: SP }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [e, sp] = await Promise.all([eventAdmin(id), searchParams]);
  if (!e) notFound();
  const left = await eventSpacesLeft(e.id, e.capacity);
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">
            <Link href="/admin/events" className={styles.rowLink}>
              Events
            </Link>
          </p>
          <h1 className={styles.pageTitle}>{e.title}</h1>
          <p className={styles.pageSub}>
            {e.capacity - left} of {e.capacity} {e.price ? 'tickets sold' : 'RSVPs'} · {left} left
          </p>
        </div>
        <div className={styles.rowActions}>
          <StatusBadge status={e.status} />
          {e.status !== 'draft' && (
            <a href={`/events/${e.slug}`} target="_blank" rel="noopener" className="btn btn--light btn--sm">
              View on the website
            </a>
          )}
        </div>
      </header>
      {sp.saved === '1' && (
        <p role="status" className={`${styles.message} ${styles.messageOk}`}>
          Event created.
        </p>
      )}
      <section className={styles.panel}>
        <EventForm
          images={allImages.map((i) => ({ slug: i.slug, alt: i.alt }))}
          values={{
            id: e.id,
            title: e.title,
            slug: e.slug,
            tag: e.tag,
            summary: e.summary,
            body: e.body,
            startsAt: local(e.startsAt),
            endsAt: local(e.endsAt),
            image: e.image,
            price: e.price == null ? '' : String(e.price),
            capacity: String(e.capacity),
            status: e.status,
          }}
        />
      </section>
    </>
  );
}

export default function EditEventPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <Suspense fallback={<div className={styles.skeleton} />}>
      <Edit params={params} searchParams={searchParams} />
    </Suspense>
  );
}
