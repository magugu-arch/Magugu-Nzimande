import { memo } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from './Text';

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
  return (
    <View style={styles.row}>
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
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ false: colors.neutral.grey300, true: colors.primary }}
        thumbColor={colors.neutral.white}
        ios_backgroundColor={colors.neutral.grey300}
      />
    </View>
  );
});

const styles = StyleSheet.create({
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
