// @ts-check
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Nothing leaves the machine at build time or at runtime, Next's own usage
// telemetry included. The config is loaded before telemetry starts.
process.env.NEXT_TELEMETRY_DISABLED ??= '1';

const here = path.dirname(fileURLToPath(import.meta.url));
/** The npm-workspaces root. There is another lockfile one level above it, so say which one is ours. */
const monorepoRoot = path.join(here, '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared packages ship TypeScript source: `main` points at src/index.ts.
  transpilePackages: ['@scarlets/domain', '@scarlets/adapters', '@scarlets/ui'],
  turbopack: { root: monorepoRoot },
  outputFileTracingRoot: monorepoRoot,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
