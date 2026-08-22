import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { businessRules } from '@/constants/config';
import { colors, radius, spacing, MIN_TOUCH_TARGET } from '@/theme';
import { Text } from './Text';

export interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  /** Below the minimum the decrement button becomes a remove (trash) action. */
  min?: number;
  max?: number;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const QuantityStepper = memo(function QuantityStepper({
  quantity,
  onChange,
  min = 1,
  max = businessRules.maxQuantityPerLine,
  onRemove,
  size = 'md',
  style,
  testID,
}: QuantityStepperProps) {
  const dimension = size === 'sm' ? 32 : MIN_TOUCH_TARGET - 6;
  const iconSize = size === 'sm' ? 16 : 18;

  const decrementIsRemove = quantity <= min && onRemove !== undefined;
  const canDecrement = quantity > min || decrementIsRemove;
  const canIncrement = quantity < max;

  const handleDecrement = useCallback(() => {
    void Haptics.selectionAsync();
    if (decrementIsRemove) {
      onRemove?.();
      return;
    }
    if (quantity > min) onChange(quantity - 1);
  }, [decrementIsRemove, onRemove, quantity, min, onChange]);

  const handleIncrement = useCallback(() => {
    if (!canIncrement) return;
    void Haptics.selectionAsync();
    onChange(quantity + 1);
  }, [canIncrement, onChange, quantity]);

  return (
    <View testID={testID} style={[styles.container, style]}>
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel={decrementIsRemove ? 'Remove item' : 'Decrease quantity'}
        style={({ pressed }) => [
          styles.button,
          { width: dimension, height: dimension },
          pressed && canDecrement ? styles.pressed : null,
        ]}
      >
        <Ionicons
          name={decrementIsRemove ? 'trash-outline' : 'remove'}
          size={iconSize}
          color={canDecrement ? colors.textPrimary : colors.textDisabled}
        />
      </Pressable>

      <Text
        variant="bodyMedium"
        align="center"
        style={styles.value}
        accessibilityLabel={`Quantity ${quantity}`}
      >
        {quantity}
      </Text>

      <Pressable
        onPress={handleIncrement}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        accessibilityHint={canIncrement ? undefined : `Maximum ${max} per item`}
        style={({ pressed }) => [
          styles.button,
          styles.increment,
          { width: dimension, height: dimension },
          !canIncrement ? styles.incrementDisabled : null,
          pressed && canIncrement ? styles.pressed : null,
        ]}
      >
        <Ionicons
          name="add"
          size={iconSize}
          color={canIncrement ? colors.onPrimary : colors.textDisabled}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: spacing.xxs + 2,
    alignSelf: 'flex-start',
  },
  button: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  increment: { backgroundColor: colors.primary },
  incrementDisabled: { backgroundColor: colors.neutral.grey200 },
  value: { minWidth: 26 },
  pressed: { opacity: 0.7 },
});
