import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Booting Postgres in WebAssembly takes a few seconds.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
