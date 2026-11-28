import type { NextConfig } from 'next';

// Note: while this app lives inside a larger repository, Next warns about two
// lockfiles and picks the outer folder as the workspace root. That is harmless.
// Don't silence it with `turbopack.root` pointing here: in Next 16.4 the dev
// server then watches its own log files in .next/dev and reloads in a loop.

const isDev = process.env.NODE_ENV === 'development';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
const httpsSite = siteUrl.startsWith('https://') && !siteUrl.includes('localhost');

/**
 * A static CSP (no nonces) keeps every marketing page prerendered on the CDN.
 * Script sources are limited to this site plus the analytics hosts that load
 * only after cookie consent. Payments leave by form POST to PayFast.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://*.tiktok.com",
  "font-src 'self'",
  "connect-src 'self' https://api.open-meteo.com https://www.google-analytics.com https://region1.google-analytics.com https://www.facebook.com https://*.tiktok.com",
  'frame-src https://www.google.com https://www.youtube-nocookie.com',
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
  "frame-ancestors 'none'",
  ...(httpsSite ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(httpsSite ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
];

// Old WordPress URLs keep their search rankings by pointing permanently at the new pages.
const legacy: [string, string][] = [
  ['/about', '/about'],
  ['/contact-us', '/contact'],
  ['/adventures', '/adventures'],
  ['/bungee-jump', '/adventures/bungee-jump'],
  ['/straightjacket-bungee', '/adventures/straightjacket-bungee'],
  ['/zipline', '/adventures/zipline'],
  ['/scad-freefall', '/adventures/scad-freefall'],
  ['/painbtball', '/adventures/paintball'],
  ['/paintball', '/adventures/paintball'],
  ['/base-jump', '/adventures/base-jump'],
  ['/view', '/adventures/lift-ride'],
  ['/shop', '/book'],
  ['/cart', '/book'],
  ['/checkout', '/book'],
  ['/product/bungee-jump', '/adventures/bungee-jump'],
  ['/product/straightjacket-bungee', '/adventures/straightjacket-bungee'],
  ['/product/zipline', '/adventures/zipline'],
  ['/product/scad-freefall', '/adventures/scad-freefall'],
  ['/product/paintball', '/adventures/paintball'],
  ['/product/base-jump', '/adventures/base-jump'],
  ['/product/view', '/adventures/lift-ride'],
  ['/product-category/:slug*', '/adventures'],
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  poweredByHeader: false,
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**/*'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75, 85],
    deviceSizes: [390, 640, 828, 1080, 1280, 1600, 1920, 2400],
  },
  experimental: {
    useOffline: true,
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/og/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
  async redirects() {
    return legacy.filter(([from, to]) => from !== to).map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default nextConfig;
