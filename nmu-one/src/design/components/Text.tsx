import { memo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { colors } from '../tokens';
import { fontScaleCapFor, typography, type TypographyVariant } from '../typography';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * The only text primitive. Screens choose a semantic variant, never a size,
 * and the variant decides how far the OS text-size setting may scale it.
 */
export const Text = memo(function Text({
  variant = 'body',
  color = colors.textPrimary,
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? fontScaleCapFor(variant)}
      style={StyleSheet.flatten([typography[variant], { color }, align ? { textAlign: align } : null, style])}
    />
  );
});
