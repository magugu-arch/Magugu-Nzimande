import Link from 'next/link';
import { topics } from '@/content/taxonomy';
import type { Book, ContentItem, Program, SiteEvent } from '@/content/types';
import { cn } from '@/lib/cn';
import { contentHref } from '@/lib/links';
import {
  eventFormatLabels,
  eventTypeLabels,
  formatEventShortDate,
  formatEventTime,
} from '@/lib/events';
import { formatUsd } from '@/lib/booking';
import type { ShopItem } from '@/lib/shop';
import { Photo } from '../media/Photo';
import { AddToCart } from '../shop/AddToCart';
import { OutboundLink } from '../ui/OutboundLink';
import { Pill } from '../ui/Section';
import { ArrowRight, ClockIcon, GlobeIcon, PinIcon, PlayIcon } from '../ui/icons';

/** Program status as a reader would say it. Drafts only ever appear in preview. */
export function StatusPill({ status }: { status: Program['status'] }) {
  if (status === 'active') return null;
  const label =
    status === 'draft'
      ? 'Awaiting confirmation'
      : status === 'waitlist'
        ? 'Waitlist'
        : status === 'closed'
          ? 'Enrolment closed'
          : 'Archived';
  return <Pill tone={status === 'draft' ? 'demo' : 'muted'}>{label}</Pill>;
}

export function ProgramCard({
  program,
  priority = false,
}: {
  program: Program;
  priority?: boolean;
}) {
  return (
    <article className="lift group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-charcoal ring-1 ring-ivory/10 hover:ring-gold/40">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Photo
          id={program.image}
          fill
          alt=""
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="lift-image"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-transparent to-transparent" />
        <div className="absolute top-4 left-4 flex gap-2">
          <StatusPill status={program.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6 pt-5">
        <p className="type-eyebrow text-gold">{program.format ?? 'Program'}</p>
        <h3 className="mt-3 font-display text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.01em]">
          <Link
            href={`/programs/${program.slug}`}
            prefetch
            className="after:absolute after:inset-0"
          >
            {program.title}
          </Link>
        </h3>
        <p className="type-small mt-3 flex-1 text-ivory/72">{program.summary}</p>
        <span className="mt-6 inline-flex items-center gap-2 text-[0.9rem] font-semibold text-gold-bright">
          Learn more
          <ArrowRight
            size={18}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </article>
  );
}

export function PlaceholderCoverLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'material absolute right-3 bottom-3 left-3 rounded-lg bg-ink/75 px-3 py-2 text-center text-[0.6875rem] leading-snug font-medium text-ivory/90 backdrop-blur-md',
        className,
      )}
    >
      Placeholder mock-up — not the official cover
    </span>
  );
}

export function BookCover({
  book,
  sizes,
  priority,
}: {
  book: Book;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className="relative aspect-[1145/1374] overflow-hidden rounded-2xl bg-midnight ring-1 ring-ivory/10">
      {book.cover ? (
        <>
          <Photo
            id={book.cover}
            fill
            sizes={sizes}
            priority={priority}
            quality={82}
            className="lift-image"
          />
          <PlaceholderCoverLabel />
        </>
      ) : (
        <div className="grain absolute inset-0 grid place-items-center bg-gradient-to-b from-midnight to-ink p-8 text-center">
          <div>
            <p className="font-display text-3xl leading-tight font-semibold">{book.title}</p>
            <p className="type-small mt-4 text-ivory/65">Cover to be confirmed</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function BookCard({
  book,
  priority = false,
  shopItem,
}: {
  book: Book;
  priority?: boolean;
  /** The book is on sale here: show its price and Add to cart. */
  shopItem?: ShopItem;
}) {
  return (
    <article className="lift group relative flex flex-col">
      <BookCover
        book={book}
        priority={priority}
        sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 90vw"
      />
      <div className="mt-6 flex items-center gap-2">
        {book.status === 'draft' ? <Pill tone="light">Awaiting confirmation</Pill> : null}
      </div>
      <h3 className="mt-2 font-display text-[2rem] leading-[1.05] font-semibold tracking-[-0.012em]">
        <Link href={`/books/${book.slug}`} prefetch className="hover:text-gold-deep">
          {book.title}
        </Link>
      </h3>
      <p className="type-small mt-3 max-w-md text-slate">{book.synopsis}</p>
      {shopItem ? (
        <div className="mt-5 space-y-3">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[1.25rem] font-semibold tabular-nums">
              {formatUsd(shopItem.priceCents)}
            </span>
            {shopItem.isDemoPrice ? <Pill tone="light">Demo price</Pill> : null}
          </p>
          <AddToCart item={shopItem} variant="ink" size="md" tone="light" />
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href={`/books/${book.slug}`}
          className="inline-flex items-center gap-2 text-[0.9rem] font-semibold text-ink underline-offset-4 hover:underline"
        >
          About the book <ArrowRight size={16} />
        </Link>
        {book.buy ? (
          <OutboundLink
            href={book.buy.href}
            campaign={`book-${book.slug}`}
            event="book_outbound_click"
            label={book.slug}
            className="text-[0.9rem] font-semibold text-gold-deep hover:text-ink"
          >
            {book.buy.label}
          </OutboundLink>
        ) : null}
      </div>
    </article>
  );
}

export function ContentCard({
  item,
  sizes = '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw',
  className,
  layout = 'stack',
}: {
  item: ContentItem;
  sizes?: string;
  className?: string;
  /** `row` puts a small thumbnail beside the text, for sidebars and lists. */
  layout?: 'stack' | 'row';
}) {
  const row = layout === 'row';
  return (
    <article
      className={cn(
        'lift group relative',
        row && 'grid grid-cols-[7.5rem_1fr] items-start gap-4 sm:grid-cols-[10rem_1fr] sm:gap-5',
        className,
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-charcoal ring-1 ring-ivory/10',
          row ? 'aspect-[4/3] rounded-xl' : 'aspect-[16/10] rounded-2xl',
        )}
      >
        <Photo id={item.image} fill alt="" sizes={row ? '10rem' : sizes} className="lift-image" />
        {item.type === 'video' ? (
          <span
            className={cn(
              'material absolute inline-flex items-center gap-1.5 rounded-full bg-ink/70 font-semibold backdrop-blur-md',
              row
                ? 'bottom-2 left-2 px-2 py-1 text-[0.6875rem]'
                : 'bottom-3 left-3 px-3 py-1.5 text-[0.75rem]',
            )}
          >
            <PlayIcon size={row ? 10 : 12} className="text-gold" />
            {item.durationMinutes ? `${item.durationMinutes} min` : 'Video'}
          </span>
        ) : null}
      </div>
      <div>
        <div className={cn('flex flex-wrap items-center gap-2', !row && 'mt-4')}>
          <Pill tone="muted">{topics[item.topic].label}</Pill>
          {item.isDemo ? <Pill tone="demo">Demo</Pill> : null}
        </div>
        <h3
          className={cn(
            'type-title transition-colors group-hover:text-gold-bright',
            row ? 'mt-2 text-[1.0625rem]' : 'mt-3',
          )}
        >
          <Link href={contentHref(item)} prefetch className="after:absolute after:inset-0">
            {item.title}
          </Link>
        </h3>
        <p className={cn('type-small mt-2 line-clamp-2 text-ivory/70', row && 'max-sm:hidden')}>
          {item.excerpt}
        </p>
      </div>
    </article>
  );
}

export function EventDateBlock({ event }: { event: SiteEvent }) {
  const d = formatEventShortDate(event);
  return (
    <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-ink/60 py-2.5 ring-1 ring-gold/25">
      <span className="type-eyebrow text-[0.625rem] text-gold">{d.month}</span>
      <span className="font-display text-[2rem] leading-none font-semibold">{d.day}</span>
      <span className="mt-1 text-[0.6875rem] text-ivory/60">{d.weekday}</span>
    </div>
  );
}

export function EventCard({ event, past = false }: { event: SiteEvent; past?: boolean }) {
  return (
    <article
      className={cn(
        'lift group relative grid grid-cols-[auto_1fr] items-start gap-5 rounded-2xl bg-charcoal/70 p-4 ring-1 ring-ivory/10 hover:ring-gold/35 sm:p-5 md:grid-cols-[auto_1fr_11rem]',
        past && 'opacity-80',
      )}
    >
      <EventDateBlock event={event} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="muted">{eventTypeLabels[event.type]}</Pill>
          {event.isDemo ? <Pill tone="demo">Demo</Pill> : null}
          {past ? <Pill tone="muted">Past</Pill> : null}
        </div>
        <h3 className="type-title mt-3 transition-colors group-hover:text-gold-bright">
          <Link href={`/events/${event.slug}`} prefetch className="after:absolute after:inset-0">
            {event.title}
          </Link>
        </h3>
        <ul className="type-small mt-2 flex flex-col gap-1 text-ivory/70 sm:flex-row sm:flex-wrap sm:gap-x-5">
          <li className="inline-flex items-center gap-1.5">
            <ClockIcon size={15} className="text-gold/80" />
            {formatEventTime(event)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            {event.format === 'online' ? (
              <GlobeIcon size={15} className="text-gold/80" />
            ) : (
              <PinIcon size={15} className="text-gold/80" />
            )}
            {event.format === 'online' ? eventFormatLabels.online : event.location}
          </li>
        </ul>
      </div>
      <div className="relative hidden aspect-[4/3] overflow-hidden rounded-xl md:block">
        <Photo id={event.image} fill alt="" sizes="11rem" className="lift-image" />
      </div>
    </article>
  );
}
