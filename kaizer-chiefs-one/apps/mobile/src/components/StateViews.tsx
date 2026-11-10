import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  UNAVAILABLE_COPY,
  type Provenance,
  type ProviderResult,
  type UnavailableReason,
} from '@kc-one/contracts';
import { Button } from './Button';
import { Text } from './Text';
import { color, radius, space } from '@/theme';

const REASON_ICON: Record<UnavailableReason, keyof typeof Ionicons.glyphMap> = {
  integration_pending: 'git-network-outline',
  not_configured: 'construct-outline',
  offline: 'cloud-offline-outline',
  error: 'alert-circle-outline',
  not_authenticated: 'person-circle-outline',
  not_eligible: 'lock-closed-outline',
  demo_restricted: 'flask-outline',
};

/** An honest "this isn't here" card. Never styled as success. */
export function Notice({
  reason,
  title,
  body,
  action,
  style,
  compact,
}: {
  reason: UnavailableReason;
  title?: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const copy = UNAVAILABLE_COPY[reason];
  return (
    <View
      style={[styles.notice, compact && styles.noticeCompact, style]}
      accessibilityRole="summary"
    >
      <Ionicons name={REASON_ICON[reason]} size={compact ? 20 : 26} color={color.accent} />
      <View style={{ gap: space.xs, flex: compact ? 1 : undefined }}>
        <Text variant={compact ? 'headline' : 'title3'}>{title ?? copy.title}</Text>
        <Text variant="callout" color="textSecondary">
          {body ?? copy.body}
        </Text>
      </View>
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="secondary" compact />
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'albums-outline',
  title,
  body,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={32} color={color.textTertiary} />
      <Text variant="title3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="callout" color="textSecondary" align="center">
          {body}
        </Text>
      ) : null}
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="secondary" compact />
      ) : null}
    </View>
  );
}

/** Placeholder block while loading. A slow breathe, or still with Reduce Motion. */
export function Skeleton({
  height = 16,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (!reduceMotion) o.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [o, reduceMotion]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { height, width, borderRadius: radius.sm, backgroundColor: color.surfaceHigh },
        a,
        style,
      ]}
    />
  );
}

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ gap: space.md }} accessibilityLabel="Loading" accessible>
      <Skeleton height={140} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

/**
 * Renders a provider-backed query through all of its states: loading,
 * failed, unavailable (with an honest reason) and ok.
 */
export function QueryState<T>({
  query,
  children,
  loading,
  unavailable,
}: {
  query: UseQueryResult<ProviderResult<T>>;
  children: (data: T, provenance: Provenance) => ReactNode;
  loading?: ReactNode;
  /** Override the default notice for an unavailable result. */
  unavailable?: (reason: UnavailableReason, message: string) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <LoadingBlock />}</>;
  if (query.isError || !query.data) {
    return (
      <Notice
        reason="error"
        body="Something went wrong loading this. Nothing has been changed."
        action={{ label: 'Try again', onPress: () => void query.refetch() }}
      />
    );
  }
  const r = query.data;
  if (r.status === 'unavailable') {
    return (
      <>
        {unavailable ? (
          unavailable(r.reason, r.message)
        ) : (
          <Notice reason={r.reason} body={r.message} />
        )}
      </>
    );
  }
  return <>{children(r.data, r.provenance)}</>;
}

const styles = StyleSheet.create({
  notice: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.md,
    backgroundColor: color.bgRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
  noticeCompact: { flexDirection: 'row', alignItems: 'flex-start', padding: space.lg },
  empty: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.huge,
    paddingHorizontal: space.xl,
  },
});
