import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { PageHero } from '@/components/layout/PageHero';
import { JsonLd } from '@/components/seo/JsonLd';
import { ButtonLink } from '@/components/ui/Button';
import { formatDayLong } from '@/lib/booking/dates';
import { publicEvent } from '@/lib/booking/public-events';
import { eventJsonLd, pageMetadata } from '@/lib/seo';
import styles from '../../pages.module.css';

export async function generateMetadata(props: PageProps<'/live/[event]'>) {
  const { event: id } = await props.params;
  const event = await publicEvent(id);
  if (!event) return {};
  return pageMetadata({ title: event.title, description: `${formatDayLong(event.date)} — ${event.venue}, ${event.city}.`, path: `/live/${event.id}`, image: 'IMG_6851' });
}

export default async function EventPage(props: PageProps<'/live/[event]'>) {
  await connection();
  const { event: id } = await props.params;
  const event = await publicEvent(id);
  if (!event) notFound();

  return (
    <>
      <JsonLd data={eventJsonLd(event)} />
      <PageHero
        eyebrow={formatDayLong(event.date)}
        title={[event.title]}
        intro={`${event.venue}, ${event.city}, ${event.country}`}
        media="IMG_6851"
        size="medium"
        actions={
          <>
            {event.ticketUrl && (
              <ButtonLink href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
                Get tickets
              </ButtonLink>
            )}
            <ButtonLink href="/live" variant="outline">
              All dates
            </ButtonLink>
          </>
        }
      />
      <section className="section">
        <div className="container">
          <dl className={styles.facts}>
            <div>
              <dt>Date</dt>
              <dd>{formatDayLong(event.date)}</dd>
            </div>
            <div>
              <dt>Doors / start</dt>
              <dd>{event.startTime ?? 'To be announced'}</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>{event.venue}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>
                {event.city}, {event.country}
              </dd>
            </div>
          </dl>
          {event.description && <p className="lede" style={{ marginTop: 40 }}>{event.description}</p>}
          {!event.ticketUrl && <p className="muted" style={{ marginTop: 24 }}>Ticket details will be published here when on sale.</p>}
        </div>
      </section>
    </>
  );
}
