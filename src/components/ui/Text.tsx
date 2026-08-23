import { memo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { colors, fontScaleCapFor, typography, type TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Convenience for the very common "one-line, ellipsised" case. */
  singleLine?: boolean;
}

/**
 * The only text primitive in the app. Screens pick a semantic `variant` rather
 * than setting font sizes, so the type scale stays consistent everywhere.
 *
 * It is also where the OS text-size setting is honoured. React Native scales
 * every `Text` by the device font scale by default, which is right for content
 * and ruinous for a label inside a fixed-height control — so the variant
 * decides how far it may go. See `fontScaleCapFor`.
 */
export const Text = memo(function Text({
  variant = 'body',
  color = colors.textPrimary,
  align,
  singleLine,
  style,
  numberOfLines,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      // An explicit prop wins; otherwise the type scale's policy applies.
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? fontScaleCapFor(variant)}
      numberOfLines={singleLine ? 1 : numberOfLines}
      style={StyleSheet.flatten([
        typography[variant],
        { color },
        align ? { textAlign: align } : null,
        style,
      ])}
    />
  );
});
