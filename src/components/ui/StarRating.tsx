import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '@/theme';

export interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  max?: number;
  testID?: string;
}

/** Read-only when `onChange` is omitted. */
export const StarRating = memo(function StarRating({
  rating,
  onChange,
  size = 32,
  max = 5,
  testID,
}: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, index) => index + 1);
  const interactive = onChange !== undefined;

  return (
    <View
      testID={testID}
      style={styles.row}
      accessibilityRole={interactive ? 'adjustable' : 'image'}
      accessibilityLabel={`${rating} out of ${max} stars`}
    >
      {stars.map((value) => {
        const filled = value <= Math.round(rating);
        const icon = (
          <Ionicons
            name={filled ? 'star' : 'star-outline'}
            size={size}
            color={filled ? colors.primary : colors.borderStrong}
          />
        );

        if (!interactive) return <View key={value}>{icon}</View>;

        return (
          <Pressable
            key={value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(value);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${value} star${value === 1 ? '' : 's'}`}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pressed: { opacity: 0.6, transform: [{ scale: 0.92 }] },
});
