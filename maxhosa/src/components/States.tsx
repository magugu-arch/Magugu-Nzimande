import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.circle, { backgroundColor: colors.sunk }]}>
        <Ionicons name={icon} size={24} color={colors.ink2} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="callout" color="ink3" align="center" style={{ maxWidth: 300 }}>
        {body}
      </Text>
      {action ? (
        <Button label={action.label} onPress={action.onPress} style={{ marginTop: space.m }} />
      ) : null}
    </View>
  );
}

/** Says what failed and offers a retry; never pretends there is simply nothing. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn’t load this"
      body={message ?? 'Check your connection and try again.'}
      action={{ label: 'Try again', onPress: onRetry }}
    />
  );
}

/** A soft pulse while content loads; still under Reduce Motion. */
export function LoadingSkeleton({ rows = 2 }: { rows?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) o.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [o, reduced]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <View style={styles.grid} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows * 2 }).map((_, i) => (
        <Animated.View key={i} style={[styles.cell, pulse]}>
          <View style={[styles.block, { backgroundColor: colors.sunk }]} />
          <View style={[styles.line, { backgroundColor: colors.sunk, width: '80%' }]} />
          <View style={[styles.line, { backgroundColor: colors.sunk, width: '40%' }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: space.s,
    paddingVertical: space.xxxl,
    paddingHorizontal: space.gutter,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.m, paddingHorizontal: space.gutter },
  cell: { width: '47%', gap: space.s },
  block: { aspectRatio: 4 / 5, borderRadius: radius.s },
  line: { height: 12, borderRadius: 6 },
});
