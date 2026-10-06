import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'public/media/**', '.data/**', '.smoke/**']),
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Build, audit and smoke scripts are CLI tools — their job is to print.
    files: ['scripts/**', 'e2e/**'],
    rules: { 'no-console': 'off' },
  },
]);
