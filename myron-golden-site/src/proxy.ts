import { NextResponse, type NextRequest } from 'next/server';
import {
  getArticles,
  getBookableEvents,
  getBooks,
  getContent,
  getEvents,
  getPrograms,
} from '@/lib/content';

/**
 * Real 404s for unknown detail pages. With Partial Prerendering the static
 * shell is streamed before a page can call notFound(), so an unknown slug
 * would get the right "not found" content but a 200 status — a soft 404.
 * Checking slugs here, before rendering, gives crawlers the 404 they need.
 * The lists come from the same data layer as the pages, so drafts and demo
 * records follow the same preview/production rules.
 */
const known: Record<string, Set<string>> = {
  programs: new Set(getPrograms().map((p) => p.slug)),
  books: new Set(getBooks().map((b) => b.slug)),
  events: new Set(getEvents().map((e) => e.slug)),
  learn: new Set(
    getContent()
      .filter((c) => c.type !== 'article')
      .map((c) => c.slug),
  ),
  insights: new Set(getArticles().map((a) => a.slug)),
};

/** /events/<slug>/book exists only for events that book on this site. */
const bookable = new Set(getBookableEvents().map((e) => e.slug));

export function proxy(request: NextRequest) {
  const [, section, slug, ...rest] = request.nextUrl.pathname.split('/');
  const slugs = section ? known[section] : undefined;
  if (!slugs || !slug) return NextResponse.next();
  const decoded = decodeURIComponent(slug);
  if (rest.length === 0 && slugs.has(decoded)) return NextResponse.next();
  if (section === 'events' && rest.length === 1 && rest[0] === 'book' && bookable.has(decoded)) {
    return NextResponse.next();
  }
  // No route matches this path, so the app renders its not-found page with a 404.
  return NextResponse.rewrite(new URL('/_missing', request.url));
}

export const config = {
  matcher: [
    '/programs/:slug+',
    '/books/:slug+',
    '/events/:slug+',
    '/learn/:slug+',
    '/insights/:slug+',
  ],
};
