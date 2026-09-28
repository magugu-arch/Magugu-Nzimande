import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { config } from '@/services/config';
import { rpc } from '@/services/api';
import { useSession } from '@/store/session';

/**
 * §37: once a signed-in guest has allowed notifications, tell the server
 * which device to push to. Against the in-app mock there is no server to
 * tell (mock pushes are shown locally), and Expo push needs the EAS project
 * id, so without one this quietly does nothing.
 */
export function usePushRegistration() {
  const actorId = useSession((s) => s.actor?.id);
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (config.useMockApi || Platform.OS === 'web' || !actorId) return;
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const attempt = async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      const key = `${actorId}:${token}`;
      if (registered.current === key) return;
      await rpc('devices.register', {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      });
      registered.current = key;
    };
    void attempt().catch(() => undefined);
    // Permission is often granted later, from Notification preferences.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void attempt().catch(() => undefined);
    });
    return () => sub.remove();
  }, [actorId]);
}
