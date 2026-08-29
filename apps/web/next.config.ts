import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // packages/ and infra/ sit above this app, so tracing has to start at the
  // repository root or the build prunes files the bundle actually imports.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  turbopack: {
    root: path.join(__dirname, '../../'),
  },
  typedRoutes: true,
};

export default nextConfig;
