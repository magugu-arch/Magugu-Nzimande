import { connection } from 'next/server';
import { EventList } from '@/components/live/EventList';
import { PageHero } from '@/components/layout/PageHero';
import { ArtImage } from '@/components/media/ArtImage';
import { JsonLd } from '@/components/seo/JsonLd';
import { ButtonLink } from '@/components/ui/Button';
import { SectionHead } from '@/components/ui/SectionHead';
import { upcomingPublicEvents } from '@/lib/booking/public-events';
import { eventJsonLd, pageMetadata } from '@/lib/seo';
import styles from '../pages.module.css';

export const metadata = pageMetadata({
  title: 'Live',
  description: 'Upcoming Zakes Bantwini shows with ticket links — and private, corporate and festival bookings.',
  path: '/live',
  image: 'IMG_6865',
});

export default async function LivePage() {
  await connection();
  const live = await upcomingPublicEvents();

  return (
    <>
      {live.events.length > 0 && <JsonLd data={live.events.map(eventJsonLd)} />}
      <PageHero eyebrow="Live" title={['On', 'stage']} intro="Public shows as they are announced, and a direct line for private and corporate bookings." media="IMG_6865" overlay="bottom" />

      <section className="section" aria-labelledby="public-title">
        <div className="container">
          <SectionHead index="01" eyebrow="Public events" id="public-title" title="Upcoming dates" intro="Verified dates and official ticket links only." />
          <EventList result={live} />
        </div>
      </section>

      <section className={`section ${styles.band}`} aria-labelledby="private-title">
        <div className={`container ${styles.split}`}>
          <ArtImage id="IMG_6862" sizes="(max-width: 960px) 100vw, 45vw" ratio={{ desktop: '4/3', mobile: '4/5' }} />
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">02 &nbsp;Private and corporate</p>
            <h2 id="private-title" className="statement" data-reveal>
              Your event, <em>your stage</em>.
            </h2>
            <p className="body-copy">Year-end functions, launches, weddings, brand activations and festival stages. Check a date and send your brief — a formal quote follows management review.</p>
            <ButtonLink href="/book" cursor="Book">
              Book Zakes
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="craft-title">
        <div className={`container ${styles.split} ${styles.splitReverse}`}>
          <ArtImage id="IMG_6866" sizes="(max-width: 960px) 100vw, 50vw" ratio={{ desktop: '16/9', mobile: '4/5' }} />
          <div className={styles.copy}>
            <p className="eyebrow eyebrow-accent">03 &nbsp;The show</p>
            <h2 id="craft-title" className="statement" data-reveal>
              Built in rehearsal, <em>delivered in the room</em>.
            </h2>
            <p className="body-copy">From an intimate set for a seated audience to a festival field — the format is shaped for the room in front of it.</p>
            <ButtonLink href="/journal/the-room-before-the-stage" variant="text" arrow>
              The room before the stage
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className={styles.wide} aria-hidden="true">
        <ArtImage id="IMG_6856" fill sizes="100vw" decorative />
      </div>
    </>
  );
}
