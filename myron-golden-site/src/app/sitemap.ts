import type { MetadataRoute } from 'next';
import { getArticles, getBooks, getContent, getEvents, getPrograms } from '@/lib/content';
import { absoluteUrl } from '@/lib/env';

const staticPaths = [
  '/',
  '/about',
  '/work-with-myron',
  '/programs',
  '/books',
  '/learn',
  '/insights',
  '/events',
  '/speaking',
  '/press',
  '/contact',
  '/login',
  '/privacy',
  '/terms',
  '/cookies',
  '/refunds',
  '/disclosures',
];

/**
 * Published pages only. The data layer already drops demo and draft records
 * in production, so nothing unverified can reach the sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const isPublic = (r: { status?: string; isDemo?: boolean }) => !r.isDemo && r.status !== 'draft';
  return [
    ...staticPaths.map((path) => ({ url: absoluteUrl(path) })),
    ...getPrograms()
      .filter(isPublic)
      .map((p) => ({ url: absoluteUrl(`/programs/${p.slug}`), lastModified: p.lastReviewed })),
    ...getBooks()
      .filter(isPublic)
      .map((b) => ({ url: absoluteUrl(`/books/${b.slug}`), lastModified: b.lastReviewed })),
    ...getEvents()
      .filter(isPublic)
      .map((e) => ({ url: absoluteUrl(`/events/${e.slug}`), lastModified: e.lastReviewed })),
    ...getContent()
      .filter((c) => c.type !== 'article' && isPublic(c))
      .map((c) => ({ url: absoluteUrl(`/learn/${c.slug}`), lastModified: c.publishedOn })),
    ...getArticles()
      .filter(isPublic)
      .map((a) => ({ url: absoluteUrl(`/insights/${a.slug}`), lastModified: a.publishedOn })),
  ];
}
