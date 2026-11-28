import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { JsonLd } from '@/components/site/JsonLd';
import { Calendar, Clock, Pin } from '@/components/ui/icons';
import { Photo } from '@/components/ui/Photo';
import type { ImageSlug } from '@/content/images';
import { seedEvents } from '@/content/events-seed';
import { site } from '@/content/site';
import { isDemoDatabase } from '@/lib/db';
import { eventSpacesLeft } from '@/lib/data/bookings';
import { allEventSlugs, eventBySlug } from '@/lib/data/events';
import { rand } from '@/lib/format';
import { breadcrumbs, eventLd, graph } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';
import { formatDayLong, hmInSast, ymdInSast } from '@/lib/time';
import { EventTicketForm } from './EventTicketForm';
import styles from '../page.module.css';

export async function generateStaticParams() {
  // The preview database (PGlite) belongs to one process, and `next dev` runs
  // this function in a separate worker, so previews prerender the seeded events.
  // With Postgres every published event is prerendered; later ones render on demand.
  const slugs = isDemoDatabase() ? seedEvents.map((e) => e.slug) : await allEventSlugs();
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: seedEvents[0]!.slug }];
}

export async function generateMetadata({ params }: PageProps<'/events/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const e = await eventBySlug(slug);
  if (!e) return { title: 'Event not found' };
  return pageMeta({ title: e.title, description: e.summary, path: `/events/${e.slug}`, image: '/og/events.jpg' });
}

async function Spaces({ id, capacity }: { id: string; capacity: number }) {
  await connection();
  const left = await eventSpacesLeft(id, capacity);
  return <p className={styles.spaces}>{left === 0 ? 'Sold out' : left < 30 ? `Only ${left} places left` : 'Places available'}</p>;
}

export default async function EventPage({ params }: PageProps<'/events/[slug]'>) {
  const { slug } = await params;
  const e = await eventBySlug(slug);
  if (!e) notFound();
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const sameDay = ymdInSast(start) === ymdInSast(end);
  return (
    <div className="container">
      <section className={styles.hero} aria-labelledby="event-title">
        <Photo slug={e.image as ImageSlug} sizes="(min-width: 1320px) 1280px, 100vw" eager />
        <div className={`glass-dark ${styles.heroPanel}`}>
          <p className="eyebrow">{e.tag}</p>
          <h1 id="event-title" className="h1">
            {e.title}
          </h1>
          <div className={styles.meta}>
            <span className="pill">
              <Calendar width={16} height={16} />{' '}
              {sameDay ? formatDayLong(ymdInSast(start)) : `${formatDayLong(ymdInSast(start))} – ${formatDayLong(ymdInSast(end))}`}
            </span>
            <span className="pill">
              <Clock width={16} height={16} /> {hmInSast(start)}–{hmInSast(end)}
            </span>
            <span className="pill pill--orange">{e.price ? `${rand(e.price)} per ticket` : 'Free · RSVP'}</span>
          </div>
        </div>
      </section>

      <div className={styles.body}>
        <div className={styles.text}>
          <p className="lede">{e.summary}</p>
          {e.body.split('\n\n').map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          <p className="muted">
            <Pin width={16} height={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> {site.address.street}, {site.address.suburb},{' '}
            {site.address.city}. Adventures are booked separately on <Link href="/book">Book your jump</Link>.
          </p>
          {e.status === 'cancelled' && <p className="field-error">This event has been cancelled.</p>}
        </div>
        <aside className={`card ${styles.ticketCard}`} aria-label="Tickets">
          <p className="eyebrow">{e.price ? 'Tickets' : 'RSVP'}</p>
          <p className="h3">{e.price ? `${rand(e.price)} per person` : 'Free entry'}</p>
          <Suspense fallback={<p className={styles.spaces}>Checking places…</p>}>
            <Spaces id={e.id} capacity={e.capacity} />
          </Suspense>
          {e.status === 'published' && <EventTicketForm slug={e.slug} price={e.price} />}
        </aside>
      </div>

      <JsonLd
        data={graph(
          breadcrumbs([
            { name: 'Events', path: '/events' },
            { name: e.title, path: `/events/${e.slug}` },
          ]),
          eventLd({
            slug: e.slug,
            title: e.title,
            summary: e.summary,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            image: `/images/${e.image}.jpg`,
            price: e.price,
            soldOut: false,
            cancelled: e.status === 'cancelled',
          }),
        )}
      />
    </div>
  );
}
