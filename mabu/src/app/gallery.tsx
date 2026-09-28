import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Header, Photo, Screen, Text } from '@/components/ui';
import { photoRegistry, type PhotoKey } from '@/content/photoRegistry';
import { spacing, radius } from '@/theme';

const CAPTIONS: Partial<Record<PhotoKey, string>> = {
  'dining-room': 'The main dining room beneath the timber chandeliers',
  'signature-steak': 'The Mábu fillet',
  'private-dining': 'A long table set for a private function',
  'bar-lounge': 'The bar and velvet banquettes',
  chandeliers: 'Hand-crafted timber chandeliers under the skylight',
  'floor-pattern': 'The patterned marble floor',
  'table-setting': 'Brass, marble and candlelight at the table',
  'dish-seafood': 'Kingklip, black rice and mussels',
  'dish-desserts': 'Dark chocolate and coconut',
  'dish-cocktails': 'A classic martini',
  'dish-wines': 'A glass of red, poured at the table',
  'dish-private-functions': 'Glassware set for an occasion',
};

/**
 * The board's GALLERY icon. Shows every supplied photograph — high-resolution
 * ones full width, the smaller brand-board crops in a grid so they are never
 * blown up beyond their resolution.
 */
export default function Gallery() {
  const { width } = useWindowDimensions();
  const full = width - spacing.gutter * 2;
  const keys = Object.keys(CAPTIONS) as PhotoKey[];
  const large = keys.filter((k) => photoRegistry[k].origin === 'photograph');
  const small = keys.filter((k) => photoRegistry[k].origin === 'brand-board');
  const half = (full - spacing.md) / 2;

  return (
    <Screen header={<Header title="Gallery" />}>
      <Text variant="h1" style={{ marginTop: spacing.md }} accessibilityRole="header">
        Timber, brass and stone
      </Text>
      <View style={{ gap: spacing.xl, marginTop: spacing.xl }}>
        {large.map((k) => (
          <View key={k} style={{ gap: spacing.sm }}>
            <Photo
              photo={k}
              label={CAPTIONS[k]!}
              style={{ width: full, height: full * 1.25, borderRadius: radius.md }}
            />
            <Text variant="caption" color="textMuted">
              {CAPTIONS[k]}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {small.map((k) => (
          <View key={k} style={{ width: half, gap: spacing.xs }}>
            <Photo
              photo={k}
              label={CAPTIONS[k]!}
              style={{ width: half, height: half, borderRadius: radius.md }}
            />
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {CAPTIONS[k]}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
});
