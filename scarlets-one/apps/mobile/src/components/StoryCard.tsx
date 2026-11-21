import type { ContentItem } from '@scarlets/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useL, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { elevation, radius, space, useTheme } from '@/theme';
import { DemoChip } from './Chips';
import { Icon } from './Icon';
import { Photo } from './Photo';
import { Press } from './Press';
import { Text } from './Text';

const categoryKey = (item: ContentItem): MessageKey | null => {
  switch (item.category) {
    case 'first_team':
    case 'women':
    case 'academy':
    case 'community':
    case 'history':
      return `topic.${item.category}`;
    case 'matchday':
      return 'home.matchday';
    default:
      return null;
  }
};

function useOpenStory() {
  const router = useRouter();
  return (item: ContentItem) => {
    track(item.link ? 'video_start' : 'content_open', {
      content_id: item.id,
      category: item.category,
    });
    // Video and audio are official deep links: nothing is hosted or streamed here.
    if (item.link) void openOfficial(item.link.url);
    else router.push({ pathname: '/story/[id]', params: { id: item.id } });
  };
}

/** A photograph-led card: the image is the story, the type sits on a gradient. */
export function StoryCard({ item, style }: { item: ContentItem; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const l = useL();
  const t = useT();
  const open = useOpenStory();
  const category = categoryKey(item);
  return (
    <Press
      testID={`story-${item.id}`}
      onPress={() => open(item)}
      scaleTo={0.98}
      accessibilityRole={item.link ? 'link' : 'button'}
      accessibilityLabel={`${category ? `${t(category)}. ` : ''}${l(item.title)}. ${t('story.demo')}.`}
      accessibilityHint={item.link ? t('common.official') : undefined}
      style={[
        {
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: theme.inverse,
          ...elevation(theme, 2),
        },
        style,
      ]}
    >
      <Photo id={item.mediaId} style={StyleSheet.absoluteFill} decorative />
      <LinearGradient
        colors={['rgba(25,22,25,0)', 'rgba(25,22,25,0.5)', 'rgba(25,22,25,0.93)']}
        locations={[0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ flex: 1, justifyContent: 'space-between', padding: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <DemoChip onDark />
          {item.link ? (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(246,242,236,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={item.kind === 'audio' ? 'headset' : 'play'} size={16} color="#F6F2EC" />
            </View>
          ) : null}
        </View>
        <View style={{ gap: space.xs }}>
          {category ? (
            <Text variant="eyebrow" color="goldOnInverse">
              {t(category)}
            </Text>
          ) : null}
          <Text variant="title3" color="onInverse" numberOfLines={3}>
            {l(item.title)}
          </Text>
        </View>
      </View>
    </Press>
  );
}

/** A compact row: thumbnail, category, headline. */
export function StoryRow({ item }: { item: ContentItem }) {
  const l = useL();
  const t = useT();
  const theme = useTheme();
  const open = useOpenStory();
  const category = categoryKey(item);
  return (
    <Press
      testID={`story-${item.id}`}
      onPress={() => open(item)}
      scaleTo={0.985}
      accessibilityRole={item.link ? 'link' : 'button'}
      accessibilityLabel={`${l(item.title)}. ${l(item.summary)}`}
      accessibilityHint={item.link ? t('common.official') : undefined}
      style={{
        flexDirection: 'row',
        gap: space.md,
        alignItems: 'center',
        paddingVertical: space.sm,
      }}
    >
      <Photo
        id={item.mediaId}
        decorative
        style={{ width: 92, height: 72, borderRadius: radius.md, borderCurve: 'continuous' }}
      />
      <View style={{ flex: 1, gap: 3 }}>
        {category ? (
          <Text variant="eyebrow" color="accentText">
            {t(category)}
          </Text>
        ) : null}
        <Text variant="headline" numberOfLines={2}>
          {l(item.title)}
        </Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
          {item.durationLabel ? `${item.durationLabel} · ` : ''}
          {l(item.summary)}
        </Text>
      </View>
      <Icon
        name={item.link ? 'open-outline' : 'chevron-forward'}
        size={16}
        color={theme.textSecondary}
      />
    </Press>
  );
}
