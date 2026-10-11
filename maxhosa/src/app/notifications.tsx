import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/Button';
import { Group, GroupTitle, Row } from '@/components/List';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { NotificationPreference } from '@/domain/types';
import { NOTIFICATION_KINDS, usePrefs } from '@/store/prefs';

type Key = NotificationPreference['key'];

const ROWS: { key: Key; title: string; icon: keyof typeof Ionicons.glyphMap; why: string }[] = [
  {
    key: 'orders',
    title: 'Order and delivery updates',
    icon: 'car-outline',
    why: 'Confirmations, shipping and delivery problems for orders you place.',
  },
  {
    key: 'restock',
    title: 'Restock alerts',
    icon: 'notifications-outline',
    why: 'Only for the pieces and sizes you ask about.',
  },
  {
    key: 'collections',
    title: 'Collection announcements',
    icon: 'sparkles-outline',
    why: 'New collections and events. Only with your consent; unsubscribe any time.',
  },
];

const KIND_LABEL = {
  transactional: 'Transactional',
  requested: 'You request these',
  marketing: 'Marketing',
} as const;

/**
 * Everything is off until switched on, and switching on first explains what
 * it is for — the system permission prompt would follow only that yes.
 * Marketing consent is recorded on its own, never implied by order updates.
 */
export default function Notifications() {
  const { colors } = useTheme();
  const prefs = usePrefs((s) => s.notifications);
  const set = usePrefs((s) => s.setNotification);
  const [explaining, setExplaining] = useState<Key | null>(null);
  const row = ROWS.find((r) => r.key === explaining);

  return (
    <Screen title="Notifications">
      <GroupTitle>Choose what you hear about</GroupTitle>
      <Group>
        {ROWS.map((r, i) => (
          <Row
            key={r.key}
            first={i === 0}
            icon={r.icon}
            title={r.title}
            subtitle={`${KIND_LABEL[NOTIFICATION_KINDS[r.key]]} · ${r.why}`}
            end={
              <Switch
                value={prefs[r.key].enabled}
                onValueChange={(on) => (on ? setExplaining(r.key) : set(r.key, false))}
                trackColor={{ true: colors.green, false: colors.hairlineStrong }}
                accessibilityLabel={r.title}
              />
            }
          />
        ))}
      </Group>

      {row ? (
        <View
          style={[styles.explain, { backgroundColor: colors.card, borderColor: colors.hairline }]}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name={row.icon} size={22} color={colors.ink} />
          <Text variant="headline">{row.title}</Text>
          <Text variant="subhead" color="ink2">
            {row.why}
          </Text>
          {NOTIFICATION_KINDS[row.key] === 'marketing' ? (
            <Text variant="subhead" color="ink2">
              This is marketing. It is only sent because you said yes, and every message lets you
              unsubscribe.
            </Text>
          ) : null}
          <Text variant="footnote" color="ink3">
            In the app, your phone would now ask permission to send notifications. This demo asks
            for nothing.
          </Text>
          <View style={styles.buttons}>
            <Button label="Not now" variant="secondary" onPress={() => setExplaining(null)} />
            <Button
              label="Turn on"
              style={{ flex: 1 }}
              onPress={() => {
                set(row.key, true);
                setExplaining(null);
                toast({
                  message: `${row.title} on (demo)`,
                  icon: 'notifications-outline',
                  offset: 'none',
                });
              }}
            />
          </View>
        </View>
      ) : null}

      <Text variant="footnote" color="ink3" style={styles.note}>
        Previews never show your address, what you ordered or payment details. Demo: switches are
        stored on this device; no permission is requested and nothing is sent.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  explain: {
    margin: space.gutter,
    padding: space.l,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.s,
  },
  buttons: { flexDirection: 'row', gap: space.s, marginTop: space.s },
  note: { paddingHorizontal: space.gutter + 4, paddingTop: space.m },
});
