import { formatShortDate } from '@scarlets/domain';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { DemoChip, Tag } from '@/components/Chips';
import { Page } from '@/components/Page';
import { ErrorState, Notice, SkeletonList } from '@/components/States';
import { Text } from '@/components/Text';
import { useContentItem } from '@/data/queries';
import { useL, useLocale, useResolve, useT } from '@/i18n';
import { shareText } from '@/lib/links';
import { mediaAsset } from '@/media';
import { space } from '@/theme';

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const l = useL();
  const resolve = useResolve();
  const locale = useLocale();
  const query = useContentItem(id);
  const item = query.data?.data;

  if (query.isPending) {
    return (
      <Page title={t('club.stories')} back>
        <SkeletonList rows={6} />
      </Page>
    );
  }
  if (!item) {
    return (
      <Page title={t('club.stories')} back>
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <Notice body={t('common.notFound')} />
        )}
      </Page>
    );
  }

  const title = resolve(item.title);
  // Welsh was asked for and at least part of the story is only in English.
  const fallback =
    locale === 'cy' && (title.fallback || item.body.some((p) => resolve(p).fallback));
  const asset = mediaAsset(item.mediaId);

  return (
    <Page
      testID="screen-story"
      title={title.value}
      back
      hero={{
        mediaId: item.mediaId,
        height: 380,
        content: (
          <View style={{ gap: space.sm }}>
            <View
              style={{
                flexDirection: 'row',
                gap: space.sm,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <DemoChip onDark />
              <Text variant="eyebrow" color="onInverseMuted">
                {formatShortDate(item.publishAt, 'Europe/London', locale)}
              </Text>
            </View>
            <Text
              variant="title1"
              color="onInverse"
              accessibilityRole="header"
              accessibilityLanguage={title.locale}
            >
              {title.value}
            </Text>
          </View>
        ),
      }}
    >
      <View style={{ gap: space.lg }}>
        {fallback ? (
          <Notice icon="language-outline" body={t('common.fallback')} testID="story-fallback" />
        ) : null}
        <Text
          variant="title3"
          color="textSecondary"
          accessibilityLanguage={resolve(item.summary).locale}
        >
          {l(item.summary)}
        </Text>
        {item.body.map((paragraph, index) => {
          const text = resolve(paragraph);
          return (
            <Text
              key={index}
              variant="body"
              accessibilityLanguage={text.locale}
              style={{ fontSize: 17, lineHeight: 27 }}
            >
              {text.value}
            </Text>
          );
        })}
        <View style={{ gap: space.xs }}>
          <Tag label={t('concept.image')} icon="image-outline" />
          <Text variant="caption" color="textSecondary">
            {asset ? `${l(asset.alt)} ` : ''}
            {item.credit}
          </Text>
        </View>
        <Button
          testID="story-share"
          label={t('common.share')}
          icon="share-outline"
          variant="secondary"
          onPress={() => void shareText(`${title.value} · Scarlets One (${t('story.demo')})`)}
        />
      </View>
    </Page>
  );
}
