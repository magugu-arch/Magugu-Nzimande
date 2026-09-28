import { View } from 'react-native';
import { colors, fontFamily, spacing } from '@/theme';
import { Text } from '../ui/Text';

/**
 * The board's lock-up: MÁBU in Playfair brass, RESTAURANT tracked wide
 * beneath, and a short brass rule. Set from the typeface until Mábu supplies
 * vector logo files (§50) — swap this component's body for the SVG then.
 */
export function Wordmark({ size = 56, subtitle = true }: { size?: number; subtitle?: boolean }) {
  return (
    <View
      style={{ alignItems: 'center' }}
      accessible
      accessibilityRole="header"
      accessibilityLabel={subtitle ? 'Mábu Restaurant' : 'Mábu'}
    >
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: size,
          lineHeight: size * 1.25,
          color: colors.accent,
          letterSpacing: size * 0.04,
        }}
        maxFontSizeMultiplier={1}
      >
        MÁBU
      </Text>
      {subtitle ? (
        <>
          <Text
            variant="eyebrow"
            style={{
              letterSpacing: size * 0.12,
              fontSize: Math.max(10, size * 0.19),
              lineHeight: Math.max(14, size * 0.26),
            }}
            maxFontSizeMultiplier={1}
          >
            RESTAURANT
          </Text>
          <View
            style={{
              width: size * 0.8,
              height: 1,
              backgroundColor: colors.accent,
              marginTop: spacing.md,
            }}
          />
        </>
      ) : null}
    </View>
  );
}
