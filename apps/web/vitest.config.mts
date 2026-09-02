import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@bbq/types': path.resolve(import.meta.dirname, '../../packages/types/src/index.ts'),
      '@bbq/ui/tokens': path.resolve(import.meta.dirname, '../../packages/ui/src/tokens.ts'),
      '@bbq/seed': path.resolve(import.meta.dirname, '../../infra/seed/index.ts'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
