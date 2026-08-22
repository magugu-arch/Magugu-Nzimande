import { memo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { colors, typography, type TypographyVariant } from '@/theme';

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
 */
export const Text = memo(function Text({
  variant = 'body',
  color = colors.textPrimary,
  align,
  singleLine,
  style,
  numberOfLines,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
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
