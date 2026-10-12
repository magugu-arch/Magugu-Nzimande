// AsyncStorage has no native module under Jest; use the package's own mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated runs worklets on a native UI runtime; under Jest both libraries
// ship their own mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // The mock omits a few hooks the app uses; give them their resting values.
  return {
    ...mock,
    useReducedMotion: mock.useReducedMotion ?? (() => false),
    ReduceMotion: mock.ReduceMotion ?? { System: 'system', Always: 'always', Never: 'never' },
  };
});

// Icon fonts load asynchronously and update state outside act(); a plain host
// component keeps test output about the app, not the font loader.
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
