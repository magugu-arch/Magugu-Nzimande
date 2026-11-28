import Link from 'next/link';
import type { Route } from 'next';
import { Photo } from '@/components/ui/Photo';
import type { ImageSlug } from '@/content/images';
import type { PublicEvent } from '@/lib/data/events';
import { rand } from '@/lib/format';
import { formatDayShort, ymdInSast } from '@/lib/time';
import styles from './EventCard.module.css';

export function EventCard({ event, priority }: { event: PublicEvent; priority?: boolean }) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const startDay = ymdInSast(start);
  const endDay = ymdInSast(end);
  const day = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', timeZone: 'Africa/Johannesburg' }).format(start);
  const month = new Intl.DateTimeFormat('en-ZA', { month: 'short', timeZone: 'Africa/Johannesburg' }).format(start);
  return (
    <Link href={`/events/${event.slug}` as Route} className={styles.card}>
      <div className={styles.media}>
        <Photo slug={event.image as ImageSlug} sizes="(min-width: 1040px) 400px, 90vw" eager={priority} />
        <span className={styles.date} aria-hidden>
          <span>{day}</span>
          <span>{month}</span>
        </span>
      </div>
      <div className={styles.body}>
        <p className="eyebrow">{event.tag}</p>
        <h3 className="h3">{event.title}</h3>
        <p className={styles.when}>
          {startDay === endDay ? formatDayShort(startDay) : `${formatDayShort(startDay)} – ${formatDayShort(endDay)}`}
          {' · '}
          {event.price ? `${rand(event.price)} per ticket` : 'Free with RSVP'}
        </p>
        <p className={styles.summary}>{event.summary}</p>
      </div>
    </Link>
  );
}
