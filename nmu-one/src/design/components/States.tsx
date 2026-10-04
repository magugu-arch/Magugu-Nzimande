import { useEffect, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import type { AdapterError } from '@/core/adapters/errors';
import { formatAgo, formatTime } from '@/core/time/sast';
import { clock } from '@/core/time/clock';
import type { DomainQuery } from '@/data/useDomainQuery';
import { colors, radius, spacing } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Notice } from './Layout';
import { Text } from './Text';

/**
 * The states every primary screen must have (brief §29): loading, success,
 * empty, error, offline, permission denied, unavailable. One component so
 * they look and read the same everywhere.
 */
export type StateKind = 'empty' | 'error' | 'offline' | 'denied' | 'unavailable' | 'not-configured';

const DEFAULTS: Record<StateKind, { icon: IconName; title: string; body: string }> = {
  empty: { icon: 'file-tray-outline', title: 'Nothing here yet', body: '' },
  error: {
    icon: 'cloud-offline-outline',
    title: 'We couldn’t load this',
    body: 'The service didn’t respond. Your information is safe — try again in a moment.',
  },
  offline: {
    icon: 'wifi-outline',
    title: 'You’re offline',
    body: 'This needs a connection, and there’s no saved copy on this phone. It will load when you’re back online.',
  },
  denied: {
    icon: 'lock-closed-outline',
    title: 'Not available to you',
    body: 'This part of NMU ONE isn’t included for your role.',
  },
  unavailable: {
    icon: 'time-outline',
    title: 'Not available yet',
    body: 'This will switch on once NMU has approved and connected it.',
  },
  'not-configured': {
    icon: 'construct-outline',
    title: 'Not connected yet',
    body: 'This service hasn’t been connected to NMU ONE in this build.',
  },
};

export function StateView({
  kind,
  title,
  body,
  actionLabel,
  onAction,
  testID,
}: {
  kind: StateKind;
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const d = DEFAULTS[kind];
  return (
    <View style={styles.state} testID={testID ?? `state-${kind}`} accessibilityRole="summary">
      <View style={styles.stateIcon}>
        <Icon name={d.icon} size={28} color={colors.navy} />
      </View>
      <Text variant="title3" align="center">
        {title ?? d.title}
      </Text>
      {(body ?? d.body) ? (
        <Text variant="body" color={colors.textSecondary} align="center">
          {body ?? d.body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="md"
          style={styles.center}
        />
      ) : null}
    </View>
  );
}

/** Skeleton block for a known content region (brief §19). */
export function Skeleton({
  height = 18,
  width = '100%',
  radiusSize = radius.sm,
}: {
  height?: number;
  width?: DimensionValue;
  radiusSize?: number;
}) {
  const reduceMotion = useReduceMotion();
  // useState, not useRef: the value is created once and read during render.
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return (
    <Animated.View
      style={{
        height,
        width,
        borderRadius: radiusSize,
        backgroundColor: colors.surfaceSunken,
        opacity: reduceMotion ? 0.8 : pulse,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, testID }: { lines?: number; testID?: string }) {
  return (
    <View
      style={styles.skeletonCard}
      testID={testID ?? 'skeleton'}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <Skeleton height={14} width="40%" />
      <Skeleton height={24} width="85%" />
      {Array.from({ length: Math.max(0, lines - 2) }, (_, i) => (
        <Skeleton key={i} height={14} width={`${70 - i * 12}%`} />
      ))}
    </View>
  );
}

const kindFor = (e: AdapterError): StateKind =>
  e.kind === 'offline'
    ? 'offline'
    : e.kind === 'forbidden' || e.kind === 'unauthorised'
      ? 'denied'
      : e.kind === 'not-configured'
        ? 'not-configured'
        : 'error';

export function ErrorState({
  error,
  onRetry,
  what,
}: {
  error: AdapterError;
  onRetry: () => void;
  what?: string;
}) {
  const kind = kindFor(error);
  return (
    <StateView
      kind={kind}
      title={kind === 'error' && what ? `We couldn’t load ${what}` : undefined}
      actionLabel={kind === 'error' || kind === 'offline' ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

/**
 * Renders a DomainQuery's states and hands successful data to `children`.
 * Offline copies and failed refreshes are labelled — never shown as current.
 */
export function QueryState<T>({
  query,
  children,
  loading,
  isEmpty,
  empty,
  what,
}: {
  query: DomainQuery<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  what?: string;
}) {
  if (query.status === 'loading') return <>{loading ?? <SkeletonCard />}</>;
  if (query.status === 'error' || query.data === undefined) {
    return query.error ? (
      <ErrorState error={query.error} onRetry={query.refetch} what={what} />
    ) : (
      <SkeletonCard />
    );
  }
  const data = query.data;
  const banner = query.fromCache ? (
    <Notice
      tone="neutral"
      icon="cloud-offline-outline"
      title="You’re offline"
      body={`Showing what was saved ${formatAgo(query.fromCache.savedAt, clock.now()).toLowerCase()} (${formatTime(query.fromCache.savedAt)}). It may have changed.`}
      testID="offline-copy"
    />
  ) : query.error ? (
    <Notice
      tone="warning"
      title="Couldn’t refresh"
      body="Showing what loaded earlier. Pull down to try again."
    />
  ) : null;
  if (isEmpty?.(data)) {
    return (
      <>
        {banner}
        {empty ?? <StateView kind="empty" />}
      </>
    );
  }
  return (
    <>
      {banner ? <View style={styles.banner}>{banner}</View> : null}
      {children(data)}
    </>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { alignSelf: 'center', marginTop: spacing.md },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  banner: { marginBottom: spacing.md },
});
