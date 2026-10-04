
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

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: -34.0, longitude: 25.67 } })),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getDefaultCalendarAsync: jest.fn(async () => ({ id: 'default' })),
  getCalendarsAsync: jest.fn(async () => [{ id: 'default', allowsModifications: true }]),
  createEventAsync: jest.fn(async () => 'event-id'),
  EntityTypes: { EVENT: 'event' },
}));

// Icons carry no assertions — accessible names live on the pressables around
// them — and the real component setStates when its font lands, which fires
// act() warnings on every render.
const stubIcon = (family) => {
  const { View } = require('react-native');
  const React = require('react');
  const Icon = ({ name, ...rest }) =>
    React.createElement(View, { ...rest, testID: rest.testID ?? `icon-${family}-${name}` });
  Icon.glyphMap = {};
  return Icon;
};

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: stubIcon('ionicons'),
}));
