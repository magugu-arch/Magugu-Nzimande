// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // .audit-* are generated web bundles, not source.
    //
    // apps/web is the ordering website: a Next.js project with its own flat
    // config, its own aliases and its own `npm run lint`. This config is
    // eslint-config-expo, which cannot resolve `@/lib/*` or `@bbq/*` and reports
    // several thousand phantom errors if pointed at it. Same boundary as
    // tsconfig's `exclude` and jest's ignore patterns: the two projects share a
    // repository, not a toolchain.
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'coverage/*', '.audit-*/**', 'apps/**'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Build and audit scripts are CLI tools — their whole job is to print.
    // They also read JSON through import attributes (`with { type: 'json' }`),
    // which the default ecmaVersion is too old to parse.
    files: ['scripts/**/*.{mjs,js}', 'infra/**/*.{mjs,js}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Jest globals for the setup file and test suites.
    files: ['jest.setup.js', '__tests__/**/*.{ts,tsx,js,jsx}'],
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
