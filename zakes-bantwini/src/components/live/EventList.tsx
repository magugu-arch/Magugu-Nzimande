import Link from 'next/link';
import type { CSSProperties } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import type { PublicEventsResult } from '@/lib/booking/public-events';
import styles from './EventList.module.css';

const DAY = new Intl.DateTimeFormat('en-ZA', { day: '2-digit', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('en-ZA', { month: 'short', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', year: 'numeric', timeZone: 'UTC' });

/** Public dates with a vertical reveal (brief §10: "Live: vertical date reveal"). */
export function EventList({ result, compact = false }: { result: PublicEventsResult; compact?: boolean }) {
  if (result.unavailable) {
    return (
      <EmptyState eyebrow="Live dates" title="Dates could not be loaded just now." actions={<ButtonLink href="/live" variant="outline" small>Try again</ButtonLink>}>
        <p>This is a problem on our side, not a sign that there are no shows. Please check back shortly.</p>
      </EmptyState>
    );
  }
  if (result.events.length === 0) {
    return (
      <EmptyState
        eyebrow="Live dates"
        title="No public dates are announced right now."
        actions={
          <>
            <ButtonLink href="/community" variant="outline" small>
              Get first word on new dates
            </ButtonLink>
            <ButtonLink href="/book" variant="text" arrow cursor="Book">
              Book a private or corporate show
            </ButtonLink>
          </>
        }
      >
        <p>New shows are announced here and to the community first. Planning an event of your own? Booking is open.</p>
      </EmptyState>
    );
  }
  return (
    <ol role="list" className={`${styles.list} ${compact ? styles.compact : ''}`}>
      {result.events.map((e, i) => {
        const d = new Date(`${e.date}T00:00:00Z`);
        return (
          <li key={e.id} className={styles.row} data-reveal style={{ '--reveal-delay': i * 80 } as CSSProperties}>
            <time dateTime={e.date} className={styles.date}>
              <span className={styles.day}>{DAY.format(d)}</span>
              <span className={styles.month}>{MONTH.format(d)}</span>
            </time>
            <div className={styles.what}>
              <Link href={`/live/${e.id}`} className={styles.title}>
                {e.title}
              </Link>
              <p className={styles.where}>
                {e.venue}, {e.city} · {WEEKDAY.format(d)}
                {e.startTime ? ` · ${e.startTime}` : ''}
              </p>
            </div>
            <div className={styles.cta}>
              {e.ticketUrl ? (
                <a href={e.ticketUrl} target="_blank" rel="noopener noreferrer" className={styles.tickets}>
                  Tickets<span className="visually-hidden"> for {e.title} (opens a new tab)</span>
                </a>
              ) : (
                <Link href={`/live/${e.id}`} className={styles.details}>
                  Details
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
