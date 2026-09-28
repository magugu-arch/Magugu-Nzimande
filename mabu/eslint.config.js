// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  { ignores: ['dist/*', 'dist-web/*', 'node_modules/*', '.expo/*', 'coverage/*', '.shots/*', 'server/dist/*', 'data/*', 'dist-standalone/*'] },
  { rules: { 'no-console': ['warn', { allow: ['warn', 'error'] }] } },
  { files: ['scripts/**/*.mjs', 'server/src/**/*.ts'], rules: { 'no-console': 'off' } },
  {
    files: ['jest.setup.js', '__tests__/**/*.{ts,tsx,js}'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        require: 'readonly',
      },
    },
  },
]);
