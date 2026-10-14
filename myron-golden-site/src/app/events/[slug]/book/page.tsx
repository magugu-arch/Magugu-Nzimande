import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookingForm, type BookingOffer } from '@/components/booking/BookingForm';
import { PageHero } from '@/components/layout/PageHero';
import { Photo } from '@/components/media/Photo';
import { ButtonLink } from '@/components/ui/Button';
import { Pill, Section } from '@/components/ui/Section';
import type { SiteEvent } from '@/content/types';
import { availabilityMessages, bookingAvailability } from '@/lib/booking';
import { getBookableEvents, getEvent, staticParams } from '@/lib/content';
import { IS_PREVIEW } from '@/lib/env';
import { formatEventDate, formatEventTime } from '@/lib/events';
import { getBookingClock } from '@/lib/events-server';
import { paymentsState } from '@/lib/payments';
import { pageMetadata } from '@/lib/seo';

/** Same reasoning as the event page: whole page in the static HTML, prefetched from the event. */
export const instant = false;

export function generateStaticParams() {
  return staticParams(getBookableEvents().map((e) => e.slug));
}

export async function generateMetadata({
  params,
}: PageProps<'/events/[slug]/book'>): Promise<Metadata> {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event?.booking) return { title: 'Event not found' };
  return pageMetadata({
    title: `Book ${event.title}`,
    description: `Book seats for ${event.title}.`,
    path: `/events/${event.slug}/book`,
    // Checkout steps are never search results.
    noindex: true,
  });
}

function toOffer(event: SiteEvent & { booking: NonNullable<SiteEvent['booking']> }): BookingOffer {
  return {
    eventSlug: event.slug,
    title: event.title,
    dateLabel: formatEventDate(event),
    timeLabel: formatEventTime(event),
    zoneLabel: event.timezone.replaceAll('_', ' '),
    location: event.location,
    online: event.format === 'online',
    ticketName: event.booking.ticketName,
    priceCents: event.booking.priceCents,
    maxPerOrder: event.booking.maxPerOrder,
    isDemo: !!event.isDemo,
    refundPolicyUrl: event.refundPolicyUrl,
  };
}

/** Open or not is decided against the hourly-cached clock, like the event page's registration panel. */
async function Booking({ event }: { event: SiteEvent }) {
  const now = await getBookingClock();
  const availability = bookingAvailability(event, now);
  if (availability !== 'open' || !event.booking) {
    return (
      <div className="max-w-xl rounded-2xl bg-ink/60 p-7 ring-1 ring-ivory/10">
        <Pill tone="muted">Not taking bookings</Pill>
        <p className="mt-4 text-ivory/80">
          {availability === 'open' || availability === 'none'
            ? 'This event does not take bookings on this site.'
            : availabilityMessages[availability]}
        </p>
        <ButtonLink href="/events" variant="secondary" className="mt-6" arrow>
          See upcoming events
        </ButtonLink>
      </div>
    );
  }

  return (
    <BookingForm
      offer={toOffer({ ...event, booking: event.booking })}
      paymentsReady={paymentsState().ready}
      preview={IS_PREVIEW}
      photo={<Photo id={event.image} fill alt="" sizes="(min-width: 1024px) 26rem, 100vw" />}
    />
  );
}

export default async function BookEventPage({ params }: PageProps<'/events/[slug]/book'>) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event?.booking) notFound();

  return (
    <>
      <PageHero
        variant="plain"
        eyebrow="Book seats"
        title={event.title}
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Events', path: '/events' },
          { name: event.title, path: `/events/${event.slug}` },
          { name: 'Book', path: `/events/${event.slug}/book` },
        ]}
        meta={
          event.isDemo ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="demo">Demo — not a real event</Pill>
            </div>
          ) : undefined
        }
      />
      <Section tone="charcoal" className="!pt-12" labelledBy="booking-title">
        <div className="container-site">
          <h2 id="booking-title" className="sr-only">
            Booking form
          </h2>
          <Suspense fallback={<div className="h-[36rem] animate-pulse rounded-2xl bg-ink/60" />}>
            <Booking event={event} />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
