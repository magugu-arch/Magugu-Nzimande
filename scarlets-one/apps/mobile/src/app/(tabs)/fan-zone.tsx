import { reportReason, type ReportReason, type SupporterStory } from '@scarlets/domain';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, PlacementTag, Tag } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { BarButton, Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { Press } from '@/components/Press';
import { ListRow, RowGroup, SectionHeader } from '@/components/Rows';
import { Sheet } from '@/components/Sheet';
import { ErrorState, Notice, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { useFanZone, useReportStory } from '@/data/queries';
import {
  ChallengeCard,
  FanCamCard,
  PollCard,
  PredictionCard,
  QuizCard,
} from '@/features/fanzone/cards';
import { useL, useT, type MessageKey } from '@/i18n';
import { hitTarget, radius, space, useTheme } from '@/theme';

export default function FanZoneScreen() {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const router = useRouter();
  const query = useFanZone();
  const report = useReportStory();
  const [reporting, setReporting] = useState<SupporterStory | null>(null);
  const [reported, setReported] = useState(false);
  const zone = query.data;
  const activities = zone?.activities.data ?? [];
  const receipts = zone?.receipts ?? [];
  const stories = zone?.stories.data ?? [];

  const send = (reason: ReportReason) => {
    if (!reporting) return;
    report.mutate({ storyId: reporting.id, reason });
    setReporting(null);
    setReported(true);
  };

  return (
    <Page
      testID="screen-fanzone"
      title={t('fan.title')}
      inTabs
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching && !query.isPending}
      actions={
        <BarButton icon="menu" label={t('common.more')} onPress={() => router.push('/more')} />
      }
      hero={{
        mediaId: 'scarves-celebration',
        height: 320,
        content: (
          <View style={{ gap: space.sm }}>
            <Text variant="eyebrow" color="goldOnInverse">
              {t('app.tagline')}
            </Text>
            <Text variant="display" color="onInverse" accessibilityRole="header">
              {t('fan.title')}
            </Text>
            <Text variant="callout" color="onInverseMuted">
              {t('fan.safety')}
            </Text>
          </View>
        ),
      }}
    >
      {query.isPending ? <SkeletonList rows={5} /> : null}
      {query.isError && !zone ? <ErrorState onRetry={() => void query.refetch()} /> : null}
      {zone ? (
        <View style={{ gap: space.xxl }}>
          <View style={{ gap: space.md }}>
            <DataStamp meta={zone.activities.meta} showNotice />
            {activities.map((activity) => {
              switch (activity.kind) {
                case 'prediction':
                  return (
                    <PredictionCard key={activity.id} activity={activity} receipts={receipts} />
                  );
                case 'poll':
                  return (
                    <PollCard
                      key={activity.id}
                      activity={activity}
                      receipts={receipts}
                      results={zone.results[activity.id]}
                    />
                  );
                case 'quiz':
                  return <QuizCard key={activity.id} activity={activity} receipts={receipts} />;
                case 'fan_cam':
                  return <FanCamCard key={activity.id} activity={activity} receipts={receipts} />;
                case 'challenge':
                  return (
                    <ChallengeCard key={activity.id} activity={activity} receipts={receipts} />
                  );
              }
            })}
          </View>

          {zone.sponsor ? (
            <Card padded={false} testID="fanzone-sponsor" style={{ overflow: 'hidden' }}>
              <Photo id={zone.sponsor.mediaId} style={{ height: 168 }} />
              <View style={{ padding: space.lg, gap: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <PlacementTag label={zone.sponsor.label} />
                  <DemoChip />
                </View>
                <Text variant="title3">{l(zone.sponsor.title)}</Text>
                <Text variant="callout" color="textSecondary">
                  {l(zone.sponsor.body)}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {t('partner.slot')}
                </Text>
              </View>
            </Card>
          ) : null}

          <View style={{ gap: space.md }}>
            <SectionHeader title={t('fan.stories')} />
            {reported ? (
              <Notice
                icon="shield-checkmark-outline"
                body={t('fan.story.reported')}
                testID="story-reported"
              />
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={252 + space.md}
              decelerationRate="fast"
              style={{ marginHorizontal: -space.xl }}
              contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
            >
              {stories.map((story) => (
                <View
                  key={story.id}
                  testID={`supporter-story-${story.id}`}
                  style={{
                    width: 252,
                    borderRadius: radius.xl,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    backgroundColor: theme.surface,
                  }}
                >
                  <Photo id={story.mediaId} style={{ height: 190 }} />
                  <View style={{ padding: space.md, gap: space.xs }}>
                    <Text variant="headline" numberOfLines={2}>
                      {l(story.title)}
                    </Text>
                    <Text variant="footnote" color="textSecondary" numberOfLines={2}>
                      {l(story.body)}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: space.sm,
                      }}
                    >
                      <Tag
                        label={t('fan.stories.moderated')}
                        icon="shield-checkmark-outline"
                        tone="success"
                      />
                      <Press
                        testID={`report-${story.id}`}
                        onPress={() => setReporting(story)}
                        accessibilityLabel={`${t('fan.story.report')}: ${l(story.title)}`}
                        style={{
                          width: hitTarget,
                          height: hitTarget,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="flag-outline" size={18} color={theme.textSecondary} />
                      </Press>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <DataStamp meta={zone.stories.meta} />
          </View>
        </View>
      ) : null}

      <Sheet
        visible={reporting !== null}
        onClose={() => setReporting(null)}
        title={t('report.title')}
        testID="report-sheet"
      >
        <RowGroup style={{ backgroundColor: theme.surfaceMuted }}>
          {reportReason.options.map((reason) => (
            <ListRow
              key={reason}
              testID={`report-reason-${reason}`}
              title={t(`report.${reason}` as MessageKey)}
              onPress={() => send(reason)}
            />
          ))}
        </RowGroup>
      </Sheet>
    </Page>
  );
}
