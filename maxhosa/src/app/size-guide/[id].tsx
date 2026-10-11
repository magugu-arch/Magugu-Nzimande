import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Callout } from '@/components/Callout';
import { Chip } from '@/components/Chip';
import { SheetScaffold } from '@/components/SheetScaffold';
import { EmptyState } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useAsync } from '@/features/async';
import { providers } from '@/providers';

export default function SizeGuide() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = useAsync(() => providers.commerce.getSizeGuide(id), [id]);
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const { colors } = useTheme();
  const value = (v: string) =>
    unit === 'cm' ? v : (Math.round((Number(v) / 2.54) * 2) / 2).toFixed(1);

  if (guide.status === 'ready' && !guide.data) {
    return (
      <SheetScaffold title="Size guide">
        <EmptyState
          icon="resize-outline"
          title="No size guide yet"
          body="Ask a stylist for help with fit."
        />
      </SheetScaffold>
    );
  }
  const g = guide.data;
  return (
    <SheetScaffold title="Size guide">
      {g ? (
        <View style={{ gap: space.l }}>
          <Text variant="footnote" color="ink3">
            {g.title} · sample measurements in {unit === 'cm' ? 'centimetres' : 'inches'}
          </Text>
          <View style={styles.units} accessibilityRole="radiogroup" accessibilityLabel="Units">
            <Chip
              kind="radio"
              label="Centimetres"
              selected={unit === 'cm'}
              onPress={() => setUnit('cm')}
            />
            <Chip
              kind="radio"
              label="Inches"
              selected={unit === 'in'}
              onPress={() => setUnit('in')}
            />
          </View>
          <View accessibilityLabel="Size measurements table">
            {[g.columns, ...g.rows].map((row, r) => (
              <View key={r} style={[styles.row, { borderColor: colors.hairline }]}>
                {row.map((cell, c) => (
                  <Text
                    key={c}
                    variant={r === 0 ? 'caption' : 'callout'}
                    weight={r === 0 || c === 0 ? '700' : undefined}
                    color={r === 0 ? 'ink3' : 'ink'}
                    align={c === 0 ? 'left' : 'center'}
                    style={[styles.cell, { fontVariant: ['tabular-nums'] }]}
                  >
                    {r === 0 || c === 0 ? cell : value(cell)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          <Callout>
            These are sample numbers for the demo. MAXHOSA’s approved fit guidance and
            how-to-measure notes replace them. No guide can guarantee fit — if you are between
            sizes, ask a stylist.
          </Callout>
        </View>
      ) : null}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  units: { flexDirection: 'row', gap: space.s },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.s + 2,
  },
  cell: { flex: 1 },
});
