import { memo } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, HIT_SLOP, MIN_TOUCH_TARGET } from '@/theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Selectable filter/segment pill. Used for categories, fulfilment and slots. */
export const Chip = memo(function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  style,
  testID,
}: ChipProps) {
  const textColor = disabled
    ? colors.textDisabled
    : selected
      ? colors.onPrimary
      : colors.textSecondary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      /**
       * The same padding, in a form the browser sweep can read.
       *
       * `hitSlop` is a no-op in React Native Web — only the legacy `Touchable`
       * ever honoured it — so a rendered chip's box is 39 tall and nothing in
       * the DOM says the real target is 55. `audit:screens` measures boxes and
       * would have to keep a hand-written list of which small ones are fine,
       * which is the kind of list that quietly stops matching the code.
       *
       * `dataSet` renders `data-slop-x` / `data-slop-y`, so the audit does the
       * arithmetic instead of trusting a list. It costs nothing on a handset:
       * `dataSet` is web-only and native ignores it.
       */
      dataSet={{ slopX: HIT_SLOP.left, slopY: HIT_SLOP.top }}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={textColor} /> : null}
      <Text variant="captionMedium" color={textColor}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET - 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pressed: { opacity: 0.75 },
});
