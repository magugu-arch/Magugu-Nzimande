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
import { FoodImage } from '@/components/food/FoodImage';
import { isOfflinePending } from '@/features/system/queryPhase';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/account/hooks';
import { AccountRequired, useIsSignedOut } from '@/features/system/AccountRequired';
import { inAppRoute } from '@/utils/linking';
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

  /**
   * Whether a tap on this row would change anything: somewhere to go, or an
   * unread mark to clear. Neither, and the card must not present itself as a
   * control. See the note at the call site.
   */
  const canOpen = (notification: AppNotification) =>
    Boolean(notification.href) || !notification.read;

  const handleOpen = useCallback(
    (notification: AppNotification) => {
      if (!notification.read) markRead.mutate(notification.id);
      // Server data, like the other two. This was the third call site pushing
      // a route somebody else chose, and the one my own sweep missed — I
      // grepped for the field names rather than for the sink.
      if (notification.href) {
        router.push(inAppRoute(notification.href, '/account/notifications') as Href);
      }
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
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              // 75x19. `hitSlop` of 10 reached 39 tall, still short, and 19 on
              // the web build. Padding makes it 45 and the margin gives it back.
              style={{ paddingVertical: 13, marginVertical: -13 }}
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
              /**
               * A button only when a tap can do something.
               *
               * Every row was a pressable card. That is right for the three
               * categories the seed used to carry, because each of them has
               * somewhere to go — but `href` is optional and `system` is a
               * category, and a service advisory has no destination at all.
               * Seeding one showed what that produced: a card drawn as a
               * button, announced to a screen reader as a button, that did
               * nothing whatsoever when a customer tapped it.
               *
               * Marking it read counts as something, so an unread row stays
               * pressable either way. A read one with nowhere to go is a
               * plain card, which is what it always was.
               */
              onPress={canOpen(notification) ? () => handleOpen(notification) : undefined}
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

                {/*
                  The photograph, at the trailing edge, which is where every
                  push notification a customer has ever seen puts it. `thumb`
                  and nothing larger: this is a list, and §15 is explicit that
                  a list must never load a `detail` or `banner` derivative.
                */}
                {notification.assetKey ? (
                  <FoodImage
                    assetKey={notification.assetKey}
                    variant="thumb"
                    rounded="sm"
                    compactPlaceholder
                    style={styles.artwork}
                  />
                ) : null}

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
  artwork: { width: 44, height: 44 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
});
