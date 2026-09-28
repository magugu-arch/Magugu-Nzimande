import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, spacing } from '@/theme';
import { useReduceMotion } from '@/utils/useReduceMotion';
import { Text } from './Text';
import { PremiumButton } from './PremiumButton';

/** §25 EmptyState. */
export function EmptyState({
  icon = 'feather',
  title,
  body,
  action,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={styles.state}
      accessible
      accessibilityLabel={[title, body].filter(Boolean).join('. ')}
    >
      <View style={styles.stateIcon}>
        <Feather name={icon} size={22} color={colors.accent} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="textMuted" align="center">
          {body}
        </Text>
      ) : null}
      {action && onAction ? (
        <PremiumButton label={action} variant="secondary" onPress={onAction} compact />
      ) : null}
    </View>
  );
}

/**
 * §25 ErrorState. Always offers a way forward (§23): retry, and — for
 * anything booking-shaped — the human route to the reservations team.
 */
export function ErrorState({
  message,
  onRetry,
  onContact,
}: {
  message: string;
  onRetry?: () => void;
  onContact?: () => void;
}) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <View style={[styles.stateIcon, { borderColor: colors.copper }]}>
        <Feather name="alert-circle" size={22} color={colors.copper} />
      </View>
      <Text variant="body" align="center">
        {message}
      </Text>
      <View style={styles.actions}>
        {onRetry ? (
          <PremiumButton label="Try again" variant="secondary" compact onPress={onRetry} />
        ) : null}
        {onContact ? (
          <PremiumButton label="Contact us" variant="ghost" compact onPress={onContact} />
        ) : null}
      </View>
    </View>
  );
}

/** Inline message for a failed action on a form. */
export function InlineNotice({
  tone = 'info',
  children,
  style,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const tint =
    tone === 'danger'
      ? colors.danger
      : tone === 'warning'
        ? colors.warning
        : tone === 'success'
          ? colors.success
          : colors.accent;
  const icon = tone === 'danger' ? 'alert-circle' : tone === 'success' ? 'check-circle' : 'info';
  return (
    <View
      style={[styles.notice, { borderLeftColor: tint }, style]}
      accessibilityLiveRegion="polite"
    >
      <Feather name={icon} size={16} color={tint} style={{ marginTop: 3 }} />
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? <Text variant="bodySmall">{children}</Text> : children}
      </View>
    </View>
  );
}

/** A quiet shimmering block while content loads; still under reduced motion. */
export function Skeleton({
  height = 20,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduce, o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
        animated,
        style,
      ]}
    />
  );
}

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <View
      style={{ gap: spacing.md, paddingVertical: spacing.lg }}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <Skeleton height={180} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={16} width={i % 2 ? '60%' : '85%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderLeftWidth: 2,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
});
