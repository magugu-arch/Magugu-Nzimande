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
  // Scarlets One is a separate workspace with its own test runners. Without
  // these, Jest crawls its node_modules and tries to run its Vitest suites.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/scarlets-one/'],
  modulePathIgnorePatterns: ['<rootDir>/scarlets-one/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
