import { useState } from 'react';
import { View } from 'react-native';
import { DataStamp } from '@/components/Chips';
import { Page } from '@/components/Page';
import { Segmented } from '@/components/Segmented';
import { ErrorState, Notice, SkeletonList } from '@/components/States';
import { StoryCard } from '@/components/StoryCard';
import { Text } from '@/components/Text';
import { useContentList } from '@/data/queries';
import { useT } from '@/i18n';
import { space } from '@/theme';

/**
 * Official media only, as deep links to the club's own channels. Nothing is
 * hosted or streamed here, and there are no live streams or broadcast
 * replays: those rights belong to the broadcasters.
 */
export default function WatchScreen() {
  const t = useT();
  const [kind, setKind] = useState<'video' | 'audio'>('video');
  const query = useContentList({ kind });
  const items = query.data?.data ?? [];
  return (
    <Page testID="screen-watch" title={t('watch.title')} back>
      <View style={{ gap: space.lg }}>
        <Text variant="body" color="textSecondary">
          {t('watch.intro')}
        </Text>
        <Segmented
          testID="watch-kind"
          accessibilityLabel={t('watch.title')}
          value={kind}
          onChange={setKind}
          options={[
            { id: 'video', label: t('watch.video') },
            { id: 'audio', label: t('watch.audio') },
          ]}
        />
        {query.isPending ? <SkeletonList rows={3} /> : null}
        {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}
        {query.data ? <DataStamp meta={query.data.meta} /> : null}
        {items.map((item) => (
          <View key={item.id} style={{ gap: space.xs }}>
            <StoryCard item={item} style={{ height: 210 }} />
            <Text variant="caption" color="textSecondary">
              {item.captions ? `${t('watch.captions')} · ` : ''}
              {t('common.destinationPending')}
            </Text>
          </View>
        ))}
        <Notice icon="film-outline" body={t('watch.rights')} />
      </View>
    </Page>
  );
}
