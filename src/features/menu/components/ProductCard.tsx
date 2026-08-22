import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Product } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import { Badge, Text } from '@/components/ui';
import { colors, elevation, radius, spacing } from '@/theme';
import { formatPrice } from '@/utils/money';

export interface ProductCardProps {
  product: Product;
  onPress: () => void;
  /** Fixed width for horizontal carousels; omit inside a grid. */
  width?: number;
  testID?: string;
}

function primaryTag(product: Product): { label: string; tone: 'primary' | 'dark' } | null {
  if (product.tags.includes('new')) return { label: 'New', tone: 'primary' };
  if (product.tags.includes('bestseller')) return { label: 'Bestseller', tone: 'dark' };
  return null;
}

/**
 * Catalogue card (brief §9): food-focused 4:5 crop, no promotional typography
 * over the image — price and name sit below the photograph.
 */
export const ProductCard = memo(function ProductCard({
  product,
  onPress,
  width,
  testID,
}: ProductCardProps) {
  const tag = primaryTag(product);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, from ${formatPrice(product.basePrice)}`}
      accessibilityHint="Opens the product page"
      style={({ pressed }) => [
        styles.card,
        width !== undefined ? { width } : styles.flexible,
        pressed ? styles.pressed : null,
      ]}
    >
      <View>
        <FoodImage assetKey={product.assetKey} variant="card" rounded="none" />
        {tag ? <Badge label={tag.label} tone={tag.tone} style={styles.tag} /> : null}
        {product.spiceLevel >= 3 ? (
          <View style={styles.heat}>
            <Ionicons name="flame" size={13} color={colors.onPrimary} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text variant="h3" numberOfLines={1}>
          {product.name}
        </Text>
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={styles.blurb}>
          {product.shortDescription}
        </Text>

        <View style={styles.footer}>
          <Text variant="price" color={colors.primary}>
            {formatPrice(product.basePrice)}
          </Text>
          <View style={styles.addButton}>
            <Ionicons name="add" size={17} color={colors.onPrimary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.sm,
  },
  flexible: { flex: 1 },
  tag: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  heat: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  body: { padding: spacing.md, gap: spacing.xxs },
  blurb: { minHeight: 36 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
