import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import type { AppNotification } from '@/core/domain/models';
import { suppressedByQuietHours } from '@/core/notifications/priority';
import { clock } from '@/core/time/clock';
import { sastParts } from '@/core/time/sast';
import { prefsFor } from '@/state/preferences';
import { useNotificationsQuery } from '@/data/hooks';
import { useSession } from '@/state/session';
import { showToast } from '@/state/toasts';

/**
 * Push presentation for notifications that arrive while NMU ONE is open:
 * the OS banner is suppressed and the in-app banner shows instead, so a
 * notification never appears twice.
 */
export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Whether a notification should interrupt (banner) or wait quietly in the inbox. */
export function shouldInterrupt(n: AppNotification, userId: string): boolean {
  const prefs = prefsFor(userId).notifications;
  if (n.priority !== 'emergency' && prefs.muted.includes(n.category)) return false;
  const p = sastParts(clock.now());
  return !suppressedByQuietHours(n.priority, p.hours * 60 + p.minutes, prefs.quietHours);
}

/**
 * Mounted once in the signed-in shell. New notifications refresh the inbox
 * and, unless muted or in quiet hours, show an in-app banner that deep-links
 * to the action (brief §5 "notifications deep-link into useful actions").
 */
export function useNotificationDelivery() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = useSession((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    return providers.notifications.subscribe((n) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      // An order turning "ready" also changes the order screen.
      if (n.category === 'orders')
        void queryClient.invalidateQueries({ queryKey: ['order', userId] });
      if (!shouldInterrupt(n, userId)) return;
      showToast({
        id: n.id,
        title: n.title,
        body: n.body,
        href: n.action?.href,
        actionLabel: n.action?.label,
        tone: n.priority === 'emergency' || n.priority === 'high' ? 'urgent' : 'info',
      });
    });
  }, [queryClient, userId]);

  // A tap on an OS notification (live push) opens its action.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const href = response.notification.request.content.data?.href;
      if (typeof href === 'string' && href.startsWith('/')) router.push(href as Href);
    });
    return () => sub.remove();
  }, [router]);
}

/**
 * Visiting the place a notification points to settles it: once someone has
 * opened their funding status, their ready order or the mentoring request,
 * the notice stops asking for attention on Home and in the inbox.
 */
export function useSettleNotificationsOnVisit() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const notifications = useNotificationsQuery();
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!userId || !notifications.data) return;
    const current = JSON.parse(paramsKey) as Record<string, string | string[]>;
    const due = notifications.data.filter(
      (n) => n.action && !n.read && visits(n.action.href, pathname, current),
    );
    if (!due.length) return;
    void Promise.allSettled(due.map((n) => providers.notifications.markRead(n.id))).then(() =>
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
    );
  }, [pathname, paramsKey, notifications.data, userId, queryClient]);
}

/** Whether the current route is the notification's destination, query included. */
export function visits(
  href: string,
  pathname: string,
  params: Record<string, string | string[]>,
): boolean {
  const [path, query] = href.split('?');
  if (path !== pathname) return false;
  if (!query) return true;
  return [...new URLSearchParams(query).entries()].every(([k, v]) => String(params[k] ?? '') === v);
}
