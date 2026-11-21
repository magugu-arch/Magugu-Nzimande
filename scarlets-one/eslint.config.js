// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const path = require('node:path');

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
      '**/*.generated.ts',
      // The admin console lints itself with the Next.js rules.
      'apps/admin/**',
      // Deno, not Node: checked by the Supabase CLI when deployed.
      'supabase/functions/**',
      'tests/e2e/.artifacts/**',
    ],
  },
  {
    // Name this workspace's own projects. Left to search, the import resolver
    // walks up and finds the tsconfig of the repository this folder sits in.
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            'apps/mobile',
            'packages/domain',
            'packages/adapters',
            'packages/api-client',
            'packages/ui',
          ].map((dir) => path.join(__dirname, dir, 'tsconfig.json')),
        },
      },
    },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Node scripts and config files: they print, and they use Node's globals.
    files: ['scripts/**', 'tests/e2e/**', '**/*.config.js', '**/jest.setup.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/jest.setup.js'],
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
      },
    },
  },
]);
