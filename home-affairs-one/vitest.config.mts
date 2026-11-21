import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'apps/web/src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'packages/**/*.test.{ts,tsx}',
      'services/**/*.test.ts',
      'infrastructure/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
      'tests/{contract,integration,security}/**/*.test.ts',
    ],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
  },
});
