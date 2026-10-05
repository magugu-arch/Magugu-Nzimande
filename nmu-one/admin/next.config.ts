import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * A static export: the console is plain HTML, CSS and JS that any web server
 * can host, talking to the NMU ONE BFF from the browser in live mode.
 *
 * Turbopack's root is the NMU ONE project folder so the console can import
 * the shared, framework-free core (`../src/core`) — the same permission
 * matrix and help content the mobile app enforces.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  // The shared core reads EXPO_PUBLIC_DEMO_CLOCK; pass it through so the
  // console and the app can run on the same clock (docs/ENVIRONMENT.md).
  env: {
    EXPO_PUBLIC_DEMO_CLOCK: process.env.EXPO_PUBLIC_DEMO_CLOCK ?? '',
  },
  turbopack: {
    root: path.join(__dirname, '..'),
  },
};

export default nextConfig;
