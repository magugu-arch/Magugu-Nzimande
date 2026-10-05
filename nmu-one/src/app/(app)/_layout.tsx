import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { colors, useReduceMotion } from '@/design';
import { RouteGuard } from '@/features/access/access';
import {
  useNotificationDelivery,
  useSettleNotificationsOnVisit,
} from '@/features/notifications/delivery';
import { usePushRegistration } from '@/features/notifications/push';
import { useSession } from '@/state/session';

/**
 * The signed-in experience. Every screen passes through RouteGuard, which
 * checks the route's capability against the central policy before it renders.
 */
export default function AppLayout() {
  const reduceMotion = useReduceMotion();
  const role = useSession((s) => s.role);
  const queryClient = useQueryClient();
  useNotificationDelivery();
  usePushRegistration();
  useSettleNotificationsOnVisit();
  useSessionExpiry();

  // A role change (graduation, or switching roles) reshapes every screen.
  useEffect(() => {
    void queryClient.invalidateQueries();
  }, [role, queryClient]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reduceMotion ? 'fade' : 'default',
      }}
      screenLayout={({ route, children }) => (
        <RouteGuard routeName={route.name}>{children}</RouteGuard>
      )}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="search"
        options={{ animation: reduceMotion ? 'fade' : 'slide_from_bottom' }}
      />
      <Stack.Screen name="graduation" options={{ animation: 'fade' }} />
    </Stack>
  );
}

/** Checks the session on resume and once a minute (brief §24 "session expiry"). */
function useSessionExpiry() {
  const checkExpiry = useSession((s) => s.checkExpiry);
  useEffect(() => {
    checkExpiry();
    const timer = setInterval(checkExpiry, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkExpiry();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [checkExpiry]);
}
