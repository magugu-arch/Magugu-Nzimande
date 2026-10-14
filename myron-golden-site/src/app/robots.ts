import type { MetadataRoute } from 'next';
import { absoluteUrl, IS_PREVIEW } from '@/lib/env';

/** Preview deployments are closed to crawlers entirely; production opens up. */
export default function robots(): MetadataRoute.Robots {
  if (IS_PREVIEW) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/search', '/review', '/thank-you'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
