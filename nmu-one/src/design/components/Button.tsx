import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'onDark';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md';
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const SKIN: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.navy, fg: colors.white },
  // Navy on Primary Yellow: 11.3:1. Yellow carries the one action that matters most.
  accent: { bg: colors.yellow, fg: colors.navy },
  secondary: { bg: 'transparent', fg: colors.navy, border: colors.navy },
  ghost: { bg: 'transparent', fg: colors.navy2 },
  danger: { bg: colors.danger, fg: colors.white },
  onDark: { bg: colors.white, fg: colors.navy },
};

/**
 * One obvious next action per card (brief §5). Labels are short verbs —
 * "Pay R4,250.00", "Book this slot" — never "Submit".
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'start',
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const skin = SKIN[variant];
  const iconEl = icon ? <Icon name={icon} size={size === 'lg' ? 20 : 18} color={skin.fg} /> : null;
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      style={[
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: skin.bg },
        skin.border ? { borderWidth: 1.5, borderColor: skin.border } : null,
        fullWidth ? styles.full : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={skin.fg} />
        ) : (
          <>
            {iconPosition === 'start' ? iconEl : null}
            <Text variant={size === 'lg' ? 'button' : 'buttonSmall'} color={skin.fg} align="center">
              {label}
            </Text>
            {iconPosition === 'end' ? iconEl : null}
          </>
        )}
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  lg: { minHeight: 52, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  md: { minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  full: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
