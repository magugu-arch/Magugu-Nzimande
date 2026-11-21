import type { SourceMeta } from '@scarlets/domain';
import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useL, useT } from '@/i18n';
import { useReducedMotion } from '@/lib/motion';
import { radius, space, useTheme } from '@/theme';
import { Button } from './Button';
import { DataStamp } from './Chips';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function Skeleton({
  width = '100%',
  height = 16,
  round = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    // A quick, shallow pulse: well clear of the slow oscillation that can unsettle.
    pulse.set(withRepeat(withTiming(0.55, { duration: 700 }), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round, backgroundColor: theme.surfaceMuted },
        animated,
        style,
      ]}
    />
  );
}

/** A loading placeholder shaped like the cards it stands in for. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  const t = useT();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={{ gap: space.md }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ gap: space.sm }}>
          <Skeleton height={18} width="62%" />
          <Skeleton height={14} width="88%" />
        </View>
      ))}
    </View>
  );
}

export interface NoticeProps {
  icon?: IconName;
  title?: string;
  body: string;
  /** When given, the provider's state is shown under the message. */
  meta?: SourceMeta;
  action?: { label: string; onPress: () => void };
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Empty, unavailable and error states share one calm shape: what happened,
 * in a sentence, and what you can do about it. Nothing is ever filled in to
 * hide a gap.
 */
export function Notice({
  icon = 'information-circle-outline',
  title,
  body,
  meta,
  action,
  onDark,
  style,
  testID,
}: NoticeProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          padding: space.lg,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: onDark ? theme.inverseRaised : theme.surfaceMuted,
          gap: space.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <Icon name={icon} size={20} color={onDark ? theme.onInverseMuted : theme.textSecondary} />
        <View style={{ flex: 1, gap: 2 }}>
          {title ? (
            <Text variant="headline" color={onDark ? 'onInverse' : 'text'}>
              {title}
            </Text>
          ) : null}
          <Text variant="callout" color={onDark ? 'onInverseMuted' : 'textSecondary'}>
            {body}
          </Text>
        </View>
      </View>
      {meta ? <DataStamp meta={meta} onDark={onDark} /> : null}
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}

/** A provider's own explanation of why there is nothing to show. */
export function SourceNotice({
  meta,
  fallback,
  onDark,
}: {
  meta: SourceMeta;
  fallback: string;
  onDark?: boolean;
}) {
  const l = useL();
  return (
    <Notice
      icon={meta.status === 'offline' ? 'cloud-offline-outline' : 'information-circle-outline'}
      body={meta.notice ? l(meta.notice) : fallback}
      meta={meta}
      onDark={onDark}
    />
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <Notice
      icon="alert-circle-outline"
      title={t('common.error.title')}
      body={t('common.error.body')}
      action={{ label: t('common.retry'), onPress: onRetry }}
    />
  );
}
