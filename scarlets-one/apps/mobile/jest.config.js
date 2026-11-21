module.exports = {
  preset: 'jest-expo',
  // Worklets ships a resolver that picks its JavaScript implementation under
  // Jest, where there is no native module to load.
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Expo and React Native ship untranspiled ESM, so these are transformed
  // rather than skipped. The @scarlets/* packages are symlinks to TypeScript
  // source outside node_modules and are transformed by default.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|react-native-svg|standard-navigation|@tanstack/.*|@scarlets/.*)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
};
