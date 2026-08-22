/* eslint-env jest */

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

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
    isAvailableAsync: jest.fn(async () => true),
  };
});

// @expo/vector-icons loads its font asynchronously and setStates when it lands,
// which fires an act() warning on every render. Icons carry no assertions here —
// accessibility labels live on the pressables around them — so render a stub.
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  const React = require('react');
  const makeIcon = (family) => {
    const Icon = ({ name, ...rest }) =>
      React.createElement(View, { ...rest, testID: rest.testID ?? `icon-${family}-${name}` });
    Icon.glyphMap = {};
    return Icon;
  };
  return {
    Ionicons: makeIcon('ionicons'),
    MaterialIcons: makeIcon('material'),
    MaterialCommunityIcons: makeIcon('material-community'),
    FontAwesome: makeIcon('fontawesome'),
    Feather: makeIcon('feather'),
    AntDesign: makeIcon('antdesign'),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: -26.2041, longitude: 28.0473 },
  })),
  Accuracy: { Balanced: 3 },
}));
