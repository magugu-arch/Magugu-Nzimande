import type { Metadata } from 'next';
import { EventsBrowser } from '@/components/events/EventsBrowser';
import { PageHero } from '@/components/layout/PageHero';
import { Section } from '@/components/ui/Section';
import { getEventBuckets } from '@/lib/events-server';
import { IS_PREVIEW } from '@/lib/env';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Events',
  description:
    'Upcoming live teaching, workshops and conversations with Myron Golden, with dates and times shown in each event’s own time zone.',
  path: '/events',
});

export default async function EventsPage() {
  const { upcoming, past } = await getEventBuckets();
  return (
    <>
      <PageHero
        image="MG-29"
        eyebrow="Events"
        title="Learn in the room"
        intro={
          <p>
            Live teaching, workshops and conversations. Every date is confirmed with the team before
            it appears here, and times are shown where each event is held.
          </p>
        }
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Events', path: '/events' },
        ]}
      />
      {IS_PREVIEW ? (
        <div className="border-y border-gold/20 bg-[#1d1810]">
          <p className="container-site py-4 text-[0.9rem] text-gold-bright">
            <strong className="font-semibold">Preview:</strong> every event below is a demo fixture
            for testing the calendar. None of them is real, and none of them ships to production.
          </p>
        </div>
      ) : null}
      <Section labelledBy="events-heading" className="!pt-14">
        <div className="container-site">
          <h2 id="events-heading" className="sr-only">
            Event listings
          </h2>
          <EventsBrowser upcoming={upcoming} past={past} />
        </div>
      </Section>
    </>
  );
}
