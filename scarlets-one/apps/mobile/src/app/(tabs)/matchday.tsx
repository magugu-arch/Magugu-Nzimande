import type { MatchdayStage } from '@scarlets/domain';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, PlacementTag } from '@/components/Chips';
import { CheckRow } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { BarButton, Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { Press } from '@/components/Press';
import { SectionHeader } from '@/components/Rows';
import { Segmented } from '@/components/Segmented';
import { ErrorState, Notice, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { useMatchday } from '@/data/queries';
import { fixtureTitle, kickoff } from '@/features/format';
import { MeetingPoint } from '@/features/matchday/MeetingPoint';
import { useL, useLocale, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial, shareText } from '@/lib/links';
import { useMatchdayPlan } from '@/state/matchday';
import { radius, space, useTheme } from '@/theme';

const NONE: string[] = [];
const STAGES: MatchdayStage[] = ['before', 'arrival', 'inside', 'after'];

export default function MatchdayScreen() {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const theme = useTheme();
  const router = useRouter();
  const query = useMatchday();
  const day = query.data;
  const fixture = day?.fixture.data ?? null;
  const guide = day?.guide.data ?? null;
  const [stage, setStage] = useState<MatchdayStage | null>(null);
  const done = useMatchdayPlan((s) => (fixture ? (s.done[fixture.id] ?? NONE) : NONE));
  const toggle = useMatchdayPlan((s) => s.toggle);

  useEffect(() => {
    track('matchday_guide_open');
  }, []);

  // The clock suggests a stage; the supporter can always pick another.
  const current = stage ?? day?.stage ?? 'before';
  const when = fixture ? kickoff(fixture, locale) : null;
  const items = guide?.checklist.filter((item) => item.stage === current) ?? [];

  return (
    <Page
      testID="screen-matchday"
      title={t('matchday.title')}
      inTabs
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching && !query.isPending}
      actions={
        <BarButton icon="menu" label={t('common.more')} onPress={() => router.push('/more')} />
      }
      hero={{
        mediaId: 'parc-exterior',
        height: 360,
        content: (
          <View style={{ gap: space.sm }}>
            <Text variant="eyebrow" color="goldOnInverse">
              {t('matchday.title')}
            </Text>
            <Text variant="display" color="onInverse" accessibilityRole="header">
              {fixture ? fixtureTitle(fixture) : t('matchday.noFixture.title')}
            </Text>
            {fixture && when ? (
              <Text variant="callout" color="onInverse" style={{ fontWeight: '500' }}>
                {when.longDate} · {when.time} {when.zone} · {fixture.venue.name}
              </Text>
            ) : null}
            {day ? <DataStamp meta={day.fixture.meta} onDark /> : null}
          </View>
        ),
      }}
    >
      {query.isPending ? <SkeletonList rows={5} /> : null}
      {query.isError && !day ? <ErrorState onRetry={() => void query.refetch()} /> : null}
      {day && !fixture ? (
        <Notice
          icon="calendar-outline"
          title={t('matchday.noFixture.title')}
          body={t('matchday.noFixture.body')}
        />
      ) : null}
      {day && fixture && guide ? (
        <View style={{ gap: space.xxl }}>
          <View style={{ gap: space.md }}>
            <Segmented
              testID="stage"
              accessibilityLabel={t('matchday.stage.label')}
              value={current}
              onChange={setStage}
              options={STAGES.map((id) => ({ id, label: t(`matchday.stage.${id}` as MessageKey) }))}
            />
            <Card testID="checklist" style={{ gap: space.xs }}>
              <Text variant="title3" accessibilityRole="header" style={{ marginBottom: space.xs }}>
                {t('matchday.checklist')}
              </Text>
              {items.length === 0 ? (
                <Text variant="callout" color="textSecondary">
                  {t('matchday.checklist.empty')}
                </Text>
              ) : (
                items.map((item) => (
                  <View
                    key={item.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
                  >
                    <CheckRow
                      testID={`check-${item.id}`}
                      checked={done.includes(item.id)}
                      onToggle={() => toggle(fixture.id, item.id)}
                      title={l(item.title)}
                      detail={l(item.detail)}
                      style={{ flex: 1 }}
                    />
                    {item.section ? (
                      <Press
                        onPress={() =>
                          router.push({
                            pathname: '/matchday/[section]',
                            params: { section: item.section as string },
                          })
                        }
                        accessibilityLabel={`${t('common.more')}: ${l(item.title)}`}
                        hitSlop={8}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: theme.surfaceMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="chevron-forward" size={16} color={theme.textSecondary} />
                      </Press>
                    ) : null}
                  </View>
                ))
              )}
            </Card>
          </View>

          <MeetingPoint fixture={fixture} points={guide.points} />

          <View style={{ gap: space.md }}>
            <SectionHeader title={t('matchday.guide')} />
            <DataStamp meta={day.guide.meta} showNotice />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {guide.sections.map((section) => (
                <Press
                  key={section.id}
                  testID={`section-${section.id}`}
                  onPress={() => {
                    if (section.id === 'map') track('venue_map_open');
                    router.push({
                      pathname: '/matchday/[section]',
                      params: { section: section.id },
                    });
                  }}
                  scaleTo={0.975}
                  accessibilityLabel={`${l(section.title)}. ${l(section.summary)}`}
                  style={{
                    flexGrow: 1,
                    flexBasis: '45%',
                    minHeight: 118,
                    padding: space.lg,
                    borderRadius: radius.xl,
                    borderCurve: 'continuous',
                    backgroundColor: theme.surface,
                    gap: space.sm,
                  }}
                >
                  <Icon name={section.icon} size={26} color={theme.accentText} />
                  <Text variant="headline">{l(section.title)}</Text>
                  <Text variant="footnote" color="textSecondary" numberOfLines={2}>
                    {l(section.summary)}
                  </Text>
                </Press>
              ))}
            </View>
          </View>

          <Button
            testID="invite-friends"
            label={t('matchday.invite')}
            icon="share-outline"
            variant="secondary"
            fill
            onPress={() =>
              when
                ? void shareText(
                    t('matchday.fixture.share', {
                      fixture: fixtureTitle(fixture),
                      date: when.longDate,
                      time: `${when.time} ${when.zone}`,
                      venue: fixture.venue.name,
                    }),
                  )
                : undefined
            }
          />

          {day.partner ? (
            <Card padded={false} testID="matchday-partner" style={{ overflow: 'hidden' }}>
              <Photo id={day.partner.mediaId} style={{ height: 160 }} />
              <View style={{ padding: space.lg, gap: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <PlacementTag label={day.partner.label} />
                  <DemoChip />
                </View>
                <Text variant="title3">{l(day.partner.title)}</Text>
                <Text variant="callout" color="textSecondary">
                  {l(day.partner.body)}
                </Text>
                {day.partner.cta ? (
                  <Button
                    label={l(day.partner.cta.label)}
                    variant="secondary"
                    size="sm"
                    iconAfter="open-outline"
                    accessibilityHint={t('common.official')}
                    onPress={() =>
                      day.partner?.cta ? void openOfficial(day.partner.cta.url) : undefined
                    }
                  />
                ) : null}
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}
    </Page>
  );
}
