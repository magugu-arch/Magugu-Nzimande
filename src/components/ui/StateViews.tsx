import { memo } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/**
 * The three non-happy states every data surface must handle (brief §12).
 * Screens compose these instead of inventing their own spinners and messages.
 */

export interface LoadingStateProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
}

export const LoadingState = memo(function LoadingState({
  message = 'Loading…',
  style,
}: LoadingStateProps) {
  return (
    <View style={[styles.centered, style]} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="caption" color={colors.textMuted}>
        {message}
      </Text>
    </View>
  );
});

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const EmptyState = memo(function EmptyState({
  icon = 'fast-food-outline',
  title,
  message,
  actionLabel,
  onActionPress,
  style,
  testID,
}: EmptyStateProps) {
  return (
    <View testID={testID} style={[styles.centered, styles.padded, style]}>
      <View style={styles.iconWell}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text variant="h2" align="center">
        {title}
      </Text>
      <Text variant="body" color={colors.textSecondary} align="center">
        {message}
      </Text>
      {actionLabel && onActionPress ? (
        <Button
          label={actionLabel}
          onPress={onActionPress}
          fullWidth={false}
          style={styles.cta}
          preserveCase
        />
      ) : null}
    </View>
  );
});

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ErrorState = memo(function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
  style,
  testID,
}: ErrorStateProps) {
  return (
    <View testID={testID} style={[styles.centered, styles.padded, style]} accessibilityRole="alert">
      <View style={[styles.iconWell, styles.errorWell]}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.status.error} />
      </View>
      <Text variant="h2" align="center">
        {title}
      </Text>
      <Text variant="body" color={colors.textSecondary} align="center">
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          onPress={onRetry}
          variant="tertiary"
          fullWidth={false}
          iconLeft="refresh"
          style={styles.cta}
        />
      ) : null}
    </View>
  );
});

/**
 * Offline is not the same as broken, and neither is the same as empty.
 *
 * Its own component rather than an `ErrorState` with different words, because
 * eight screens need to say this and they need to say it identically — and
 * because "Something went wrong" is wrong here. Nothing went wrong; the phone
 * is out of signal, which the customer can do something about.
 */
export const OfflineState = memo(function OfflineState({
  message = "We'll load this as soon as you're back on the network.",
  onRetry,
  style,
  testID,
}: Omit<ErrorStateProps, 'title'>) {
  return (
    <View testID={testID} style={[styles.centered, styles.padded, style]} accessibilityRole="alert">
      <View style={[styles.iconWell, styles.errorWell]}>
        <Ionicons name="wifi-outline" size={30} color={colors.status.warning} />
      </View>
      <Text variant="h2" align="center">
        You&apos;re offline
      </Text>
      <Text variant="body" color={colors.textSecondary} align="center">
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          onPress={onRetry}
          variant="tertiary"
          fullWidth={false}
          iconLeft="refresh"
          style={styles.cta}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.huge,
  },
  padded: { paddingHorizontal: spacing.xxl },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  errorWell: { backgroundColor: colors.status.errorSoft },
  cta: { marginTop: spacing.sm },
});
