import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING, springConfig } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { TrackingView } from '@/domain/delivery';
import { STAGES } from '@/domain/types';
import { Text } from '../Text';

/**
 * The glanceable status — what a Live Activity shows on iOS: the state, an
 * attributed estimate or an honest "not yet", when it was last updated, and
 * progress through the seven stages.
 */
export function StatusCard({
  view,
  eyebrow,
  updated,
}: {
  view: TrackingView;
  eyebrow: string;
  updated: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.ink }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${view.title}. ${view.estimate.text}. Updated ${updated}.`}
    >
      <Text variant="eyebrow" style={{ color: colors.onInk, opacity: 0.72 }}>
        {eyebrow}
      </Text>
      <Text variant="title" style={{ color: colors.onInk, marginTop: space.xs }}>
        {view.title}
      </Text>
      <Text variant="callout" style={{ color: colors.onInk, opacity: 0.9 }}>
        {view.estimate.text}
      </Text>
      <Text variant="caption" style={{ color: colors.onInk, opacity: 0.72, marginTop: space.xs }}>
        Updated {updated}
      </Text>
      <StageBar stage={view.stage} />
    </View>
  );
}

export function StageBar({ stage }: { stage: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bar}>
      {STAGES.map((s, i) => (
        <Segment key={s} filled={i <= stage} track={colors.onInk} fill="#D9A853" />
      ))}
    </View>
  );
}

function Segment({ filled, track, fill }: { filled: boolean; track: string; fill: string }) {
  const p = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    p.set(withSpring(filled ? 1 : 0, springConfig(SPRING.settle)));
  }, [filled, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <View style={[styles.segment, { backgroundColor: track, opacity: filled ? 1 : 0.22 }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: fill, transformOrigin: 'left' }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.gutter, padding: space.l + 2, borderRadius: radius.l },
  bar: { flexDirection: 'row', gap: 4, marginTop: space.l },
  segment: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
});
