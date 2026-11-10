// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.next/**',
      '**/coverage/**',
      '.screens/**',
      'apps/admin/next-env.d.ts',
      // Deno edge functions are checked by the Supabase CLI toolchain.
      'supabase/functions/**',
    ],
  },
  {
    settings: {
      // Workspace packages ship TypeScript source; resolve them like the bundlers do.
      'import/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json', 'supabase/tsconfig.json'],
        },
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['**/scripts/**/*.mjs', '**/scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/jest.setup.js', '**/__tests__/**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        require: 'readonly',
      },
    },
  },
]);
