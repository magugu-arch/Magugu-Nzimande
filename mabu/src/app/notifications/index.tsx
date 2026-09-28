import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  LoadingBlock,
  PremiumButton,
  Screen,
  Text,
} from '@/components/ui';
import type { NotificationCategory } from '@/domain/notifications/types';
import { formatDateShort, formatTime } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { colors, spacing } from '@/theme';

const ICON: Record<NotificationCategory, keyof typeof Feather.glyphMap> = {
  booking: 'calendar',
  event: 'star',
  rewards: 'award',
  voucher: 'gift',
  service: 'info',
  marketing: 'feather',
};

/** §38 In-app notification centre — the guest's persistent history. */
export default function NotificationCentre() {
  const q = useRpc('notifications.inbox');
  const read = useRpcMutation('notifications.markRead', ['notifications.inbox']);
  const readAll = useRpcMutation('notifications.markAllRead', ['notifications.inbox']);

  return (
    <Screen
      meta={{ title: 'Notifications', noindex: true }}
      header={
        <Header
          title="Notifications"
          right={
            <IconButton
              icon="sliders"
              label="Notification preferences"
              onPress={() => router.push('/notifications/preferences')}
            />
          }
        />
      }
    >
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      ) : q.data.items.length ? (
        <>
          {q.data.unread ? (
            <PremiumButton
              label="Mark all as read"
              variant="ghost"
              compact
              style={{ alignSelf: 'flex-end' }}
              onPress={() => readAll.mutate(undefined)}
            />
          ) : null}
          {q.data.items.map((i) => (
            <Pressable
              key={i.id}
              onPress={() => {
                if (!i.readAt) read.mutate({ id: i.id });
                if (i.deepLink) router.push(i.deepLink as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${i.readAt ? '' : 'Unread. '}${i.title}. ${i.body}`}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <View style={[styles.icon, !i.readAt && styles.iconUnread]}>
                <Feather
                  name={ICON[i.category]}
                  size={16}
                  color={i.readAt ? colors.textMuted : colors.textOnAccent}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" color={i.readAt ? 'textMuted' : 'text'}>
                  {i.title}
                </Text>
                <Text variant="bodySmall" color="textMuted">
                  {i.body}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {formatDateShort(i.createdAt)} · {formatTime(i.createdAt)}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : (
        <EmptyState
          icon="bell"
          title="All quiet"
          body="Booking confirmations, reminders and rewards will appear here."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconUnread: { backgroundColor: colors.accent, borderColor: colors.accent },
});
