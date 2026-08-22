import { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, MIN_TOUCH_TARGET, elevation } from '@/theme';
import { Text } from './Text';

/** The four levels of guidelines §22.2, in descending emphasis. */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** §22.5 prefers a leading icon. */
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  /** Right-aligned trailing text, e.g. the cart total on a checkout CTA. */
  trailingLabel?: string;
  /**
   * Keep the label exactly as written. §22.7 warns against all caps for long
   * button text, so anything carrying a product or store name sets this.
   */
  preserveCase?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

/** §22.4. Heights and horizontal padding are exact; do not scale below `sm`. */
const SIZES = {
  lg: { height: 56, paddingH: 32, gap: spacing.md, radius: radius.md, variant: 'buttonLg' },
  md: { height: 44, paddingH: 28, gap: spacing.sm, radius: radius.md, variant: 'buttonMd' },
  sm: { height: 36, paddingH: 20, gap: spacing.sm, radius: radius.sm, variant: 'buttonSm' },
} as const;

type Tone = { background: string; border: string; text: string };
type State = 'default' | 'hover' | 'pressed' | 'disabled';

/**
 * §22.3, all four states for all four variants.
 *
 * One deliberate departure: the guidelines draw disabled primary as white on
 * pale pink, and their own §22.9 panel scores that pairing 2.1:1 and marks it
 * Fail. WCAG exempts inactive controls, but shipping a combination the brand's
 * accessibility page flags seemed like the wrong way to be faithful, so the
 * disabled label is the pressed red instead — same fill, 6:1 instead of 1.6:1.
 */
const TONES: Record<ButtonVariant, Record<State, Tone>> = {
  primary: {
    default: { background: colors.primary, border: 'transparent', text: colors.onPrimary },
    hover: { background: colors.primaryHover, border: 'transparent', text: colors.onPrimary },
    pressed: { background: colors.primaryPressed, border: 'transparent', text: colors.onPrimary },
    disabled: {
      background: colors.brand.redDisabled,
      border: 'transparent',
      text: colors.primaryPressed,
    },
  },
  secondary: {
    default: { background: colors.surface, border: colors.primary, text: colors.primary },
    hover: { background: colors.primarySoft, border: colors.primary, text: colors.primaryHover },
    pressed: {
      background: colors.brand.redTint,
      border: colors.primaryPressed,
      text: colors.primaryPressed,
    },
    disabled: {
      background: colors.surface,
      border: colors.border,
      text: colors.textDisabled,
    },
  },
  tertiary: {
    default: { background: colors.surface, border: colors.brand.black, text: colors.textPrimary },
    hover: { background: colors.surfaceAlt, border: colors.brand.black, text: colors.textPrimary },
    pressed: {
      background: colors.neutral.grey200,
      border: colors.brand.black,
      text: colors.textPrimary,
    },
    disabled: { background: colors.surface, border: colors.border, text: colors.textDisabled },
  },
  text: {
    default: { background: 'transparent', border: 'transparent', text: colors.primary },
    hover: { background: 'transparent', border: 'transparent', text: colors.primaryHover },
    pressed: { background: 'transparent', border: 'transparent', text: colors.primaryPressed },
    disabled: { background: 'transparent', border: 'transparent', text: colors.textDisabled },
  },
};

function borderWidth(variant: ButtonVariant, size: ButtonSize): number {
  if (variant === 'primary' || variant === 'text') return 0;
  return size === 'sm' ? 1.5 : 2;
}

/**
 * The action primitive, to guidelines §22.
 *
 * Two rules the component enforces so callers cannot break them: every button
 * clears the 44×44 minimum touch target of §22.9 — `sm` is 36px tall by spec,
 * so the shortfall is made up in `hitSlop` rather than by growing the box —
 * and labels are uppercased by default, matching every CTA in the app
 * mockups, with `preserveCase` for the long labels §22.7 cautions about.
 *
 * Two rules it cannot: §22.7's "one primary button per screen" and "don't mix
 * styles in the same hierarchy" are composition decisions, not component ones.
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
  preserveCase = false,
  style,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const isInactive = disabled || loading;
  const dimensions = SIZES[size];

  const handlePress = useCallback(() => {
    if (isInactive) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [isInactive, onPress]);

  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);

  // A pointer can leave the button while it is held down, so hover is only
  // consulted once pressed and disabled have had their say.
  const toneFor = (pressed: boolean): Tone => {
    const states = TONES[variant];
    if (isInactive) return states.disabled;
    if (pressed) return states.pressed;
    if (hovered) return states.hover;
    return states.default;
  };

  const shortfall = Math.max(0, MIN_TOUCH_TARGET - dimensions.height) / 2;
  const resting = toneFor(false);

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      disabled={isInactive}
      hitSlop={{ top: shortfall, bottom: shortfall, left: 0, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel={trailingLabel ? `${label}, ${trailingLabel}` : label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => {
        const tone = toneFor(pressed && !isInactive);
        return [
          styles.base,
          {
            height: dimensions.height,
            paddingHorizontal: dimensions.paddingH,
            borderRadius: dimensions.radius,
            backgroundColor: tone.background,
            borderColor: tone.border,
            borderWidth: borderWidth(variant, size),
          },
          variant === 'text' ? styles.textVariant : null,
          fullWidth ? styles.fullWidth : styles.autoWidth,
          variant === 'primary' && !isInactive ? elevation.sm : null,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={resting.text} />
      ) : (
        <View style={[styles.content, { gap: dimensions.gap }]}>
          {iconLeft ? <Ionicons name={iconLeft} size={18} color={resting.text} /> : null}
          <Text
            variant={dimensions.variant}
            color={resting.text}
            style={variant === 'text' ? styles.underline : undefined}
          >
            {preserveCase ? label : label.toUpperCase()}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={18} color={resting.text} /> : null}
          {trailingLabel ? (
            <>
              <View style={styles.spacer} />
              <Text variant={dimensions.variant} color={resting.text}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  // §22.2 draws the text button as an inline link, so it carries no box
  // padding and sits flush with the content around it.
  textVariant: { paddingHorizontal: 0, alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
  fullWidth: { alignSelf: 'stretch' },
  autoWidth: { alignSelf: 'flex-start' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  spacer: { flex: 1 },
});
