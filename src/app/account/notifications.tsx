import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import type { AppNotification } from '@/types';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { isOfflinePending } from '@/features/system/queryPhase';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/account/hooks';
import { AccountRequired, useIsSignedOut } from '@/features/system/AccountRequired';
import { colors, radius, spacing } from '@/theme';
import { formatDateTime } from '@/utils/datetime';

const CATEGORY_ICONS: Record<AppNotification['category'], keyof typeof Ionicons.glyphMap> = {
  order: 'receipt-outline',
  promotion: 'pricetag-outline',
  reward: 'gift-outline',
  system: 'information-circle-outline',
};

/** Notifications (brief §4). */
export default function NotificationsScreen() {
  const signedOut = useIsSignedOut();
  const router = useRouter();

  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleOpen = useCallback(
    (notification: AppNotification) => {
      if (!notification.read) markRead.mutate(notification.id);
      if (notification.href) router.push(notification.href as Href);
    },
    [markRead, router],
  );

  // The app offers "Continue as guest" and then brought them here, to a screen
  // made entirely of account data. Only Profile ever checked.
  if (signedOut) {
    return (
      <AccountRequired
        title="Notifications"
        message="Sign in to get order updates and to hear about offers first."
        icon="notifications-outline"
        testID="notifications-signed-out"
      />
    );
  }

  if (notifications.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Notifications" />
        <LoadingState />
      </Screen>
    );
  }

  // Offline is not empty and not broken. Without this the screen falls

  // through to a factual claim it cannot back up.

  if (isOfflinePending(notifications)) {
    return <OfflineState onRetry={() => void notifications.refetch()} />;
  }

  if (notifications.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Notifications" />
        <ErrorState onRetry={() => void notifications.refetch()} />
      </Screen>
    );
  }

  const list = notifications.data ?? [];
  const unreadCount = list.filter((item) => !item.read).length;

  return (
    <Screen scroll edges={['top', 'bottom']} testID="notifications-screen">
      <ScreenHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Text variant="caption" color={colors.primary}>
                Mark all read
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="Nothing here yet"
          message="Order updates, offers and reward news will show up here."
        />
      ) : (
        <View style={styles.list}>
          {list.map((notification) => (
            <Card
              key={notification.id}
              onPress={() => handleOpen(notification)}
              style={notification.read ? styles.readCard : styles.unreadCard}
              accessibilityLabel={`${notification.title}. ${notification.body}`}
              testID={`notification-${notification.id}`}
            >
              <View style={styles.row}>
                <View style={[styles.icon, notification.read ? styles.iconRead : null]}>
                  <Ionicons
                    name={CATEGORY_ICONS[notification.category]}
                    size={18}
                    color={notification.read ? colors.textMuted : colors.primary}
                  />
                </View>

                <View style={styles.body}>
                  <Text
                    variant={notification.read ? 'bodyMedium' : 'h3'}
                    color={notification.read ? colors.textSecondary : colors.textPrimary}
                  >
                    {notification.title}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {notification.body}
                  </Text>
                  <Text variant="micro" color={colors.textMuted}>
                    {formatDateTime(notification.receivedAt)}
                  </Text>
                </View>

                {!notification.read ? <View style={styles.unreadDot} /> : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  unreadCard: { borderColor: colors.primaryPressed, borderLeftWidth: 3 },
  readCard: { backgroundColor: colors.backgroundAlt },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  iconRead: { backgroundColor: colors.surfaceAlt },
  body: { flex: 1, gap: spacing.xxs },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
});
