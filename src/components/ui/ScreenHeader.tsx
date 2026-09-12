import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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

  /*
    The back arrow on every stack screen in the app, and it was a dead button
    on any screen opened cold.

    `canGoBack()` is false whenever this screen is the first one — a deep link,
    a push notification, a shared link, and on the web build every refresh. The
    arrow was still drawn, still had its "Go back" label, still took the tap,
    and did nothing. There is no way out of that screen except the OS back
    gesture, which on web is the browser's own history and equally empty.

    Found by grep after `audit:back` found the same line without a fallback on
    two checkout screens. It is the widest instance by far: this component is
    the header, so the hole was on every screen that uses one.

    Home, because this component cannot know better. A screen with somewhere
    more specific to go passes `onBack` and says so — which is what the
    checkout pickers now do.
  */
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={HIT_SLOP}
          dataSet={{ slopX: HIT_SLOP.left, slopY: HIT_SLOP.top }}
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
