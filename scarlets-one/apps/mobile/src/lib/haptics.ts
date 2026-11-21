import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are reserved for moments that mean something: a commit, a snap, a
 * success, an error. Each call fires on the event that caused it, in the same
 * frame as the visual change. Nothing on the web: the Vibration API is coarse
 * and a buzz on every tap would teach people to ignore all of it.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
const run = (fn: () => Promise<unknown>) => {
  if (enabled) fn().catch(() => undefined);
};

export const haptic = {
  /** A value changed: a segment, a stepper, a tab. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Something landed: a sheet snapping to rest. */
  snap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A submission went through. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A submission was refused. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
