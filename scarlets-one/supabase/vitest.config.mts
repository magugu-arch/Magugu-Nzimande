import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the database tests. The Deno Edge Function stub under functions/ is
    // not Node code and must never be collected.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Each test file boots its own in-process PostgreSQL (about 300 MB of
    // WebAssembly memory), so keep the number running side by side small.
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
