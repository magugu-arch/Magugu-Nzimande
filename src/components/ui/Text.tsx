import { memo } from 'react';
import { Platform, Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { colors, fontScaleCapFor, typography, type TypographyVariant } from '@/theme';
import { cappedFontScale, useFontScale } from '@/features/system/useFontScale';

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
 *
 * On web that scaling has to be done here rather than delegated. React Native
 * Web reports a font scale of 1 whatever the browser is set to and emits every
 * size as absolute pixels, so an RNW app ignores the reader's text-size setting
 * outright — a WCAG 1.4.4 failure on the web build that the native builds did
 * not have. `useFontScale` reads the browser's own setting and this applies it
 * under the same per-variant caps, so all three platforms behave alike.
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
  const cap = maxFontSizeMultiplier ?? fontScaleCapFor(variant);
  const fontScale = useFontScale();

  /**
   * Applied on web only. On native this would double-count: React Native has
   * already scaled the rendered size by the time anything here could read it.
   *
   * Line height travels with it. Scaling a size and leaving its leading behind
   * is how enlarged text ends up overlapping the line above — the type scale
   * sets both, so both move.
   */
  const scaled = (() => {
    if (Platform.OS !== 'web') return null;
    const factor = cappedFontScale(fontScale, cap);
    if (factor === 1) return null;

    const base = typography[variant];
    return {
      fontSize: base.fontSize === undefined ? undefined : base.fontSize * factor,
      lineHeight: base.lineHeight === undefined ? undefined : base.lineHeight * factor,
    };
  })();

  return (
    <RNText
      {...rest}
      // An explicit prop wins; otherwise the type scale's policy applies.
      maxFontSizeMultiplier={cap}
      numberOfLines={singleLine ? 1 : numberOfLines}
      style={StyleSheet.flatten([
        typography[variant],
        scaled,
        { color },
        align ? { textAlign: align } : null,
        // After the scale, so a caller who sets an explicit size still wins.
        style,
      ])}
    />
  );
});
