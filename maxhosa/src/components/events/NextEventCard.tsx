import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { radius, space } from '@/design/tokens';
import { upcoming } from '@/domain/events';
import { useEvents, useEventDate } from '@/features/events';

/** Home: the next fixture, glanceable, one tap from its page. Nothing when there is none. */
export function NextEventCard() {
  const data = useEvents();
  const dateLabel = useEventDate();
  const next = data.data ? upcoming(data.data.list, data.data.now)[0] : undefined;
  if (!next) return null;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text variant="heading" accessibilityRole="header">
          Next on the calendar
        </Text>
        <PressableScale
          accessibilityRole="button"
          onPress={() => router.push('/events')}
          hitSlop={10}
        >
          <Text variant="subhead" weight="600" color="ink2" style={styles.link}>
            All fixtures
          </Text>
        </PressableScale>
      </View>
      <PressableScale
        pressedScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${next.title}, ${dateLabel(next)}, ${next.city}${next.sample ? ', sample event' : ''}`}
        onPress={() => router.push({ pathname: '/events/[id]', params: { id: next.id } })}
        style={styles.card}
      >
        <AssetImage assetId={next.heroAssetId} decorative style={StyleSheet.absoluteFill} />
        <View style={styles.scrim} />
        <View style={styles.copy}>
          <Text variant="eyebrow" color="white" style={{ opacity: 0.9 }}>
            {next.sample ? 'Sample event · ' : ''}
            {next.kindLabel}
          </Text>
          <Text variant="title" color="white">
            {next.title}
          </Text>
          <Text variant="subhead" color="white" style={{ opacity: 0.92 }}>
            {dateLabel(next)} · {next.city}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: space.xxl },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: space.gutter,
    paddingBottom: space.m,
  },
  link: { textDecorationLine: 'underline' },
  card: {
    marginHorizontal: space.gutter,
    aspectRatio: 4 / 3,
    borderRadius: radius.m,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,10,8,0.38)' },
  copy: { padding: space.l, gap: space.xs },
});
