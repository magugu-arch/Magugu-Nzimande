import path from 'node:path';
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // This app lives inside a larger repository; trace and bundle from here.
  turbopack: { root: path.resolve('.') },
  outputFileTracingRoot: path.resolve('.'),
  poweredByHeader: false,
  reactStrictMode: true,
  // Media is pre-encoded by scripts/build-images.mjs into AVIF/WebP derivatives
  // and served as static files, so the runtime image optimiser is not used.
  images: { unoptimized: true },
  // Press downloads stream the original masters, which nothing imports.
  outputFileTracingIncludes: {
    '/press/photos/*': ['./assets/masters/**/*'],
  },
  experimental: {
    serverActions: {
      // Admin uploads agreements and technical riders through server actions.
      bodySizeLimit: '12mb',
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Private client pages: never cache, never index.
        source: '/book/:section(quote|confirmation)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
