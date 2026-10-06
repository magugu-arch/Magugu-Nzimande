import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Preview deployments should never be indexed; only production opts in.
  const allow = process.env.ALLOW_INDEXING === 'true';
  return {
    rules: allow
      ? [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/book/quote/', '/book/confirmation/', '/book/pay/'] }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: siteUrl('/sitemap.xml'),
  };
}
