import { integrationGates, scenarioIds, scenarios, type DemoControls } from '@scarlets/adapters';
import { formatVenueTime } from '@scarlets/domain';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Chips';
import { CheckMark, Toggle } from '@/components/Controls';
import { Page } from '@/components/Page';
import { Press } from '@/components/Press';
import { RowGroup } from '@/components/Rows';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useNow } from '@/data/queries';
import { useL, useLocale, useT, type MessageKey } from '@/i18n';
import { useAnalyticsLog } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useDemo } from '@/state/demo';
import { useSession, type DemoAccount } from '@/state/session';
import { hitTarget, space } from '@/theme';

/**
 * Demo controls. Everything in this build is labelled demo data; this screen
 * moves it through a matchday and breaks each provider in turn, to show how
 * the app behaves when the real ones run late, go down or lose the network.
 */
export default function DemoScreen() {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const demo = useDemo();
  const now = useNow(1000);
  const account = useSession((s) => s.account);
  const signIn = useSession((s) => s.signIn);
  const signOut = useSession((s) => s.signOut);
  const events = useAnalyticsLog((s) => s.events);
  const clock = formatVenueTime(now.toISOString(), 'Europe/London', locale);

  const health = <K extends 'liveFeed' | 'ticketing' | 'rewards' | 'network'>(
    key: K,
    label: MessageKey,
    options: readonly { id: DemoControls[K]; label: MessageKey }[],
  ) => (
    <View style={{ gap: space.xs }}>
      <Text variant="footnote" color="textSecondary" style={{ fontWeight: '600' }}>
        {t(label)}
      </Text>
      <Segmented
        testID={`demo-${key}`}
        accessibilityLabel={t(label)}
        value={demo[key] as string}
        onChange={(value) => demo.set({ [key]: value } as Partial<DemoControls>)}
        options={options.map((o) => ({ id: o.id as string, label: t(o.label) }))}
      />
    </View>
  );

  return (
    <Page testID="screen-demo" title={t('demo.title')} back>
      <View style={{ gap: space.xl }}>
        <Text variant="body" color="textSecondary">
          {t('demo.intro')}
        </Text>

        <View style={{ gap: space.sm }}>
          <Text
            variant="eyebrow"
            color="textSecondary"
            accessibilityRole="header"
            style={{ marginLeft: space.lg }}
          >
            {t('demo.scenario')}
          </Text>
          <RowGroup>
            {scenarioIds.map((id) => {
              const selected = demo.scenario === id;
              return (
                <Press
                  key={id}
                  testID={`scenario-${id}`}
                  onPress={() => {
                    haptic.selection();
                    demo.setScenario(id);
                  }}
                  scaleTo={0.985}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${l(scenarios[id].label)}. ${l(scenarios[id].description)}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    minHeight: hitTarget + 14,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.sm,
                  }}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="headline">{l(scenarios[id].label)}</Text>
                    <Text variant="footnote" color="textSecondary">
                      {l(scenarios[id].description)}
                    </Text>
                  </View>
                  <CheckMark checked={selected} size={22} />
                </Press>
              );
            })}
          </RowGroup>
          <Text
            variant="footnote"
            color="textSecondary"
            numeric
            style={{ marginLeft: space.lg }}
            testID="demo-clock"
          >
            {t('demo.clock')}: {clock.longDate}, {clock.time} {clock.zone}
          </Text>
        </View>

        <Card style={{ gap: space.md }}>
          <Text variant="title3" accessibilityRole="header">
            {t('demo.providers')}
          </Text>
          {health('liveFeed', 'demo.liveFeed', [
            { id: 'ok', label: 'demo.ok' },
            { id: 'delayed', label: 'demo.delayed' },
            { id: 'down', label: 'demo.down' },
          ])}
          {health('ticketing', 'demo.ticketing', [
            { id: 'ok', label: 'demo.ok' },
            { id: 'down', label: 'demo.down' },
          ])}
          {health('rewards', 'demo.rewards', [
            { id: 'ok', label: 'demo.ok' },
            { id: 'down', label: 'demo.down' },
          ])}
          {health('network', 'demo.network', [
            { id: 'online', label: 'demo.online' },
            { id: 'offline', label: 'demo.offline' },
          ])}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{t('demo.slow')}</Text>
              <Text variant="footnote" color="textSecondary">
                {t('demo.slow.body')}
              </Text>
            </View>
            <Toggle
              testID="demo-slow"
              value={demo.latencyMs > 0}
              onChange={(on) => demo.set({ latencyMs: on ? 1200 : 0 })}
              label={t('demo.slow')}
            />
          </View>
        </Card>

        <View style={{ gap: space.sm }}>
          <Text
            variant="eyebrow"
            color="textSecondary"
            accessibilityRole="header"
            style={{ marginLeft: space.lg }}
          >
            {t('demo.account')}
          </Text>
          <Segmented<DemoAccount>
            testID="demo-account"
            accessibilityLabel={t('demo.account')}
            value={account}
            onChange={(next) => (next === 'guest' ? signOut() : signIn(next))}
            options={[
              { id: 'guest', label: t('more.account.guest').split(' ').slice(-1)[0] ?? 'Guest' },
              { id: 'supporter', label: t('passport.card.supporter') },
              { id: 'member', label: t('more.account.member').split(' ').slice(-2).join(' ') },
            ]}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text
            variant="eyebrow"
            color="textSecondary"
            accessibilityRole="header"
            style={{ marginLeft: space.lg }}
          >
            {t('demo.integrations')}
          </Text>
          <Text variant="footnote" color="textSecondary" style={{ marginHorizontal: space.lg }}>
            {t('demo.integrations.body')}
          </Text>
          <RowGroup>
            {integrationGates.map((gate) => (
              <View
                key={gate.id}
                style={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: 3 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text variant="headline" style={{ flex: 1 }}>
                    {gate.provider}
                  </Text>
                  <Tag label={t('demo.mock')} tone="warning" />
                </View>
                <Text variant="footnote" color="textSecondary">
                  {gate.owner}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {gate.needs.join(' · ')}
                </Text>
              </View>
            ))}
          </RowGroup>
        </View>

        <View style={{ gap: space.sm }}>
          <Text
            variant="eyebrow"
            color="textSecondary"
            accessibilityRole="header"
            style={{ marginLeft: space.lg }}
          >
            {t('demo.analytics')}
          </Text>
          <Text variant="footnote" color="textSecondary" style={{ marginHorizontal: space.lg }}>
            {t('demo.analytics.body')}
          </Text>
          <RowGroup>
            {events.length === 0 ? (
              <Text variant="callout" color="textSecondary" style={{ padding: space.lg }}>
                {t('demo.analytics.none')}
              </Text>
            ) : (
              events.slice(0, 12).map((event) => (
                <View
                  key={`${event.at}-${event.event}`}
                  style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}
                >
                  <Text variant="footnote" style={{ fontWeight: '700' }}>
                    {event.event}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {Object.entries(event.props)
                      .map(([key, value]) => `${key}=${String(value)}`)
                      .join('  ') || '—'}
                  </Text>
                </View>
              ))
            )}
          </RowGroup>
        </View>

        <Button
          testID="demo-reset"
          label={t('demo.reset')}
          variant="secondary"
          fill
          onPress={demo.reset}
        />
      </View>
    </Page>
  );
}
