import path from 'node:path';

/**
 * Static export: the prototype has no server. Every integration is a typed mock
 * adapter that runs in the browser, so the whole experience can be hosted from
 * any static file host.
 *
 * NEXT_PUBLIC_BASE_PATH lets the same build sit under a sub-path, for example
 * `/Magugu-Nzimande/home-affairs-one` on GitHub Pages.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: [
    '@hao/accessibility',
    '@hao/api-contracts',
    '@hao/api-gateway',
    '@hao/application-workflow',
    '@hao/appointments',
    '@hao/audit-service',
    '@hao/auth-client',
    '@hao/design-system',
    '@hao/identity-adapter',
    '@hao/local-platform',
    '@hao/notifications',
    '@hao/payments-adapter',
    '@hao/service-catalogue',
    '@hao/shared-types',
    '@hao/support-desk',
    '@hao/whatsapp-adapter',
  ],
  // The repository holds other projects with their own lockfiles; pin the
  // workspace root so module resolution never wanders above this folder.
  turbopack: { root: path.join(import.meta.dirname, '..', '..') },
};

export default nextConfig;
