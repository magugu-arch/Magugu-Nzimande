import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  isAllowedDeepLink,
  NOTIFICATION_CATEGORY_COPY,
  type NotificationCategory,
} from '@kc-one/contracts';
import {
  BackHeader,
  Button,
  Chips,
  DemoTag,
  EmptyState,
  PressableScale,
  Screen,
  Text,
} from '@/components';
import { capabilities } from '@/config/env';
import { demoNotifications } from '@/data/demo/notifications';
import { usePreferences } from '@/state/preferences';
import { color, radius, space } from '@/theme';

type Filter = 'all' | 'unread' | NotificationCategory;

const INBOX = capabilities.notifications === 'demo' ? demoNotifications : [];

/** Notifications Centre: categories, read/unread state and safe deep links. */
export default function Notifications() {
  const router = useRouter();
  const read = usePreferences((s) => s.readNotificationIds);
  const markRead = usePreferences((s) => s.markRead);
  const markAllRead = usePreferences((s) => s.markAllRead);
  const [filter, setFilter] = useState<Filter>('all');
  const items = INBOX;

  const visible = useMemo(
    () =>
      INBOX.filter((n) =>
        filter === 'all'
          ? true
          : filter === 'unread'
            ? !read.includes(n.id)
            : n.category === filter,
      ),
    [filter, read],
  );

  return (
    <Screen
      topInset={false}
      header={
        <BackHeader
          title="Notifications"
          right={
            <Button
              label="Read all"
              variant="ghost"
              compact
              onPress={() => markAllRead(items.map((n) => n.id))}
            />
          }
        />
      }
    >
      <View style={{ gap: space.lg }}>
        <Chips
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'matchday', label: 'Matchday' },
            { value: 'fan_moments', label: 'Fan' },
          ]}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Filter notifications"
        />
        {visible.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="Nothing here"
            body="Club updates you opt in to will appear here."
          />
        ) : (
          visible.map((n) => {
            const unread = !read.includes(n.id);
            return (
              <PressableScale
                key={n.id}
                pressedScale={0.985}
                accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}
                onPress={() => {
                  markRead(n.id);
                  if (n.deepLink && isAllowedDeepLink(n.deepLink)) router.push(n.deepLink as Href);
                }}
                style={[styles.row, unread && styles.unread]}
              >
                <View style={[styles.dot, { opacity: unread ? 1 : 0 }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                    <Text variant="micro" color="accent">
                      {NOTIFICATION_CATEGORY_COPY[n.category].label}
                    </Text>
                    {n.isDemo ? <DemoTag /> : null}
                  </View>
                  <Text variant="headline">{n.title}</Text>
                  <Text variant="footnote" color="textSecondary">
                    {n.body}
                  </Text>
                </View>
              </PressableScale>
            );
          })
        )}
        <Button
          label="Notification preferences"
          variant="secondary"
          onPress={() => router.push('/settings/notifications')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  unread: { borderColor: color.lineAccent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent, marginTop: 6 },
});
