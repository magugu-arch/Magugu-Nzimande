import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui';
import { useCartStore } from '@/store/cartStore';
import { colors, elevation, radius, spacing, CART_BAR_HEIGHT } from '@/theme';
import { formatPrice } from '@/utils/money';

export interface StickyCartBarProps {
  /** Lifts the bar above a tab bar when both are on screen. */
  offsetBottom?: number;
}

/**
 * Persistent cart affordance (brief §5 — "keep the cart visually prominent").
 * Renders nothing when the basket is empty so it never nags.
 */
export const StickyCartBar = memo(function StickyCartBar({ offsetBottom = 0 }: StickyCartBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lines = useCartStore((state) => state.lines);
  const getTotals = useCartStore((state) => state.getTotals);
  const getItemCount = useCartStore((state) => state.getItemCount);

  if (lines.length === 0) return null;

  const itemCount = getItemCount();
  const totals = getTotals();

  return (
    <View
      style={[styles.wrapper, { bottom: offsetBottom + Math.max(insets.bottom, spacing.md) }]}
      pointerEvents="box-none"
    >
      <Pressable
        testID="sticky-cart-bar"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/cart');
        }}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${itemCount} item${itemCount === 1 ? '' : 's'}, ${formatPrice(totals.subtotal)}`}
        style={({ pressed }) => [styles.bar, pressed ? styles.pressed : null]}
      >
        <View style={styles.count}>
          <Text variant="captionMedium" color={colors.primary}>
            {itemCount}
          </Text>
        </View>

        <Text variant="bodyMedium" color={colors.onPrimary} style={styles.label}>
          View cart
        </Text>

        <Text variant="bodyMedium" color={colors.onPrimary}>
          {formatPrice(totals.subtotal)}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  bar: {
    height: CART_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...elevation.lg,
  },
  count: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPrimary,
  },
  label: { flex: 1 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
