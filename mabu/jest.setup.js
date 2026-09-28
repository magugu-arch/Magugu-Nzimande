jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const stubIcon = (family) => {
  const { View } = require('react-native');
  const React = require('react');
  const Icon = ({ name, ...rest }) =>
    React.createElement(View, { ...rest, testID: rest.testID ?? `icon-${family}-${name}` });
  Icon.glyphMap = {};
  return Icon;
};
jest.mock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: stubIcon('feather') }));
