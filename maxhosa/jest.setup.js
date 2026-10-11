// AsyncStorage has no native module under Jest; use the package's own mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated runs worklets on a native UI runtime; under Jest both libraries
// ship their own mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Icon fonts load asynchronously and update state outside act(); a plain host
// component keeps test output about the app, not the font loader.
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
