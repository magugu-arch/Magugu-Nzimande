import Head from 'expo-router/head';
import {
  absolute,
  GOOGLE_SITE_VERIFICATION,
  OG_IMAGE,
  pageTitle,
  SITE_DESCRIPTION,
  SITE_NAME,
} from './site';

export interface PageMetaProps {
  /** The page's own title; the restaurant's name is added after it. */
  title?: string;
  description?: string;
  /** Canonical path, e.g. `/menu`. Leave out on a page with no fixed address. */
  path?: string;
  /** Absolute image URL for the social card. */
  image?: string;
  /** Anything personal or behind sign-in: keep it out of search results. */
  noindex?: boolean;
  /** schema.org objects for this page. */
  schema?: object[];
  type?: 'website' | 'article' | 'restaurant.restaurant';
}

/**
 * The tags a search engine and a shared link need: title, description,
 * canonical address, social card and structured data. Native builds ignore
 * all of it; the web build renders it into each page's HTML at export.
 */
export function PageMeta({
  title,
  description = SITE_DESCRIPTION,
  path,
  image = OG_IMAGE,
  noindex,
  schema,
  type = 'website',
}: PageMetaProps) {
  const full = pageTitle(title);
  const url = path ? absolute(path) : undefined;
  return (
    <Head>
      <title>{full}</title>
      <meta name="description" content={description} />
      {url ? <link rel="canonical" href={url} /> : null}
      <meta
        name="robots"
        content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}
      />
      {GOOGLE_SITE_VERIFICATION ? (
        <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />
      ) : null}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="en_ZA" />
      {url ? <meta property="og:url" content={url} /> : null}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={full} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {schema?.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Head>
  );
}
