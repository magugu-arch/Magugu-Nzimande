import type { Metadata } from 'next';
import { site, verifiedSocials } from '@/content/site';
import type { Book } from '@/content/types';
import { absoluteUrl, IS_PREVIEW } from './env';

const OG_IMAGE = {
  url: '/og/og-default.jpg',
  width: 1200,
  height: 630,
  alt: 'Myron Golden on a dark stage with warm gold lighting.',
};

/**
 * Per-page metadata: a unique title and description, a canonical on the
 * configured origin, and social cards. Preview deployments are noindex so a
 * preview URL can never compete with the real site (brief §10).
 */
export function pageMetadata(options: {
  title?: string;
  description: string;
  path: string;
  image?: { url: string; width: number; height: number; alt: string };
  noindex?: boolean;
}): Metadata {
  const { title, description, path, image = OG_IMAGE, noindex = false } = options;
  const fullTitle = title
    ? `${title} · ${site.name}`
    : `${site.name} — Offers, sales and business growth`;
  return {
    title: title ?? { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: site.name,
      title: fullTitle,
      description,
      url: path,
      images: [image],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image.url],
    },
    robots: IS_PREVIEW || noindex ? { index: false, follow: !IS_PREVIEW } : undefined,
  };
}

/** Escapes `<` so a string in the payload can never close the script tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const personId = absoluteUrl('/#person');
const orgId = absoluteUrl('/#organization');

/** Person + Organization + WebSite. sameAs lists verified accounts only. */
export function identityJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: site.name,
        jobTitle: site.tagline,
        url: absoluteUrl('/'),
        image: absoluteUrl('/images/myron/03-myron-press-headshot.jpg'),
        worksFor: { '@id': orgId },
        sameAs: verifiedSocials.map((s) => s.url),
      },
      {
        '@type': 'Organization',
        '@id': orgId,
        name: site.legalEntity,
        url: absoluteUrl('/'),
        founder: { '@id': personId },
      },
      {
        '@type': 'WebSite',
        '@id': absoluteUrl('/#website'),
        name: site.name,
        url: absoluteUrl('/'),
        publisher: { '@id': orgId },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/search')}?q={query}` },
          'query-input': 'required name=query',
        },
      },
    ],
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Book schema with only what is known. No image while the cover is a
 * mock-up, and no ISBN or publisher until confirmed.
 */
export function bookJsonLd(book: Book) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    url: absoluteUrl(`/books/${book.slug}`),
    ...(book.role === 'author' ? { author: { '@id': personId } } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.publisher ? { publisher: { '@type': 'Organization', name: book.publisher } } : {}),
  };
}
