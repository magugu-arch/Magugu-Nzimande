import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { providers } from '@/core/adapters/registry';
import { config } from '@/core/config';
import { useSession } from '@/state/session';

/**
 * Push for live builds on iOS and Android (brief §5). Once the person has
 * allowed notifications, the device's Expo push token is registered with the
 * BFF: at sign-in, and again when they turn push on in Settings. Asking for
 * permission stays their choice in Settings; signing in never prompts. While
 * the app is open the live client also checks the inbox itself, so anyone
 * who keeps push off still sees new notices.
 */
export async function registerPushDevice(): Promise<boolean> {
  if (config.dataMode !== 'live') return false;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return false;
    const { data } = await Notifications.getExpoPushTokenAsync();
    await providers.notifications.registerDevice({ token: data, platform: Platform.OS });
    return true;
  } catch {
    // Offline, or a build without push credentials yet: try again next sign-in.
    return false;
  }
}

/** Mounted in the signed-in shell: registers once per person per launch. */
export function usePushRegistration() {
  const userId = useSession((s) => s.user?.id);
  useEffect(() => {
    if (userId) void registerPushDevice();
  }, [userId]);
}
