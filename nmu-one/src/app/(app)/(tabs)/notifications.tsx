import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import type { AppNotification, NotificationCategory } from '@/core/domain/models';
import { unreadCount } from '@/core/notifications/priority';
import { formatAgo } from '@/core/time/sast';
import { useNotificationsQuery } from '@/data/hooks';
import {
  Button,
  ChipRow,
  Icon,
  Pill,
  QueryState,
  Row,
  Screen,
  StateView,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
  type IconName,
} from '@/design';
import { useNow } from '@/features/system/useNow';
import { useSession } from '@/state/session';

type Filter = 'all' | 'unread' | NotificationCategory;

const ICONS: Record<NotificationCategory, IconName> = {
  safety: 'shield-checkmark',
  academic: 'school',
  money: 'wallet',
  campus: 'business',
  community: 'sparkles',
  alumni: 'people',
  orders: 'bag-check',
};

/**
 * The inbox (brief §11): trusted, actionable communication — every item says
 * who sent it and leads somewhere useful. Not a WhatsApp-style stream.
 */
export default function Notifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const query = useNotificationsQuery();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });

  const open = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await providers.notifications.markRead(n.id);
        refresh();
      } catch {
        // Opening the action matters more than the read receipt.
      }
    }
    if (n.action) router.push(n.action.href as Href);
  };

  const markAll = async () => {
    try {
      await providers.notifications.markAllRead();
    } finally {
      refresh();
    }
  };

  const unread = query.data ? unreadCount(query.data) : 0;

  return (
    <Screen testID="notifications" onRefresh={query.refetch} refreshing={query.isRefreshing && query.status === 'success'}>
      <Row justify="space-between" align="flex-end" style={styles.head}>
        <View>
          <Text variant="overline" color={colors.textSecondary}>
            {unread ? `${unread} unread` : 'All caught up'}
          </Text>
          <Text variant="title1" accessibilityRole="header">
            Notifications
          </Text>
        </View>
        {unread > 0 ? <Button label="Mark all read" variant="ghost" size="md" onPress={markAll} /> : null}
      </Row>

      <ChipRow<Filter>
        value={filter}
        onChange={setFilter}
        testIDPrefix="filter"
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
          { value: 'academic', label: 'Academic' },
          { value: 'money', label: 'Money' },
          { value: 'campus', label: 'Campus' },
          { value: 'orders', label: 'Orders' },
          { value: 'community', label: 'Community' },
          { value: 'alumni', label: 'Alumni' },
        ]}
      />

      <View style={styles.list}>
        <QueryState
          query={query}
          what="your notifications"
          isEmpty={(d) => d.length === 0}
          empty={<StateView kind="empty" title="No notifications" body="When NMU sends you something, it will be here — with a way to act on it." />}
        >
          {(list) => {
            const shown = list.filter((n) =>
              filter === 'all' ? true : filter === 'unread' ? !n.read : n.category === filter,
            );
            if (shown.length === 0) {
              return <StateView kind="empty" title="Nothing in this view" body="Try another filter." />;
            }
            return shown.map((n) => (
              <Touchable
                key={n.id}
                onPress={() => open(n)}
                accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.priority === 'high' || n.priority === 'emergency' ? 'Important. ' : ''}${n.title}. ${n.body}. From ${n.publisher}, ${formatAgo(n.createdAt, now)}.${n.action ? ` ${n.action.label}.` : ''}`}
                style={[styles.item, !n.read ? styles.unread : null]}
                testID={`notification-${n.id}`}
              >
                <View style={[styles.icon, n.priority === 'high' || n.priority === 'emergency' ? styles.iconUrgent : null]}>
                  <Icon name={ICONS[n.category]} size={18} color={colors.navy} />
                </View>
                <View style={styles.body}>
                  <Row justify="space-between" align="flex-start" gap={spacing.sm}>
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {n.title}
                    </Text>
                    {!n.read ? <View style={styles.dot} /> : null}
                  </Row>
                  <Text variant="caption" color={colors.textSecondary}>
                    {n.body}
                  </Text>
                  <Row justify="space-between" style={{ marginTop: spacing.xs }}>
                    <Text variant="caption" color={colors.textSecondary}>
                      {n.publisher} · {formatAgo(n.createdAt, now)}
                    </Text>
                    {n.priority === 'high' || n.priority === 'emergency' ? <Pill label="Important" tone="yellow" /> : null}
                  </Row>
                  {n.action ? (
                    <Text variant="captionStrong" color={colors.navy2} style={{ marginTop: spacing.xs }}>
                      {n.action.label} →
                    </Text>
                  ) : null}
                </View>
              </Touchable>
            ));
          }}
        </QueryState>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: spacing.lg },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  unread: { borderWidth: 1.5, borderColor: colors.navy2 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  iconUrgent: { backgroundColor: colors.yellow },
  body: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.navy2, marginTop: 6 },
});
