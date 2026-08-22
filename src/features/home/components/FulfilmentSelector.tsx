import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { FulfilmentType } from '@/types';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export interface FulfilmentSelectorProps {
  value: FulfilmentType;
  onChange: (value: FulfilmentType) => void;
  compact?: boolean;
}

const OPTIONS: {
  value: FulfilmentType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'delivery', label: 'Delivery', icon: 'bicycle-outline' },
  { value: 'collection', label: 'Collection', icon: 'bag-handle-outline' },
  { value: 'dinein', label: 'Dine-in', icon: 'restaurant-outline' },
];

/** Delivery / Collection / Dine-in segmented control (brief §4). */
export const FulfilmentSelector = memo(function FulfilmentSelector({
  value,
  onChange,
  compact = false,
}: FulfilmentSelectorProps) {
  const handleSelect = useCallback(
    (next: FulfilmentType) => {
      if (next === value) return;
      void Haptics.selectionAsync();
      onChange(next);
    },
    [value, onChange],
  );

  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            testID={`fulfilment-${option.value}`}
            style={({ pressed }) => [
              styles.option,
              compact ? styles.optionCompact : null,
              selected ? styles.optionSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={compact ? 16 : 19}
              color={selected ? colors.onPrimary : colors.textSecondary}
            />
            <Text
              variant="captionMedium"
              color={selected ? colors.onPrimary : colors.textSecondary}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  optionCompact: { paddingVertical: spacing.sm + 2 },
  optionSelected: { backgroundColor: colors.primary },
  pressed: { opacity: 0.8 },
});
