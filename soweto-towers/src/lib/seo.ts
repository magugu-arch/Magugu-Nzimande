import type { Metadata } from 'next';
import { site } from '@/content/site';

/** Both names people search for go in every title (relaunch brief: "both names in every page title"). */
export const TITLE_SUFFIX = 'Soweto Towers (Orlando Towers)';

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  /** A 1200×630 JPEG under /public/og, kept small enough for WhatsApp previews. */
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  publishedTime?: string;
};

export function pageMeta({
  title,
  description,
  path,
  image = '/og/home.jpg',
  imageAlt,
  type = 'website',
  noindex = false,
  publishedTime,
}: PageMetaInput): Metadata {
  // A title that already names both (an article about the two names) only needs the brand once.
  const namesBoth = /soweto towers/i.test(title) && /orlando towers/i.test(title);
  const fullTitle = namesBoth ? title : `${title} | ${TITLE_SUFFIX}`;
  const index = site.indexable && !noindex;
  return {
    title: namesBoth ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: path,
      siteName: site.name,
      locale: site.locale,
      title: fullTitle,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt ?? fullTitle, type: 'image/jpeg' }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
    },
    robots: index ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } } : { index: false, follow: !noindex },
  };
}
