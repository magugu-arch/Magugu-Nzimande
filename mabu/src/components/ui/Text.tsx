import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

/**
 * The only text primitive screens use. Dynamic type is honoured (§24), capped
 * for the display sizes so a 40pt heading at 200% does not push a whole screen
 * of content below the fold.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const base = typography[variant];
  const cap =
    maxFontSizeMultiplier ??
    (variant === 'hero' || variant === 'h1'
      ? 1.3
      : variant === 'eyebrow' || variant === 'button'
        ? 1.5
        : 2);
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={cap}
      style={[base, { color: colors[color] }, align ? { textAlign: align } : null, style]}
    />
  );
}
