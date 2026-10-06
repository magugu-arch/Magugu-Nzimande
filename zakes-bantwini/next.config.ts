import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Content Security Policy for production. Scripts only from this origin (and
 * Plausible, when configured); 'unsafe-inline' remains because Next streams
 * inline bootstrap scripts and nonces would force every page to render
 * dynamically — the other directives still block foreign scripts, framing,
 * plugin content, base-tag hijacks and forms posting anywhere but here and
 * the payment gateway. Not applied in development, where HMR needs eval.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Video files and caption tracks may live on a video host.
  "media-src 'self' https:",
  "connect-src 'self' https://plausible.io",
  'frame-src https://www.youtube-nocookie.com',
  "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }] : []),
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
