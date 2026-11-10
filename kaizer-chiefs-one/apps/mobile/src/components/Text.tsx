import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { color as palette, type } from '@/theme';
import type { ColorToken, TextStyleName } from '@kc-one/ui';

export interface TextProps extends RNTextProps {
  variant?: TextStyleName;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

/**
 * Display styles cap Dynamic Type growth so a hero line still fits; body copy
 * scales freely. Layout spacing is in the same units, so it grows with it.
 */
const MAX_SCALE: Partial<Record<TextStyleName, number>> = {
  hero: 1.2,
  heroItalic: 1.2,
  display: 1.3,
  displayItalic: 1.3,
  score: 1.3,
  title1: 1.5,
  micro: 1.6,
  eyebrow: 1.6,
  label: 1.6,
  labelSmall: 1.6,
};

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_SCALE[variant] ?? 2}
      {...rest}
      style={[type[variant], { color: palette[color] }, align ? { textAlign: align } : null, style]}
    />
  );
}
