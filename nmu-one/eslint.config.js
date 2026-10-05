// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // Generated output and the admin console (which lints itself with Next's config).
    ignores: [
      'dist/*',
      'dist-web/**',
      'dist-live/**',
      'dist-single/**',
      'bff/dist/**',
      'node_modules/*',
      '.expo/*',
      'coverage/*',
      '.e2e/**',
      'admin/**',
      'src/content/photoFiles.generated.ts',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'warn',
      // Keep application code on Expo Router's own entry points (SDK 56+).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@react-navigation/*'],
              message: 'Import from expo-router or expo-router/react-navigation instead (SDK 56+).',
            },
          ],
        },
      ],
    },
  },
  {
    // Command-line tools and the reference server print by design.
    files: ['scripts/**/*.mjs', 'e2e/**/*.mjs', 'bff/src/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
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
