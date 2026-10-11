import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { SheetScaffold } from '@/components/SheetScaffold';
import { Text } from '@/components/Text';
import { space } from '@/design/tokens';
import { filterProducts } from '@/domain/catalogue';
import { useCategories, useProducts } from '@/features/catalogue';
import catalogue from '@data/sample-catalogue.json';
import {
  DEFAULT_FILTERS,
  SORT_LABEL,
  useShopFilters,
  type Availability,
  type ShopFilters,
  type SortId,
} from '@/store/shop';

/** A draft the customer can change freely; the shop only updates on "Show". */
export default function Filters() {
  const current = useShopFilters((s) => s.filters);
  const apply = useShopFilters((s) => s.set);
  const [draft, setDraft] = useState<ShopFilters>(current);
  const products = useProducts();
  const categories = useCategories();
  const count = useMemo(
    () =>
      products.data && categories.data
        ? filterProducts(products.data, draft, categories.data).length
        : 0,
    [products.data, categories.data, draft],
  );
  const sizes = useMemo(
    () => [...new Set(catalogue.products.flatMap((p) => p.sizes.map((s) => s.label)))],
    [],
  );
  const toggle = (key: 'sizes' | 'colours', value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  return (
    <SheetScaffold
      title="Filter and sort"
      footer={
        <View style={styles.footer}>
          <Button
            label="Clear"
            variant="secondary"
            onPress={() =>
              setDraft({ ...DEFAULT_FILTERS, query: draft.query, category: draft.category })
            }
          />
          <Button
            label={count ? `Show ${count} ${count === 1 ? 'piece' : 'pieces'}` : 'No pieces match'}
            style={{ flex: 1 }}
            onPress={() => {
              apply(draft);
              router.back();
            }}
          />
        </View>
      }
    >
      <Group title="Sort">
        {(Object.keys(SORT_LABEL) as SortId[])
          // "Best match" only means something when there is a search.
          .filter((s) => s !== 'relevance' || draft.query.trim())
          .map((s) => (
            <Chip
              key={s}
              kind="radio"
              label={SORT_LABEL[s]}
              selected={draft.sort === s}
              onPress={() => setDraft((d) => ({ ...d, sort: s }))}
            />
          ))}
      </Group>
      <Group title="Size available">
        {sizes.map((s) => (
          <Chip
            key={s}
            label={s}
            selected={draft.sizes.includes(s)}
            onPress={() => toggle('sizes', s)}
          />
        ))}
      </Group>
      <Group title="Colour">
        {catalogue.colours.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={draft.colours.includes(c)}
            onPress={() => toggle('colours', c)}
          />
        ))}
      </Group>
      <Group title="Availability">
        {(
          [
            ['any', 'Any'],
            ['available', 'Available now'],
            ['preorder', 'Pre-order'],
          ] as [Availability, string][]
        ).map(([a, label]) => (
          <Chip
            key={a}
            kind="radio"
            label={label}
            selected={draft.availability === a}
            onPress={() => setDraft((d) => ({ ...d, availability: a }))}
          />
        ))}
      </Group>
      <Text variant="footnote" color="ink3" style={{ marginTop: space.l }}>
        Facets reflect the sample catalogue. In production each one appears only when the commerce
        platform supplies that data.
      </Text>
    </SheetScaffold>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="footnote" weight="700" color="ink2" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.s, marginBottom: space.l },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  footer: { flexDirection: 'row', gap: space.s },
});
