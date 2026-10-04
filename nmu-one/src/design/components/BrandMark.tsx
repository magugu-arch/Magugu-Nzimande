import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../tokens';
import { Text } from './Text';

/**
 * The NMU ONE wordmark, set typographically in Nunito Sans with the C.I.
 * yellow rule. It stands in for the university's licensed mark, which is
 * not redrawn here — supply the vector masters and swap this component.
 */
export function BrandMark({ tone = 'onDark', size = 'md' }: { tone?: 'onDark' | 'onLight'; size?: 'sm' | 'md' | 'lg' }) {
  const fg = tone === 'onDark' ? colors.white : colors.navy;
  const scale = size === 'lg' ? 1.5 : size === 'sm' ? 0.7 : 1;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel="NMU ONE"
    >
      <Text variant="title1" color={fg} style={{ fontSize: 30 * scale, lineHeight: 32 * scale, letterSpacing: 0.5 }}>
        NMU
      </Text>
      <View style={[styles.rule, { width: 54 * scale, height: Math.max(2, 3 * scale) }]} />
      <Text variant="overline" color={tone === 'onDark' ? colors.yellow : colors.navy2} style={{ fontSize: 11 * scale, letterSpacing: 4 * scale }}>
        ONE
      </Text>
    </View>
  );
}

/** Small horizontal lockup for headers. */
export function BrandInline({ tone = 'onLight' }: { tone?: 'onDark' | 'onLight' }) {
  const fg = tone === 'onDark' ? colors.white : colors.navy;
  return (
    <View style={styles.inline} accessible accessibilityRole="image" accessibilityLabel="NMU ONE">
      <Text variant="title3" color={fg}>
        NMU
      </Text>
      <View style={styles.inlineRule} />
      <Text variant="overline" color={tone === 'onDark' ? colors.yellow : colors.navy2}>
        ONE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  rule: { backgroundColor: colors.yellow, borderRadius: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineRule: { width: 3, height: 18, backgroundColor: colors.yellow, borderRadius: 2 },
});
