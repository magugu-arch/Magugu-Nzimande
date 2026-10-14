import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHero } from '@/components/layout/PageHero';
import { OutboundLink } from '@/components/ui/OutboundLink';
import { Pill, Section } from '@/components/ui/Section';
import { CalendarIcon, ClockIcon, GlobeIcon, PinIcon } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/Button';
import type { SiteEvent } from '@/content/types';
import { availabilityMessages, bookingAvailability, formatUsd } from '@/lib/booking';
import { getEvent, getEvents, staticParams } from '@/lib/content';
import { eventFormatLabels, eventTypeLabels, formatEventDate, formatEventTime } from '@/lib/events';
import { getBookingClock, getEventBuckets } from '@/lib/events-server';
import { pageMetadata } from '@/lib/seo';

/**
 * Detail pages render their content straight into the static HTML, so every
 * reader and crawler gets the whole page without JavaScript (brief §10).
 * Reading the slug outside <Suspense> means a navigation *could* wait on the
 * server, so the segment opts out of instant validation; the cards that link
 * here prefetch the full page, which keeps navigations instant in practice.
 */
export const instant = false;

export function generateStaticParams() {
  return staticParams(getEvents().map((e) => e.slug));
}

export async function generateMetadata({ params }: PageProps<'/events/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) return { title: 'Event not found' };
  return pageMetadata({
    title: event.title,
    description: event.description,
    path: `/events/${event.slug}`,
    noindex: !!event.isDemo,
  });
}

/** Registration only for events that have not ended — decided against the hourly-cached clock. */
async function Registration({ event }: { event: SiteEvent }) {
  const { upcoming } = await getEventBuckets();
  const isUpcoming = upcoming.some((e) => e.id === event.id);

  if (!isUpcoming) {
    return (
      <div className="rounded-2xl bg-ink/60 p-6 ring-1 ring-ivory/10">
        <Pill tone="muted">Past event</Pill>
        <p className="mt-3 text-ivory/80">
          This event has finished. Upcoming dates are on the events page.
        </p>
        <ButtonLink href="/events" variant="secondary" className="mt-5" arrow>
          See upcoming events
        </ButtonLink>
      </div>
    );
  }

  if (event.ticketUrl) {
    return (
      <div className="rounded-2xl bg-ink/60 p-6 ring-1 ring-ivory/10">
        <OutboundLink
          href={event.ticketUrl}
          campaign={`event-${event.slug}`}
          event="event_registration_start"
          label={event.slug}
          variant="primary"
          size="lg"
          className="w-full"
        >
          Register
        </OutboundLink>
        <p className="mt-3 text-[0.85rem] text-ivory/60">
          Registration opens on the ticketing partner’s site.
        </p>
        <CapacityNote event={event} />
      </div>
    );
  }

  const availability = bookingAvailability(event, await getBookingClock());
  if (event.booking && availability === 'open') {
    const price = event.booking.priceCents;
    return (
      <div className="rounded-2xl bg-ink/60 p-6 ring-1 ring-ivory/10">
        <p className="type-eyebrow text-gold">{event.booking.ticketName}</p>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-2">
          <span className="font-display text-[2rem] leading-none font-semibold">
            {price === null ? 'Price to be confirmed' : price === 0 ? 'Free' : formatUsd(price)}
          </span>
          {price ? <span className="text-ivory/60">per seat</span> : null}
          {event.isDemo && price ? <Pill tone="demo">Demo price</Pill> : null}
        </p>
        <ButtonLink href={`/events/${event.slug}/book`} size="lg" className="mt-6 w-full" arrow>
          {price === null ? 'Request seats' : price === 0 ? 'Register' : 'Book seats'}
        </ButtonLink>
        <p className="mt-3 text-[0.85rem] text-ivory/60">
          {price === null
            ? 'Send a request; the team confirms the price and your seats by email.'
            : price === 0
              ? `Up to ${event.booking.maxPerOrder} seats per registration.`
              : `Up to ${event.booking.maxPerOrder} seats per order. Payment by card on Stripe’s secure checkout.`}
        </p>
        <CapacityNote event={event} />
      </div>
    );
  }

  const closed =
    availability === 'closed' || availability === 'sold-out' || availability === 'cutoff-passed'
      ? availabilityMessages[availability]
      : null;
  return (
    <div className="rounded-2xl bg-ink/60 p-6 ring-1 ring-ivory/10">
      {closed ? (
        <>
          <Pill tone="muted">
            {availability === 'sold-out' ? 'Fully booked' : 'Booking closed'}
          </Pill>
          <p className="mt-3 text-ivory/80">{closed}</p>
        </>
      ) : (
        <>
          <p className="font-semibold">Registration opens soon</p>
          <p className="mt-2 text-[0.9rem] text-ivory/70">
            Join the mailing list to hear when tickets are available.
          </p>
          <ButtonLink href="/#newsletter" className="mt-5 w-full">
            Join the mailing list
          </ButtonLink>
        </>
      )}
      <CapacityNote event={event} />
    </div>
  );
}

function CapacityNote({ event }: { event: SiteEvent }) {
  return event.capacityNote ? (
    <p className="mt-4 text-[0.875rem] text-ivory/70">{event.capacityNote}</p>
  ) : null;
}

export default async function EventPage({ params }: PageProps<'/events/[slug]'>) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  return (
    <>
      <PageHero
        image={event.image}
        eyebrow={eventTypeLabels[event.type]}
        title={event.title}
        crumbs={[
          { name: 'Home', path: '/' },
          { name: 'Events', path: '/events' },
          { name: event.title, path: `/events/${event.slug}` },
        ]}
        meta={
          <div className="flex flex-wrap gap-2">
            <Pill tone="muted">{eventFormatLabels[event.format]}</Pill>
            {event.isDemo ? <Pill tone="demo">Demo — not a real event</Pill> : null}
          </div>
        }
      />

      <Section tone="charcoal" labelledBy="details-title" className="!pt-14">
        <div className="container-site grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
          <div>
            <h2 id="details-title" className="sr-only">
              Event details
            </h2>
            <ul className="grid gap-5 sm:grid-cols-3">
              <li className="flex gap-3">
                <CalendarIcon className="mt-0.5 shrink-0 text-gold" />
                <span>{formatEventDate(event)}</span>
              </li>
              <li className="flex gap-3">
                <ClockIcon className="mt-0.5 shrink-0 text-gold" />
                <span>
                  {formatEventTime(event)}
                  <span className="block text-[0.85rem] text-ivory/60">
                    {event.timezone.replaceAll('_', ' ')}
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                {event.format === 'online' ? (
                  <GlobeIcon className="mt-0.5 shrink-0 text-gold" />
                ) : (
                  <PinIcon className="mt-0.5 shrink-0 text-gold" />
                )}
                <span>{event.location}</span>
              </li>
            </ul>

            <p className="type-lede mt-10 max-w-2xl text-ivory/82">{event.description}</p>

            {event.agenda.length > 0 ? (
              <div className="mt-12">
                <h3 className="type-display-sm">Agenda</h3>
                <ol className="mt-5 space-y-3">
                  {event.agenda.map((item, i) => (
                    <li
                      key={item}
                      className="flex items-baseline gap-4 border-b border-ivory/10 pb-3"
                    >
                      <span className="font-display text-gold">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="type-title">Accessibility</h3>
                <p className="mt-2 text-ivory/72">
                  {event.accessibility ??
                    'Access details will be shared here. If you have a specific need, contact the team before the event.'}
                </p>
              </div>
              <div>
                <h3 className="type-title">Refunds and cancellations</h3>
                <p className="mt-2 text-ivory/72">
                  {event.refundPolicyUrl ? (
                    <>
                      Covered by the{' '}
                      <a
                        href={event.refundPolicyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        official return policy
                      </a>
                      .
                    </>
                  ) : (
                    'Terms will be confirmed with the event details.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-ink/60" />}>
              <Registration event={event} />
            </Suspense>
            <p className="mt-5 px-1 text-[0.875rem] text-ivory/65">
              Questions about this event?{' '}
              <Link href="/contact?topic=general" className="underline hover:text-ivory">
                Contact the team
              </Link>
              .
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}
