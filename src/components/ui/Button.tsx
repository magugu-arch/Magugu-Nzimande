import { memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, MIN_TOUCH_TARGET, elevation } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  /** Right-aligned trailing text, e.g. the cart total on a checkout CTA. */
  trailingLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

const SIZES: Record<ButtonSize, { height: number; paddingH: number; gap: number }> = {
  sm: { height: MIN_TOUCH_TARGET, paddingH: spacing.lg, gap: spacing.sm },
  md: { height: 50, paddingH: spacing.xl, gap: spacing.sm },
  lg: { height: 56, paddingH: spacing.xxl, gap: spacing.md },
};

function palette(variant: ButtonVariant, disabled: boolean) {
  if (disabled) {
    return {
      background: colors.neutral.grey200,
      border: 'transparent',
      text: colors.textDisabled,
    };
  }
  switch (variant) {
    case 'primary':
      return { background: colors.primary, border: 'transparent', text: colors.onPrimary };
    case 'secondary':
      return { background: colors.primarySoft, border: 'transparent', text: colors.primary };
    case 'outline':
      return { background: 'transparent', border: colors.borderStrong, text: colors.textPrimary };
    case 'ghost':
      return { background: 'transparent', border: 'transparent', text: colors.primary };
    case 'dark':
      return { background: colors.brand.black, border: 'transparent', text: colors.textOnDark };
  }
}

/**
 * Primary action primitive. bb.q Red is the default CTA colour (brief §5) and
 * every button clears the 44pt minimum touch target.
 */
export const Button = memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  iconLeft,
  iconRight,
  trailingLabel,
  style,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const tone = palette(variant, isInactive);
  const dimensions = SIZES[size];

  const handlePress = useCallback(() => {
    if (isInactive) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [isInactive, onPress]);

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={trailingLabel ? `${label}, ${trailingLabel}` : label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        {
          height: dimensions.height,
          paddingHorizontal: dimensions.paddingH,
          backgroundColor: tone.background,
          borderColor: tone.border,
          borderWidth: variant === 'outline' ? 1.5 : 0,
        },
        fullWidth ? styles.fullWidth : styles.autoWidth,
        variant === 'primary' && !isInactive ? elevation.sm : null,
        pressed && !isInactive ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.text} />
      ) : (
        <View style={[styles.content, { gap: dimensions.gap }]}>
          {iconLeft ? <Ionicons name={iconLeft} size={18} color={tone.text} /> : null}
          <Text variant={size === 'lg' ? 'h3' : 'bodyMedium'} color={tone.text}>
            {label}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={18} color={tone.text} /> : null}
          {trailingLabel ? (
            <>
              <View style={styles.spacer} />
              <Text variant={size === 'lg' ? 'h3' : 'bodyMedium'} color={tone.text}>
                {trailingLabel}
              </Text>
            </>
          ) : null}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  autoWidth: { alignSelf: 'flex-start' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  spacer: { flex: 1 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
});
