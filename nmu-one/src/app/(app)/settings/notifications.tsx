import { Platform, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NotificationCategory } from '@/core/domain/models';
import {
  Button,
  Card,
  Divider,
  Header,
  Notice,
  Screen,
  SectionHeader,
  Text,
  Toggle,
  colors,
  spacing,
} from '@/design';
import { preferences, usePrefs } from '@/state/preferences';
import { useGovernance } from '@/state/governance';
import { useSession } from '@/state/session';
import { showToast } from '@/state/toasts';

const CATEGORIES: { id: NotificationCategory; label: string; description: string }[] = [
  { id: 'academic', label: 'Academic', description: 'Room changes, assessments, results' },
  { id: 'money', label: 'Money', description: 'Fees, funding and payments' },
  { id: 'campus', label: 'Campus', description: 'Shuttle, services and facilities' },
  { id: 'orders', label: 'Orders', description: 'When your food is ready' },
  { id: 'community', label: 'Community', description: 'Events and societies' },
  { id: 'alumni', label: 'Alumni', description: 'Mentoring and giving' },
];

const fmt = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Notification preferences (brief §11): categories and quiet hours. Safety
 * and emergency notices cannot be muted and ignore quiet hours.
 */
export default function NotificationSettings() {
  const user = useSession((s) => s.user);
  const prefs = usePrefs(user?.id);
  const recordConsent = useGovernance((s) => s.recordConsent);
  const n = prefs.notifications;
  if (!user) return null;

  const set = (next: typeof n) => preferences.setNotificationPrefs(user.id, next);

  const allowPush = async () => {
    if (Platform.OS === 'web') {
      showToast({ title: 'Push notifications are available in the phone app', tone: 'info' });
      return;
    }
    const { granted } = await Notifications.requestPermissionsAsync();
    recordConsent('push-notifications', granted);
    showToast({
      title: granted ? 'Push notifications on' : 'Push notifications stay off',
      tone: 'info',
    });
  };

  return (
    <Screen
      header={
        <Header
          title="Notifications"
          largeTitle="Notifications"
          eyebrow="Settings"
          fallbackHref="/profile"
        />
      }
      testID="notification-settings"
    >
      <Notice
        tone="info"
        icon="shield-checkmark-outline"
        title="Safety alerts always come through"
        body="Emergency and campus safety notices can’t be muted and ignore quiet hours."
      />

      <View style={styles.section}>
        <SectionHeader title="Categories" />
        <Card>
          {CATEGORIES.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <Toggle
                label={c.label}
                description={c.description}
                value={!n.muted.includes(c.id)}
                onChange={(on) =>
                  set({ ...n, muted: on ? n.muted.filter((m) => m !== c.id) : [...n.muted, c.id] })
                }
              />
            </View>
          ))}
        </Card>
        <Text variant="caption" color={colors.textSecondary}>
          Muted categories still arrive in your inbox — they just don’t interrupt you.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Quiet hours" />
        <Card>
          <Toggle
            label={`Quiet from ${fmt(n.quietHours.start)} to ${fmt(n.quietHours.end)}`}
            description="Non-urgent notifications wait until morning"
            value={n.quietHours.enabled}
            onChange={(on) => set({ ...n, quietHours: { ...n.quietHours, enabled: on } })}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Button
          label="Allow push notifications"
          icon="notifications-outline"
          variant="secondary"
          fullWidth
          onPress={allowPush}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, gap: spacing.sm },
});
