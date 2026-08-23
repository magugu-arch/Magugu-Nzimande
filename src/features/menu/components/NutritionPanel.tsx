import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NutritionInfo } from '@/types';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { groupDigits } from '@/utils/money';

export interface NutritionPanelProps {
  nutrition: NutritionInfo;
  /** What the numbers describe, e.g. "Serves 2 – 3". */
  serves: string;
}

/**
 * Nutrition per serving.
 *
 * The data was in the catalogue for all sixteen products from the start and
 * had never been rendered. South African R429 labelling makes this expected on
 * packaged food, and customers ask for it regardless — a chicken app that
 * cannot answer "how much protein" is missing something ordinary.
 *
 * Laid out as label-over-value pairs rather than a table: four columns of two
 * lines survives a narrow phone, where a real table would either wrap or
 * scroll. Figures are tabular so the four columns line up on the decimal.
 */
export const NutritionPanel = memo(function NutritionPanel({
  nutrition,
  serves,
}: NutritionPanelProps) {
  const rows: [string, string][] = [
    ['Energy', `${groupDigits(nutrition.kilojoules)} kJ`],
    ['Protein', `${nutrition.protein} g`],
    ['Carbs', `${nutrition.carbs} g`],
    ['Fat', `${nutrition.fat} g`],
  ];

  return (
    <View
      style={styles.panel}
      accessible
      // Read as one sentence. Four separate elements makes a screen reader
      // announce "Energy" and "2,480 kJ" as unrelated fragments.
      accessibilityLabel={`Nutrition, ${serves.toLowerCase()}. ${rows
        .map(([label, value]) => `${label} ${value}`)
        .join(', ')}.`}
      testID="nutrition-panel"
    >
      <View style={styles.header}>
        <Text variant="overline" color={colors.textMuted}>
          Nutrition
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {serves}
        </Text>
      </View>

      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {rows.map(([label, value]) => (
          <View key={label} style={styles.cell}>
            <Text variant="caption" color={colors.textMuted}>
              {label}
            </Text>
            <Text variant="bodyMedium" style={styles.figure}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1, gap: spacing.xxs },
  figure: { fontVariant: ['tabular-nums'] },
});
