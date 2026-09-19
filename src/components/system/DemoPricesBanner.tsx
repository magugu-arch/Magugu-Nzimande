import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui/Text';
import { config } from '@/constants/config';
import { colors, spacing } from '@/theme';

/**
 * A standing mark that the prices on screen are invented.
 *
 * ── Why this is not optional ─────────────────────────────────────────────
 *
 * `EXPO_PUBLIC_DEMO_PRICES` fills the catalogue with round placeholder
 * figures so the ordering journey can be walked and driven. Without a mark
 * on the screen, a demo build is pixel-identical to a real one — and the
 * screenshots that come out of it get forwarded, pasted into a deck, and
 * quoted back to the restaurant as "the prices in the app".
 *
 * §15 forbids inventing menu prices. The fixture does not breach that while
 * it stays visibly a fixture; it breaches it the moment somebody cannot tell.
 * So this is deliberately hard to miss and deliberately not dismissible: a
 * banner somebody can close is a banner that is closed in every screenshot
 * anybody takes.
 *
 * It renders nothing at all in a normal build, so it costs an ordinary
 * customer one boolean.
 */
export function DemoPricesBanner() {
  if (!config.useDemoPrices) return null;

  return (
    <View style={styles.bar} testID="demo-prices-banner" accessibilityRole="alert">
      <Ionicons name="warning-outline" size={15} color={colors.brand.charcoal} />
      <Text variant="captionMedium" color={colors.brand.charcoal} style={styles.label}>
        Demo prices — illustrative only, not Pappas&apos;s menu
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    // Gold, with charcoal on it — the one pairing the palette measures at
    // 11.4:1, and the only place gold is allowed to carry a filled surface.
    backgroundColor: colors.accent,
  },
  label: { flexShrink: 1 },
});
