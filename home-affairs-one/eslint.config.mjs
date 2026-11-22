import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      // The full accessibility rule set, not only the handful Next enables.
      ...jsxA11y.flatConfigs.recommended.rules,
      // `role` on our own components (<RequireRole role="staff">) is not an ARIA role.
      'jsx-a11y/aria-role': ['error', { ignoreNonDOM: true }],
      // Static export: images are pre-optimised by scripts/derive-assets.mjs and
      // rendered through the manifest-driven <Photo>, so <img> is intentional.
      '@next/next/no-img-element': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // CLI scripts print by design.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  prettier,
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/out/**',
    'apps/web/next-env.d.ts',
    'apps/web/public/**',
    'apps/web/src/generated/**',
    'apps/web/single-file/.build/**',
    'apps/web/single-file/src/generated/**',
    'share/**',
    'coverage/**',
    'test-results/**',
    'playwright-report/**',
    '.shots/**',
  ]),
]);
