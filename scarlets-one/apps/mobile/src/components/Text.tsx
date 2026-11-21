import { type as typeScale, type TypeVariant } from '@scarlets/ui';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme, type Theme } from '@/theme';

type ColourRole = keyof Pick<
  Theme,
  | 'text'
  | 'textSecondary'
  | 'accentText'
  | 'onAccent'
  | 'onInverse'
  | 'onInverseMuted'
  | 'accentOnInverse'
  | 'goldText'
  | 'goldOnInverse'
  | 'success'
  | 'warning'
>;

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  /** A semantic colour role. Components name a role, never a hex. */
  color?: ColourRole;
  align?: TextStyle['textAlign'];
  /** Tabular figures, so a score or countdown does not jitter as it changes. */
  numeric?: boolean;
}

/**
 * All type goes through here: system face, size-specific tracking and
 * leading, and the reader's text-size setting respected (capped so a single
 * word cannot push a layout apart).
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  numeric,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const spec = typeScale[variant];
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'score' || variant === 'display' ? 1.3 : 1.6}
      {...rest}
      style={[
        {
          color: theme[color],
          fontSize: spec.size,
          lineHeight: spec.leading,
          letterSpacing: spec.tracking,
          fontWeight: spec.weight,
          textAlign: align,
          textTransform: 'uppercase' in spec && spec.uppercase ? 'uppercase' : undefined,
          fontVariant: numeric ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
