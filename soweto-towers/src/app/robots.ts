import type { MetadataRoute } from 'next';
import { site } from '@/content/site';

/** Previews stay out of search engines until NEXT_PUBLIC_SITE_ENV=production. */
export default function robots(): MetadataRoute.Robots {
  if (!site.indexable) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/checkout/', '/booking/', '/ticket/', '/voucher/', '/p/'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
