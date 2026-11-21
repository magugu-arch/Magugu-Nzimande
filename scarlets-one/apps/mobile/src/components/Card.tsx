import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, radius, space, useTheme } from '@/theme';
import { Press } from './Press';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** The always-dark premium surface: match mode, Passport. */
  tone?: 'surface' | 'inverse' | 'muted';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  tone = 'surface',
  padded = true,
  style,
  testID,
}: CardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor:
      tone === 'inverse' ? theme.inverse : tone === 'muted' ? theme.surfaceMuted : theme.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: padded ? space.lg : 0,
    ...(tone === 'muted' ? null : elevation(theme, 1)),
  };
  if (!onPress) {
    return (
      <View testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }
  return (
    <Press
      testID={testID}
      onPress={onPress}
      // A whole card moves less than a button: the same travel would feel loose.
      scaleTo={0.985}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[base, style]}
    >
      {children}
    </Press>
  );
}
