import { officialLinks } from '@scarlets/adapters';
import type { Locale } from '@scarlets/domain';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { DemoChip } from '@/components/Chips';
import { CheckMark, Toggle } from '@/components/Controls';
import { Page } from '@/components/Page';
import { Press } from '@/components/Press';
import { ListRow, RowGroup } from '@/components/Rows';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Notice } from '@/components/States';
import { Text } from '@/components/Text';
import { useNotificationPreferences } from '@/data/queries';
import { useLocale, useT, welshCoverage, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { openOfficial } from '@/lib/links';
import { useDemo } from '@/state/demo';
import { followable, usePrefs, type ThemePreference } from '@/state/prefs';
import { useSession } from '@/state/session';
import { hitTarget, space } from '@/theme';

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text
        variant="eyebrow"
        color="textSecondary"
        accessibilityRole="header"
        style={{ marginLeft: space.lg }}
      >
        {title}
      </Text>
      {children}
      {note ? (
        <Text variant="footnote" color="textSecondary" style={{ marginHorizontal: space.lg }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function ToggleRow({
  title,
  body,
  value,
  onChange,
  testID,
}: {
  title: string;
  body?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: hitTarget + 12,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline">{title}</Text>
        {body ? (
          <Text variant="footnote" color="textSecondary">
            {body}
          </Text>
        ) : null}
      </View>
      <Toggle testID={testID} value={value} onChange={onChange} label={title} />
    </View>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const router = useRouter();
  const locale = useLocale();
  const prefs = usePrefs();
  const account = useSession((s) => s.account);
  const signOut = useSession((s) => s.signOut);
  const resetDemo = useDemo((s) => s.reset);
  const { query, update } = useNotificationPreferences();
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const notifications = query.data?.data;

  const setLanguage = (next: Locale) => {
    if (next === locale) return;
    haptic.selection();
    prefs.setLocale(next);
    track('language_change', { language: next });
  };

  return (
    <Page testID="screen-settings" title={t('settings.title')} back>
      <View style={{ gap: space.xl }}>
        <Group
          title={t('settings.language')}
          note={t('settings.language.note', { percent: Math.round(welshCoverage.ratio * 100) })}
        >
          <RowGroup>
            {(
              [
                ['en', 'English'],
                ['cy', 'Cymraeg'],
              ] as [Locale, string][]
            ).map(([id, label]) => (
              <Press
                key={id}
                testID={`settings-language-${id}`}
                onPress={() => setLanguage(id)}
                scaleTo={0.985}
                accessibilityRole="radio"
                accessibilityState={{ selected: locale === id }}
                accessibilityLabel={label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: hitTarget + 8,
                  paddingHorizontal: space.lg,
                }}
              >
                <Text variant="headline" style={{ flex: 1 }}>
                  {label}
                </Text>
                <CheckMark checked={locale === id} size={22} />
              </Press>
            ))}
          </RowGroup>
        </Group>

        <Group title={t('settings.appearance')}>
          <Segmented<ThemePreference>
            testID="settings-theme"
            accessibilityLabel={t('settings.appearance')}
            value={prefs.theme}
            onChange={prefs.setTheme}
            options={[
              { id: 'system', label: t('settings.theme.system') },
              { id: 'light', label: t('settings.theme.light') },
              { id: 'dark', label: t('settings.theme.dark') },
            ]}
          />
        </Group>

        <Group title={t('settings.following')} note={t('settings.following.note')}>
          <RowGroup>
            {followable.map((category) => (
              <ToggleRow
                key={category}
                testID={`settings-follow-${category}`}
                title={t(`topic.${category}` as MessageKey)}
                value={prefs.following.includes(category)}
                onChange={() => prefs.toggleFollowing(category)}
              />
            ))}
          </RowGroup>
        </Group>

        <Group title={`${t('settings.notifications')} · ${t('settings.notifications.service')}`}>
          <RowGroup>
            {(['matchAlerts', 'ticketReminders', 'clubNews'] as const).map((key) => (
              <ToggleRow
                key={key}
                testID={`settings-notif-${key}`}
                title={t(`notif.${key}` as MessageKey)}
                body={t(`notif.${key}.body` as MessageKey)}
                value={notifications?.[key] ?? false}
                onChange={(value) => notifications && update({ ...notifications, [key]: value })}
              />
            ))}
          </RowGroup>
        </Group>

        {/* Marketing consent is its own switch, apart from service messages, and starts off. */}
        <Group title={`${t('settings.notifications')} · ${t('settings.notifications.marketing')}`}>
          <RowGroup>
            <ToggleRow
              testID="settings-notif-partnerOffers"
              title={t('notif.partnerOffers')}
              body={t('notif.partnerOffers.body')}
              value={notifications?.partnerOffers ?? false}
              onChange={(value) =>
                notifications && update({ ...notifications, partnerOffers: value })
              }
            />
          </RowGroup>
        </Group>

        <Group title={t('settings.accessibility')}>
          <RowGroup>
            <ToggleRow
              testID="settings-reduce-motion"
              title={t('settings.reduceMotion')}
              body={t('settings.reduceMotion.body')}
              value={prefs.reduceMotion}
              onChange={prefs.setReduceMotion}
            />
          </RowGroup>
        </Group>

        <Group title={t('settings.privacy')} note={t('settings.privacy.body')}>
          <RowGroup>
            <ListRow
              testID="settings-privacy-notice"
              icon="document-lock-outline"
              title={t('settings.privacy.notice')}
              external
              accessibilityHint={t('common.destinationPending')}
              onPress={() => void openOfficial(officialLinks.privacy.url)}
            />
            <ListRow
              testID="settings-delete"
              icon="trash-outline"
              title={t('settings.delete')}
              onPress={() => setDeleting(true)}
            />
          </RowGroup>
          {deleted ? (
            <Notice
              icon="checkmark-circle-outline"
              body={t('settings.delete.sent')}
              testID="delete-sent"
            />
          ) : null}
        </Group>

        <Group title={t('settings.account')}>
          <RowGroup>
            {account === 'guest' ? (
              <ListRow
                testID="settings-sign-in"
                icon="person-circle-outline"
                title={t('common.signIn')}
                onPress={() => router.push('/sign-in')}
              />
            ) : (
              <ListRow
                testID="settings-sign-out"
                icon="log-out-outline"
                title={t('common.signOut')}
                onPress={signOut}
              />
            )}
            <ListRow
              testID="settings-reset"
              icon="refresh-outline"
              title={t('settings.reset')}
              trailing={<DemoChip />}
              onPress={() => {
                signOut();
                resetDemo();
                prefs.reset();
                router.replace('/onboarding');
              }}
            />
          </RowGroup>
        </Group>

        <Group title={t('settings.about')}>
          <Notice icon="flask-outline" body={t('settings.about.body')} />
          <Text variant="caption" color="textSecondary" align="center">
            {t('settings.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
          </Text>
        </Group>
      </View>

      {/* Deleting an account cannot be undone, so this one action asks first. */}
      <Sheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        title={t('settings.delete')}
        testID="delete-sheet"
      >
        <View style={{ gap: space.md }}>
          <Text variant="body">{t('settings.delete.body')}</Text>
          <Button
            testID="delete-confirm"
            label={t('settings.delete.confirm')}
            fill
            onPress={() => {
              track('support_request_submit', { placement: 'account_deletion' });
              setDeleting(false);
              setDeleted(true);
            }}
          />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            fill
            onPress={() => setDeleting(false)}
          />
        </View>
      </Sheet>
    </Page>
  );
}
