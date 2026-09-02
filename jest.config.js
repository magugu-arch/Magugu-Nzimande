module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
  },
  // Several Expo/RN packages ship untranspiled ESM and must be transformed
  // rather than skipped — standard-navigation (pulled in by expo-router) among them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|standard-navigation|@tanstack/.*)',
  ],
  // The website in apps/web is a separate deliverable with its own runner:
  // its tests are Vitest, and Jest picking them up out of the repository root
  // fails five suites on imports that only Vitest resolves. It has its own
  // `npm run verify`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/apps/'],
  modulePathIgnorePatterns: ['<rootDir>/apps/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
