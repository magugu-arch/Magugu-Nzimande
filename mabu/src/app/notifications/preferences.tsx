import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  Card,
  Chip,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
  ToggleRow,
} from '@/components/ui';
import {
  TRANSACTIONAL_CATEGORIES,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreference,
} from '@/domain/notifications/types';
import { formatDateWithYear } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';
import { track } from '@/utils/analytics';

const CATEGORY: Record<NotificationCategory, { label: string; body: string }> = {
  booking: {
    label: 'Booking & service updates',
    body: 'Confirmations, reminders, changes and waitlist alerts.',
  },
  service: { label: 'Restaurant notices', body: 'Temporary closures or important changes.' },
  event: { label: 'Event reminders', body: 'Your event bookings and schedule updates.' },
  rewards: {
    label: 'Rewards & loyalty',
    body: 'Points earned, new tiers, rewards and expiry reminders.',
  },
  voucher: { label: 'Vouchers', body: 'Purchases, delivery, redemption and expiry.' },
  marketing: {
    label: 'News & promotions',
    body: 'New menus, events and experiences — only with your consent.',
  },
};

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  push: 'Push',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  'in-app': 'In app',
};

const QUIET = [
  { label: 'Off', value: null },
  { label: '22:00 – 07:00', value: { start: '22:00', end: '07:00' } },
  { label: '21:00 – 08:00', value: { start: '21:00', end: '08:00' } },
  { label: '23:00 – 09:00', value: { start: '23:00', end: '09:00' } },
];

/** §39 Notification preference centre. */
export default function Preferences() {
  const q = useRpc('notifications.prefs');
  const update = useRpcMutation('notifications.updatePref', ['notifications.prefs']);
  const quiet = useRpcMutation('notifications.setQuietHours', ['notifications.prefs']);
  const [osGranted, setOsGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void Notifications.getPermissionsAsync().then((p) => setOsGranted(p.granted));
  }, []);

  if (!q.data)
    return (
      <Screen header={<Header title="Preferences" />}>
        <LoadingBlock />
      </Screen>
    );
  const { preferences, consent, channels } = q.data;
  const currentQuiet = preferences[0]?.quietHours;

  const set = (pref: NotificationPreference, patch: Partial<NotificationPreference>) =>
    update.mutate({ ...pref, ...patch });

  return (
    <Screen header={<Header title="Notification preferences" />}>
      {osGranted === false ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <Text variant="body">
            Allow notifications so we can confirm and remind you of your bookings.
          </Text>
          <PremiumButton
            label="Allow notifications"
            variant="secondary"
            onPress={async () => {
              track('notification_permission_requested');
              const r = await Notifications.requestPermissionsAsync();
              setOsGranted(r.granted);
            }}
          />
        </Card>
      ) : null}

      {preferences.map((pref) => {
        const meta = CATEGORY[pref.category];
        const locked = TRANSACTIONAL_CATEGORIES.includes(pref.category);
        return (
          <View key={pref.category} style={{ marginTop: spacing.xl }}>
            <ToggleRow
              label={meta.label}
              description={
                locked
                  ? `${meta.body} Always on — these are about bookings you have made.`
                  : meta.body
              }
              value={pref.enabled}
              disabled={locked}
              onChange={(enabled) => set(pref, { enabled })}
            />
            {pref.enabled ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {channels.map((c) => {
                  const on = pref.channels.includes(c);
                  const fixed = c === 'in-app' && locked;
                  return (
                    <Chip
                      key={c}
                      label={CHANNEL_LABEL[c]}
                      selected={on}
                      disabled={fixed}
                      onPress={() =>
                        set(pref, {
                          channels: on
                            ? pref.channels.filter((x) => x !== c)
                            : [...pref.channels, c],
                        })
                      }
                    />
                  );
                })}
              </View>
            ) : null}
            {pref.category === 'marketing' ? (
              <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.sm }}>
                {consent?.marketing
                  ? `Consent given ${formatDateWithYear(consent.updatedAt)} (${consent.source.replace('app:', 'in app, ')}). Switch off at any time.`
                  : 'You have not opted in to news and promotions.'}{' '}
                <Text
                  variant="caption"
                  color="accent"
                  accessibilityRole="link"
                  onPress={() => router.push('/legal/marketing')}
                >
                  What this means
                </Text>
              </Text>
            ) : null}
          </View>
        );
      })}

      <SectionTitle eyebrow="Quiet hours" title="Do not disturb" />
      <Text variant="bodySmall" color="textMuted" style={{ marginBottom: spacing.md }}>
        Push messages wait until quiet hours end. An urgent table offer from the waitlist still
        comes through.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {QUIET.map((o) => (
          <Chip
            key={o.label}
            label={o.label}
            selected={
              (!o.value && !currentQuiet) ||
              (!!o.value &&
                currentQuiet?.start === o.value.start &&
                currentQuiet.end === o.value.end)
            }
            onPress={() => quiet.mutate({ quietHours: o.value })}
          />
        ))}
      </View>
      {update.isError || quiet.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.lg }}>
          {errorMessage(update.error ?? quiet.error)}
        </InlineNotice>
      ) : null}
    </Screen>
  );
}
