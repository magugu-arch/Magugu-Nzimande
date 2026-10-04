import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, elevation, radius, spacing } from '../tokens';
import { Touchable } from './Touchable';

export type CardTone = 'surface' | 'navy' | 'navy2' | 'yellow' | 'sunken' | 'outline';

export interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const BG: Record<CardTone, string> = {
  surface: colors.surface,
  navy: colors.navy,
  navy2: colors.navy2,
  yellow: colors.yellow,
  sunken: colors.surfaceSunken,
  outline: 'transparent',
};

/** Rounded card with restrained shadow (brief §17). Pressable when given `onPress`. */
export function Card({
  children,
  tone = 'surface',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
  style,
  testID,
}: CardProps) {
  const base = [
    styles.card,
    { backgroundColor: BG[tone] },
    tone === 'surface' ? elevation.card : null,
    tone === 'outline' ? styles.outline : null,
    padded ? styles.padded : null,
    style,
  ];
  if (!onPress) {
    return (
      <View testID={testID} style={base}>
        {children}
      </View>
    );
  }
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      feedback="scale"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={base}
    >
      {children}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  // No overflow clipping here: on iOS it would also clip the shadow.
  card: { borderRadius: radius.lg },
  padded: { padding: spacing.lg },
  outline: { borderWidth: 1, borderColor: colors.border },
});
