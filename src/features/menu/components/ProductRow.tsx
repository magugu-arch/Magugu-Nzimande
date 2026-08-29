import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Product } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import { Badge, FavouriteButton, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { formatPrice } from '@/utils/money';

export interface ProductRowProps {
  product: Product;
  onPress: () => void;
  testID?: string;
}

/**
 * Dense list row for menu category listings and search results.
 *
 * The row and the heart are siblings rather than the heart sitting inside the
 * row. Nesting them reads fine in React Native — a `Pressable` inside a
 * `Pressable` is ordinary there — and on web it compiles to a `<button>` inside
 * a `<button>`, which is invalid HTML. React says so out loud: "In HTML,
 * <button> cannot be a descendant of <button>. This will cause a hydration
 * error." A screen reader has the same problem the parser does: two controls
 * at one position, and no way to say which one a tap meant.
 *
 * So the pressable covers the picture and the copy, the heart sits beside it,
 * and each has its own target and its own name.
 */
export const ProductRow = memo(function ProductRow({ product, onPress, testID }: ProductRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, from ${formatPrice(product.basePrice)}. ${product.shortDescription}`}
        style={({ pressed }) => [styles.main, pressed ? styles.pressed : null]}
      >
        <FoodImage
          assetKey={product.assetKey}
          variant="thumb"
          rounded="md"
          compactPlaceholder
          style={styles.image}
        />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="h3" numberOfLines={1} style={styles.title}>
              {product.name}
            </Text>
            {product.spiceLevel >= 3 ? (
              <Ionicons name="flame" size={15} color={colors.primary} />
            ) : null}
          </View>

          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {product.shortDescription}
          </Text>

          <View style={styles.footer}>
            <Text variant="price" color={colors.primary}>
              {formatPrice(product.basePrice)}
            </Text>
            {product.tags.includes('bestseller') ? (
              <Badge label="Bestseller" tone="neutral" />
            ) : product.tags.includes('new') ? (
              <Badge label="New" tone="primary" />
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* The row itself navigates, so the chevron said nothing the row did
          not. The heart is the one action here worth its own target. */}
      <FavouriteButton productId={product.id} productName={product.name} size="sm" />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  /** Everything the row's own tap covers: the picture and the copy. */
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  image: { width: 88, borderRadius: radius.md },
  body: { flex: 1, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flexShrink: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  pressed: { opacity: 0.7 },
});
