import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { CartLine } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import { QuantityStepper, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { describeOptions } from '@/utils/cart';
import { formatPrice } from '@/utils/money';

export interface CartLineRowProps {
  line: CartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onEdit: () => void;
  testID?: string;
}

export const CartLineRow = memo(function CartLineRow({
  line,
  onQuantityChange,
  onRemove,
  onEdit,
  testID,
}: CartLineRowProps) {
  const optionSummary = describeOptions(line);

  return (
    <View style={styles.row} testID={testID}>
      <FoodImage
        assetKey={line.assetKey}
        variant="thumb"
        rounded="md"
        compactPlaceholder
        style={styles.image}
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyMedium" numberOfLines={2} style={styles.title}>
            {line.name}
          </Text>
          <Text variant="bodyMedium">{formatPrice(line.lineTotal)}</Text>
        </View>

        {optionSummary.length > 0 ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {optionSummary}
          </Text>
        ) : null}

        {line.specialInstructions ? (
          <View style={styles.note}>
            <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.textMuted} />
            {/* Unclamped. Two lines showed 38 pixels of 152 at 320pt, and the
                clamp compiles to `overflow: clip` on web, so it stopped
                mid-word without so much as an ellipsis. The 200-character cap
                on the input is what bounds this, not the row. */}
            <Text variant="caption" color={colors.textMuted} style={styles.noteText}>
              {line.specialInstructions}
            </Text>
          </View>
        ) : null}

        <View style={styles.controls}>
          <QuantityStepper
            quantity={line.quantity}
            onChange={onQuantityChange}
            onRemove={onRemove}
            size="sm"
            testID={`${testID}-stepper`}
          />

          <Pressable
            onPress={onEdit}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${line.name}`}
            style={styles.editButton}
          >
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text variant="caption" color={colors.primary}>
              Edit
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  image: { width: 76, borderRadius: radius.md },
  body: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { flex: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  noteText: { flex: 1 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
