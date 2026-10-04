import { ScrollView, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
}

/** A filter or choice. Selected chips are navy; the state is announced. */
export function Chip({ label, selected = false, onPress, icon, testID }: ChipProps) {
  const fg = selected ? colors.white : colors.navy;
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.selected : styles.idle]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="captionStrong" color={fg}>
        {label}
      </Text>
    </Touchable>
  );
}

/** A horizontally scrolling row of chips that bleeds to the screen edge. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.bleed}
      accessibilityRole="tablist"
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          icon={o.icon}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
          testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    minHeight: 40,
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selected: { backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.navy },
  row: { gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingVertical: spacing.xs },
  bleed: { marginHorizontal: -spacing.gutter, flexGrow: 0 },
});
