import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const native = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  select: () => {
    if (native) void Haptics.selectionAsync().catch(() => undefined);
  },
  success: () => {
    if (native)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
  },
  warn: () => {
    if (native)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => undefined,
      );
  },
};
