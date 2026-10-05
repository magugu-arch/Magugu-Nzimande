module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // NMU ONE (nmu-one/) is a separate project with its own tests and CI.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/nmu-one/'],
  modulePathIgnorePatterns: ['<rootDir>/nmu-one/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',
  },
  // Several Expo/RN packages ship untranspiled ESM and must be transformed
  // rather than skipped — standard-navigation (pulled in by expo-router) among them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|standard-navigation|@tanstack/.*)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
