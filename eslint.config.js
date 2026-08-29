// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    /**
     * Generated web bundles and their captures, not source. Every one of these
     * is a directory some script writes and `.gitignore` drops; keep the two
     * lists in step, or `npm run verify` starts linting a 3 MB Metro bundle and
     * reports thousands of failures in code nobody wrote. `.preview-web` is
     * exactly how that happened.
     */
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'coverage/*',
      '.audit-*/**',
      '.preview-web/**',
      '.preview-shots/**',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Build and audit scripts are CLI tools — their whole job is to print.
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
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
