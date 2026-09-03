import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Standalone, so the container carries the server and the modules it actually
   * imports rather than the whole toolchain.
   *
   * This pairs with `outputFileTracingRoot` below and neither works without the
   * other here: tracing from this directory would prune packages/ and infra/,
   * which the bundle imports through path aliases, and the container would
   * start and then fail on the first request that touched the catalogue.
   */
  output: 'standalone',
  // packages/ and infra/ sit above this app, so tracing has to start at the
  // repository root or the build prunes files the bundle actually imports.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  turbopack: {
    root: path.join(__dirname, '../../'),
  },
  typedRoutes: true,
};

export default nextConfig;
