import { memo } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from './Text';
import { a11yState } from '@/utils/a11yState';

export interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

export const Toggle = memo(function Toggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}: ToggleProps) {
  /**
   * The whole row is the switch.
   *
   * It used to be only the switch, which renders 40x20 — under half the 44x44
   * of §22.9 in height, on the screen where somebody withdraws consent to
   * marketing and turns off the notifications they do not want. A control that
   * is hard to hit is a control people give up on, and giving up on that one
   * has a legal shape as well as an irritating one.
   *
   * The row is already 56 tall for the label beside it, so the target was there
   * all along and simply was not wired up. The `Switch` keeps drawing the state
   * and stops handling touches and accessibility: without `pointerEvents="none"`
   * a tap on the switch itself fires both handlers and lands back where it
   * started, and without hiding it from the reader the row is announced twice.
   */
  return (
    <Pressable
      testID={testID}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      {...a11yState({ checked: value, disabled }, 'switch')}
      style={styles.row}
    >
      <View style={styles.titles}>
        <Text variant="bodyMedium" color={disabled ? colors.textDisabled : colors.textPrimary}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color={colors.textSecondary}>
            {description}
          </Text>
        ) : null}
      </View>

      <Switch
        value={value}
        disabled={disabled}
        // `props.pointerEvents` is deprecated in React Native 0.86 — it belongs
        // in the style now, and warns on every render until it moves.
        style={styles.decorative}
        /**
         * Hidden from the reader four ways, because no two of them cover both
         * platforms. `accessibilityElementsHidden` is iOS,
         * `importantForAccessibility` is Android, and both are ignored by React
         * Native Web — which left the web build announcing an unnamed second
         * switch beside the named row, and the screen sweep caught it. `focusable`
         * keeps it out of the tab order that `aria-hidden` alone would leave it in.
         */
        aria-hidden
        focusable={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        trackColor={{ false: colors.neutral.grey300, true: colors.primary }}
        thumbColor={colors.neutral.white}
        ios_backgroundColor={colors.neutral.grey300}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  /** The switch only paints the state; the row around it takes the tap. */
  decorative: { pointerEvents: 'none' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  titles: { flex: 1, gap: spacing.xxs },
});
