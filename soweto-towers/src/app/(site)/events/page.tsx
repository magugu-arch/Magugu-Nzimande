import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { EventCard } from '@/components/site/EventCard';
import { JsonLd } from '@/components/site/JsonLd';
import { SectionHead } from '@/components/ui/SectionHead';
import { ArrowUpRight } from '@/components/ui/icons';
import { upcomingEvents } from '@/lib/data/events';
import { breadcrumbs, eventLd, graph } from '@/lib/jsonld';
import { pageMeta } from '@/lib/seo';
import styles from './page.module.css';

export const metadata: Metadata = pageMeta({
  title: 'Events at the Towers',
  description:
    'Launch weekends, Scream of the Week, family days, team days at 100m and Heritage Day at Soweto Towers (Orlando Towers). RSVP or buy tickets online.',
  path: '/events',
  image: '/og/events.jpg',
});

async function List() {
  const events = await upcomingEvents(24);
  if (events.length === 0) {
    return (
      <div className="card">
        <h2 className="h3">New dates are on the way.</h2>
        <p className="muted">Join the WhatsApp list in the footer and we’ll tell you first.</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid--3">
        {events.map((e, i) => (
          <div key={e.id} className="reveal" style={{ ['--delay' as string]: `${(i % 3) * 80}ms` }}>
            <EventCard event={e} priority={i === 0} />
          </div>
        ))}
      </div>
      <JsonLd
        data={graph(
          breadcrumbs([{ name: 'Events', path: '/events' }]),
          ...events.map((e) =>
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
          ),
        )}
      />
    </>
  );
}

export default function EventsPage() {
  return (
    <div className="container">
      <section className="section">
        <SectionHead
          eyebrow="What’s on"
          title="Events at the towers."
          as="h1"
          size="h1"
          intro="Launch weekends, Scream of the Week, family days and team days. Free events need an RSVP so we can plan the crew."
        />
        <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
          <List />
        </Suspense>
      </section>
      <section className={`card card--dark ${styles.private}`}>
        <p className="eyebrow">Private events</p>
        <h2 className="h2">Your event, 100m up.</h2>
        <p>Product launches, film shoots, birthdays and year-end functions. Tell us what you have in mind and we’ll put it together.</p>
        <div className="cluster">
          <Link href="/contact" className="btn btn--primary">
            Venue hire & shoots
          </Link>
          <Link href="/groups" className="link-arrow" style={{ color: 'var(--on-dark)' }}>
            Group days <ArrowUpRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
