import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, MIN_TOUCH_TARGET, radius, spacing } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface PremiumButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * §25 PremiumButton. Brass fill is reserved for the one primary action on a
 * screen; everything else is outlined or text, so "Book Your Table" is always
 * the brightest thing in view.
 */
export function PremiumButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
  accessibilityHint,
  style,
  testID,
}: PremiumButtonProps) {
  const inert = disabled || loading;
  const fg =
    variant === 'primary'
      ? colors.textOnAccent
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? colors.accent
          : colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={inert ? undefined : onPress}
      disabled={!!inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!inert}
      aria-busy={!!loading}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.dangerOutline,
        variant === 'ghost' && styles.ghost,
        pressed && !inert && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        inert && styles.inert,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={fg} size="small" />
        ) : icon ? (
          <Feather name={icon} size={16} color={fg} />
        ) : null}
        <Text variant="button" style={{ color: fg }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: { backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  secondary: { borderWidth: 1, borderColor: colors.hairline, backgroundColor: 'transparent' },
  dangerOutline: { borderWidth: 1, borderColor: colors.danger },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.7 },
  inert: { opacity: 0.45 },
});
