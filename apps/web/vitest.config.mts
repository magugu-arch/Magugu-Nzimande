import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@bbq/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@bbq/ui/tokens': path.resolve(__dirname, '../../packages/ui/src/tokens.ts'),
      '@bbq/seed': path.resolve(__dirname, '../../infra/seed/index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
