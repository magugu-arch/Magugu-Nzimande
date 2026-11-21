// AsyncStorage has no native module under Jest, so the community mock stands in.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Icons load a font asynchronously and set state when it lands, which trips an
// act() warning on every render. Labels live on the pressables around them, so
// a stub is enough. The app imports the Ionicons subpath, and so must the mock.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = ({ name, ...rest }) =>
    React.createElement(View, { ...rest, testID: `icon-${name}` });
  Icon.glyphMap = {};
  return { __esModule: true, default: Icon };
});

require('react-native-gesture-handler/jestSetup');
require('react-native-reanimated').setUpTests();

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Screens are rendered outside a navigator in tests, so the router is a stub
// whose calls can be asserted on.
jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  };
  return {
    __esModule: true,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    Redirect: () => null,
    router,
  };
});

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'opened' })),
}));

// Query results land on a timer. Routing those updates through act() keeps
// React's test warnings for real mistakes.
const { notifyManager } = require('@tanstack/react-query');
const { act } = require('@testing-library/react-native');
notifyManager.setNotifyFunction((fn) => {
  act(fn);
});
