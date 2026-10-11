import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { type as typeRoles, type TypeRole } from '@/design/tokens';
import { useTheme } from '@/design/theme';

type Props = TextProps & {
  variant?: TypeRole;
  color?: 'ink' | 'ink2' | 'ink3' | 'onInk' | 'ochre' | 'green' | 'rust' | 'cobalt' | 'white';
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
};

/**
 * Text by role, not by size. Respects the system text size; chrome that has
 * no room to grow passes its own `maxFontSizeMultiplier`.
 */
export function Text({ variant = 'body', color = 'ink', weight, align, style, ...rest }: Props) {
  const { colors } = useTheme();
  const tint = color === 'white' ? '#FFFCF7' : colors[color];
  return (
    <RNText
      {...rest}
      style={[
        typeRoles[variant] as TextStyle,
        { color: tint },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
