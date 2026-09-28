import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  MenuCategoryTabs,
  MenuItemCard,
  SampleContentNote,
  WineCard,
  wineStyleLabel,
} from '@/components/mabu/Menu';
import {
  Chip,
  EmptyState,
  ErrorState,
  Header,
  LoadingBlock,
  Screen,
  Segmented,
  Text,
} from '@/components/ui';
import type { DietaryTag } from '@/domain/guests/types';
import { filterDishes, filterWines } from '@/domain/menu/search';
import type { WineItem } from '@/domain/menu/types';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { track } from '@/utils/analytics';

type Section = 'food' | 'dessert' | 'wine';

const DIETARY: { tag: DietaryTag; label: string }[] = [
  { tag: 'vegetarian', label: 'Vegetarian' },
  { tag: 'vegan', label: 'Vegan' },
  { tag: 'gluten-free', label: 'Gluten-free' },
  { tag: 'halal', label: 'Halal' },
];

const WINE_ORDER: WineItem['style'][] = ['sparkling', 'white', 'rose', 'red', 'dessert-fortified'];

/**
 * §8–10 Menu as editorial content: categories, search by name or ingredient,
 * verified dietary filters, signature highlights, sold-out states. Never a PDF.
 */
export default function Menu() {
  const params = useLocalSearchParams<{ section?: Section; focus?: string; signature?: string }>();
  const menu = useRpc('content.menu');
  const [section, setSection] = useState<Section>(params.section ?? 'food');
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [dietary, setDietary] = useState<DietaryTag[]>([]);
  const [signatureOnly, setSignatureOnly] = useState(params.signature === '1');

  useEffect(() => track('menu_viewed', { section }), [section]);

  const data = menu.data;
  const foodCategories = useMemo(
    () => [
      { id: 'all', label: 'All' },
      ...(data?.categories.filter((c) => c.section === 'food') ?? []),
    ],
    [data],
  );
  // Only offer dietary filters Mábu has actually verified on at least one dish (§10).
  const offeredDietary = DIETARY.filter((d) =>
    data?.dishes.some((x) => x.dietaryTags.includes(d.tag)),
  );

  const dishes = useMemo(() => {
    if (!data || section === 'wine') return [];
    const pool = data.dishes.filter((d) =>
      section === 'dessert' ? d.category === 'desserts' : d.category !== 'desserts',
    );
    return filterDishes(pool, {
      query,
      category: section === 'food' && category !== 'all' ? (category as never) : undefined,
      dietary,
      signatureOnly,
    });
  }, [data, section, category, query, dietary, signatureOnly]);

  const wines = useMemo(
    () => (data && section === 'wine' ? filterWines(data.wines, query) : []),
    [data, section, query],
  );

  // With no category chosen, food reads as a menu: grouped under category headings.
  const grouped =
    section === 'food' && category === 'all'
      ? foodCategories
          .filter((c) => c.id !== 'all')
          .map((c) => ({ label: c.label, items: dishes.filter((d) => d.category === c.id) }))
          .filter((g) => g.items.length)
      : [{ label: '', items: dishes }];

  return (
    <Screen header={<Header title="Menu" />} padded={false}>
      <View style={styles.pad}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus={params.focus === '1'}
            placeholder={section === 'wine' ? 'Wine, grape, region…' : 'Dish or ingredient…'}
            placeholderTextColor={colors.textSubtle}
            style={styles.searchInput}
            accessibilityLabel="Search the menu"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <Segmented
            value={section}
            onChange={(s) => {
              setSection(s);
              setCategory('all');
            }}
            options={[
              { value: 'food', label: 'Food' },
              { value: 'dessert', label: 'Desserts' },
              { value: 'wine', label: 'Wine' },
            ]}
          />
        </View>
      </View>

      {section === 'food' ? (
        <View style={{ marginTop: spacing.sm }}>
          <MenuCategoryTabs categories={foodCategories} active={category} onChange={setCategory} />
        </View>
      ) : null}

      {section !== 'wine' ? (
        <View style={[styles.pad, styles.filters]}>
          <Chip
            label="Signature"
            icon="star"
            selected={signatureOnly}
            onPress={() => setSignatureOnly(!signatureOnly)}
          />
          {offeredDietary.map((d) => (
            <Chip
              key={d.tag}
              label={d.label}
              selected={dietary.includes(d.tag)}
              onPress={() =>
                setDietary(
                  dietary.includes(d.tag)
                    ? dietary.filter((t) => t !== d.tag)
                    : [...dietary, d.tag],
                )
              }
            />
          ))}
        </View>
      ) : null}

      <View style={styles.pad}>
        {menu.isPending ? (
          <LoadingBlock />
        ) : menu.isError ? (
          <ErrorState message={errorMessage(menu.error)} onRetry={() => void menu.refetch()} />
        ) : section === 'wine' ? (
          wines.length ? (
            WINE_ORDER.map((style) => {
              const list = wines.filter((w) => w.style === style);
              if (!list.length) return null;
              return (
                <View key={style} style={{ marginTop: spacing.xl }}>
                  <Text variant="eyebrow" color="accent" accessibilityRole="header">
                    {wineStyleLabel(style)}
                  </Text>
                  {list.map((w) => (
                    <WineCard key={w.id} wine={w} />
                  ))}
                </View>
              );
            })
          ) : (
            <EmptyState
              icon="search"
              title="No wines match"
              body="Try a grape, a region or a producer."
            />
          )
        ) : dishes.length ? (
          grouped.map((g) => (
            <View key={g.label || 'list'} style={{ marginTop: spacing.lg }}>
              {g.label ? (
                <Text
                  variant="eyebrow"
                  color="accent"
                  accessibilityRole="header"
                  style={{ marginTop: spacing.md }}
                >
                  {g.label}
                </Text>
              ) : null}
              {g.items.map((d) => (
                <MenuItemCard key={d.id} dish={d} />
              ))}
            </View>
          ))
        ) : (
          <EmptyState
            icon="search"
            title="Nothing matches just yet"
            body={
              dietary.length
                ? 'Fewer filters may help — or ask our team, who will gladly adapt a dish.'
                : 'Try another dish or ingredient.'
            }
          />
        )}

        {data?.isSample ? (
          <View style={{ marginTop: spacing.xl }}>
            <SampleContentNote />
          </View>
        ) : null}
        {section !== 'wine' ? (
          <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.sm }}>
            Dietary labels show only what our kitchen has verified. Please tell us about any allergy
            when you book or order.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.gutter },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 16,
    minHeight: 48,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
