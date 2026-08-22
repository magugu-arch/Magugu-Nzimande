import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, HIT_SLOP, MIN_TOUCH_TARGET } from '@/theme';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Defaults to router.back(). */
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  onDark?: boolean;
  align?: 'left' | 'center';
}

/** In-page header for stack screens that opt out of the native navigation bar. */
export const ScreenHeader = memo(function ScreenHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  onDark = false,
  align = 'left',
}: ScreenHeaderProps) {
  const router = useRouter();
  const tint = onDark ? colors.textOnDark : colors.textPrimary;

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
        >
          <Ionicons name="chevron-back" size={24} color={tint} />
        </Pressable>
      ) : (
        <View style={styles.iconSpacer} />
      )}

      <View style={[styles.titles, align === 'center' ? styles.centered : null]}>
        <Text variant="h3" color={tint} numberOfLines={1} align={align}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            color={onDark ? colors.textOnDarkMuted : colors.textSecondary}
            numberOfLines={1}
            align={align}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ?? <View style={styles.iconSpacer} />}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET + 8,
    paddingVertical: spacing.sm,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md,
  },
  iconSpacer: { width: MIN_TOUCH_TARGET },
  titles: { flex: 1, gap: spacing.xxs },
  centered: { alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
