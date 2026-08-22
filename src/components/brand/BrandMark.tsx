import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

export interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  /** Inverts the mark for use on bb.q Red or bb.q Black surfaces. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  sm: { dot: 26, wordmark: 'h3', tagline: 'micro' },
  md: { dot: 38, wordmark: 'h1', tagline: 'caption' },
  lg: { dot: 56, wordmark: 'display', tagline: 'body' },
} as const;

/**
 * Typographic bb.q wordmark.
 *
 * Rendered in type rather than shipped as artwork so it stays crisp at every
 * size and inverts cleanly. Swap in the licensed logo file here when brand
 * assets are provisioned — this is the only place the mark is drawn.
 */
export const BrandMark = memo(function BrandMark({
  size = 'md',
  onDark = false,
  style,
}: BrandMarkProps) {
  const dimensions = SIZES[size];
  const wordColor = onDark ? colors.textOnDark : colors.brand.black;

  return (
    <View style={[styles.container, style]} accessible accessibilityLabel="bb.q Chicken">
      <View
        style={[
          styles.dot,
          {
            width: dimensions.dot,
            height: dimensions.dot,
            backgroundColor: onDark ? colors.textOnDark : colors.primary,
          },
        ]}
      >
        <Text
          variant={size === 'lg' ? 'h2' : 'captionMedium'}
          color={onDark ? colors.primary : colors.onPrimary}
        >
          bb
        </Text>
      </View>

      <Text variant={dimensions.wordmark} color={wordColor}>
        .q
      </Text>
      <Text variant={dimensions.wordmark} color={onDark ? colors.textOnDark : colors.primary}>
        {' chicken'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
