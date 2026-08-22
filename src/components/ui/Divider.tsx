import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from './Text';

export interface DividerProps {
  /** Renders centred text over the rule, e.g. "or". */
  label?: string;
  spacingSize?: keyof typeof spacing;
  style?: StyleProp<ViewStyle>;
}

export const Divider = memo(function Divider({
  label,
  spacingSize = 'lg',
  style,
}: DividerProps) {
  if (!label) {
    return <View style={[styles.rule, { marginVertical: spacing[spacingSize] }, style]} />;
  }

  return (
    <View style={[styles.labelled, { marginVertical: spacing[spacingSize] }, style]}>
      <View style={styles.flexRule} />
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
      <View style={styles.flexRule} />
    </View>
  );
});

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  flexRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  labelled: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
