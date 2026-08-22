import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, MIN_TOUCH_TARGET } from '@/theme';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  right?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Settings/menu row used across Account, Help and Preferences. */
export const ListRow = memo(function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  onPress,
  right,
  showChevron = true,
  destructive = false,
  style,
  testID,
}: ListRowProps) {
  const tint = destructive ? colors.status.error : colors.textPrimary;
  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWell, destructive ? styles.iconWellDestructive : null]}>
          <Ionicons
            name={icon}
            size={18}
            color={iconColor ?? (destructive ? colors.status.error : colors.primary)}
          />
        </View>
      ) : null}

      <View style={styles.titles}>
        <Text variant="bodyMedium" color={tint} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, style]}>{content}</View>;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, style]}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET + 8,
    paddingVertical: spacing.md,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  iconWellDestructive: { backgroundColor: colors.status.errorSoft },
  titles: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.6 },
});
