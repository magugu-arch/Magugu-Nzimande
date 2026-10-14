import { books } from '@/content/books';
import { events } from '@/content/events';
import { content } from '@/content/learn';
import { programs } from '@/content/programs';
import { testimonials } from '@/content/testimonials';
import type {
  Book,
  ContentItem,
  Governance,
  Program,
  PublishStatus,
  SiteEvent,
  Testimonial,
} from '@/content/types';
import { IS_PREVIEW, type SiteMode, SITE_MODE } from './env';

/**
 * The one place that decides what the public can see. Pages never filter by
 * status themselves; they ask here. That keeps "demo data never ships" and
 * "drafts never show" true by construction rather than by every page
 * remembering.
 */

const PUBLIC_STATUSES: readonly PublishStatus[] = ['active', 'waitlist', 'closed'];

export function isPublishable(
  record: Pick<Governance, 'isDemo'> & { status?: PublishStatus },
  mode: SiteMode = SITE_MODE,
): boolean {
  if (mode === 'production') {
    if (record.isDemo) return false;
    return record.status === undefined || PUBLIC_STATUSES.includes(record.status);
  }
  // Preview shows drafts and demo fixtures so they can be reviewed, but
  // archived records stay out of listings everywhere.
  return record.status !== 'archived';
}

export function publishable<T extends Pick<Governance, 'isDemo'> & { status?: PublishStatus }>(
  records: readonly T[],
  mode: SiteMode = SITE_MODE,
): T[] {
  return records.filter((r) => isPublishable(r, mode));
}

/**
 * Params for generateStaticParams. With Cache Components a dynamic route must
 * return at least one param at build time, and in production every demo
 * collection is empty — so an empty list becomes a placeholder slug that no
 * record has, which the page answers with notFound().
 */
export function staticParams(slugs: string[]): { slug: string }[] {
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: '__none__' }];
}

// ---------- Programs ----------

export function getPrograms(mode?: SiteMode): Program[] {
  return publishable(programs, mode).sort((a, b) => a.order - b.order);
}

export function getFeaturedPrograms(): Program[] {
  return getPrograms().filter((p) => p.status === 'active');
}

export function getProgram(slug: string): Program | undefined {
  return getPrograms().find((p) => p.slug === slug);
}

// ---------- Books ----------

export function getBooks(mode?: SiteMode): Book[] {
  return publishable(books, mode).sort((a, b) => a.order - b.order);
}

export function getBook(slug: string): Book | undefined {
  return getBooks().find((b) => b.slug === slug);
}

// ---------- Events (upcoming/past is decided in lib/events.ts) ----------

export function getEvents(mode?: SiteMode): SiteEvent[] {
  return publishable(events, mode);
}

export function getEvent(slug: string): SiteEvent | undefined {
  return getEvents().find((e) => e.slug === slug);
}

/** Events with booking on this site (open or not); outside ticket links take precedence. */
export function getBookableEvents(mode?: SiteMode): SiteEvent[] {
  return getEvents(mode).filter((e) => e.booking !== null && !e.ticketUrl);
}

// ---------- Learning library ----------

export function getContent(mode?: SiteMode): ContentItem[] {
  return publishable(content, mode).sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}

export function getContentItem(slug: string): ContentItem | undefined {
  return getContent().find((c) => c.slug === slug);
}

export function getArticles(): ContentItem[] {
  return getContent().filter((c) => c.type === 'article');
}

export function getRelated(item: ContentItem): ContentItem[] {
  const all = getContent();
  return item.related
    .map((id) => all.find((c) => c.id === id))
    .filter((c): c is ContentItem => !!c);
}

export { contentHref } from './links';

// ---------- Testimonials ----------

/** Approved stories only in production; preview also returns the placeholders. */
export function getTestimonials(mode: SiteMode = SITE_MODE): Testimonial[] {
  return testimonials.filter((t) => (mode === 'production' ? t.approved && !t.isDemo : true));
}

export { IS_PREVIEW };
