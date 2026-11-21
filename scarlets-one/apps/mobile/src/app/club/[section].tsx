import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, Tag } from '@/components/Chips';
import { Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { RowGroup, SectionHeader } from '@/components/Rows';
import { ErrorState, Notice, SkeletonList } from '@/components/States';
import { StoryRow } from '@/components/StoryCard';
import { Text } from '@/components/Text';
import { useClubSection } from '@/data/queries';
import { useL, useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { followable, usePrefs } from '@/state/prefs';
import { radius, space } from '@/theme';

export default function ClubSectionScreen() {
  const { section: id } = useLocalSearchParams<{ section: string }>();
  const t = useT();
  const l = useL();
  const query = useClubSection(id);
  const following = usePrefs((s) => s.following);
  const toggleFollowing = usePrefs((s) => s.toggleFollowing);
  const section = query.data?.section.data;
  const stories = query.data?.stories.data ?? [];

  if (query.isPending) {
    return (
      <Page title={t('club.title')} back>
        <SkeletonList rows={5} />
      </Page>
    );
  }
  if (!section || !query.data) {
    return (
      <Page title={t('club.title')} back>
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <Notice body={t('common.notFound')} />
        )}
      </Page>
    );
  }

  const canFollow = followable.includes(section.category);
  const isFollowing = following.includes(section.category);

  return (
    <Page
      testID={`screen-club-${section.id}`}
      title={l(section.title)}
      back
      hero={{
        mediaId: section.mediaId,
        height: 330,
        content: (
          <View style={{ gap: space.sm }}>
            <Text variant="eyebrow" color="goldOnInverse">
              {t('club.title')}
            </Text>
            <Text variant="display" color="onInverse" accessibilityRole="header">
              {l(section.title)}
            </Text>
            <Text variant="callout" color="onInverseMuted">
              {l(section.intro)}
            </Text>
            {canFollow ? (
              <Button
                testID="follow-toggle"
                label={isFollowing ? t('club.following') : t('club.follow')}
                icon={isFollowing ? 'checkmark' : 'add'}
                variant={isFollowing ? 'outlineOnDark' : 'onDark'}
                size="sm"
                onPress={() => {
                  haptic.selection();
                  toggleFollowing(section.category);
                }}
              />
            ) : null}
          </View>
        ),
      }}
    >
      <View style={{ gap: space.xxl }}>
        <View style={{ gap: space.md }}>
          <DataStamp meta={query.data.section.meta} />
          {section.panels.map((panel) => (
            <Card key={panel.id} padded={false} style={{ overflow: 'hidden' }}>
              {panel.mediaId ? <Photo id={panel.mediaId} style={{ height: 220 }} /> : null}
              <View style={{ padding: space.lg, gap: space.sm }}>
                <Text variant="title3" accessibilityRole="header">
                  {l(panel.title)}
                </Text>
                <Text variant="body" color="textSecondary">
                  {l(panel.body)}
                </Text>
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  <Tag
                    label={t('common.awaitingClub')}
                    icon="hourglass-outline"
                    tone="warning"
                    style={{ borderRadius: radius.pill }}
                  />
                  <DemoChip />
                </View>
              </View>
            </Card>
          ))}
        </View>
        <View style={{ gap: space.md }}>
          <SectionHeader title={t('club.stories')} />
          {stories.length === 0 ? (
            <Notice icon="newspaper-outline" body={t('club.stories.none')} />
          ) : (
            <RowGroup style={{ paddingHorizontal: space.lg, paddingVertical: space.xs }}>
              {stories.map((item) => (
                <StoryRow key={item.id} item={item} />
              ))}
            </RowGroup>
          )}
        </View>
      </View>
    </Page>
  );
}
