import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import {
  registerForPushNotifications,
  routeForNotification,
  syncPushToken,
  type PushRegistrationOutcome,
} from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';

/**
 * Register for push and keep the token in sync.
 *
 * Only runs once the customer has opted in via Preferences — asking for the OS
 * permission on first launch, before they have any reason to want updates, is
 * the reliable way to get it denied permanently.
 */
export function usePushRegistration() {
  const channelPush = useAuthStore((state) => state.notificationPreferences.channelPush);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [outcome, setOutcome] = useState<PushRegistrationOutcome | null>(null);
  const attempted = useRef(false);

  const registerNow = useCallback(async () => {
    const result = await registerForPushNotifications();
    setOutcome(result);
    if (result.status === 'granted') await syncPushToken(result.token);
    return result;
  }, []);

  useEffect(() => {
    if (!channelPush || !isAuthenticated || attempted.current) return;
    attempted.current = true;
    void registerNow();
  }, [channelPush, isAuthenticated, registerNow]);

  return { outcome, registerNow };
}

/**
 * Route taps and refresh on delivery.
 *
 * A notification arriving usually means server state changed — an order moved
 * on, points landed — so we invalidate the matching queries rather than
 * waiting for the customer to pull to refresh.
 */
export function useNotificationRouting() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;

      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

      if (data?.category === 'order' || typeof data?.orderId === 'string') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
        void queryClient.invalidateQueries({ queryKey: queryKeys.activeOrder });
      }
      if (data?.category === 'reward') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.loyalty });
      }
    });

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        Record<string, unknown> | undefined;
      router.push(routeForNotification(data) as Href);
    });

    return () => {
      received.remove();
      responded.remove();
    };
  }, [router, queryClient]);
}

/**
 * Handle a notification that launched the app from cold.
 *
 * `addNotificationResponseReceivedListener` does not fire for the tap that
 * started the process, so without this a customer tapping "your order is here"
 * on a closed app lands on Home instead of their order.
 */
export function useInitialNotificationRoute() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as
        Record<string, unknown> | undefined;
      router.push(routeForNotification(data) as Href);
    });
  }, [router]);
}
