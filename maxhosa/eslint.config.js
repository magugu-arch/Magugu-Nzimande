// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // Generated output and the offline demo's browser sources (classic
    // scripts that share one closure when built — not modules).
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      '.web-preview/**',
      '.offline-demo-shots/**',
      'deliverables/**',
      'demo/**',
      'coverage/*',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly' } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['jest.setup.js', '__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly' },
    },
  },
]);
