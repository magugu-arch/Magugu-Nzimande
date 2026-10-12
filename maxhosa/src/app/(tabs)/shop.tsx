import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip } from '@/components/Chip';
import { BagButton } from '@/components/HeaderActions';
import { MenuButton } from '@/components/MenuButton';
import { PressableScale } from '@/components/PressableScale';
import { ProductCard } from '@/components/ProductCard';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { activeFilterCount, filterProducts } from '@/domain/catalogue';
import { useCategories, useMarket, usePriceBands, useProducts } from '@/features/catalogue';
import { SORT_LABEL, useShopFilters } from '@/store/shop';

export default function Shop() {
  const { colors } = useTheme();
  const market = useMarket();
  const products = useProducts();
  const categories = useCategories();
  const bands = usePriceBands();
  const filters = useShopFilters((s) => s.filters);
  const setFilters = useShopFilters((s) => s.set);
  const resetFilters = useShopFilters((s) => s.reset);
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (focus === 'search') input.current?.focus();
  }, [focus]);

  const list = useMemo(
    () =>
      products.data && categories.data
        ? filterProducts(products.data, filters, categories.data, bands)
        : [],
    [products.data, categories.data, filters, bands],
  );
  const extra = activeFilterCount(filters);

  return (
    <Screen
      title="Shop"
      largeTitle
      subtitle={`Sample catalogue · prices in ${market.currencyCode}`}
      inTabs
      left={<MenuButton />}
      right={<BagButton />}
    >
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.sunk }]}>
          <Ionicons name="search" size={18} color={colors.ink3} />
          <TextInput
            ref={input}
            value={filters.query}
            onChangeText={(query) =>
              setFilters({
                query,
                sort: !query && filters.sort === 'relevance' ? 'new' : filters.sort,
              })
            }
            placeholder="Search name, code, colour"
            placeholderTextColor={colors.ink3}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search the shop"
            style={[styles.input, { color: colors.ink }]}
          />
          {filters.query ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setFilters({ query: '' })}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.ink3} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup"
      >
        <Chip
          kind="radio"
          label="All"
          selected={filters.category === 'all'}
          onPress={() => setFilters({ category: 'all' })}
        />
        {categories.data?.map((c) => (
          <Chip
            key={c.id}
            kind="radio"
            label={c.label}
            selected={filters.category === c.id}
            onPress={() => setFilters({ category: c.id })}
          />
        ))}
      </ScrollView>

      <View style={styles.resultBar}>
        <Text variant="footnote" color="ink3" accessibilityLiveRegion="polite">
          {list.length} {list.length === 1 ? 'piece' : 'pieces'} · {SORT_LABEL[filters.sort]}
        </Text>
        <Chip
          label={extra ? `Filter & sort · ${extra}` : 'Filter & sort'}
          icon="options-outline"
          selected={false}
          kind="checkbox"
          onPress={() => router.push('/filters')}
        />
      </View>

      {products.status === 'loading' ? <LoadingSkeleton /> : null}
      {products.status === 'error' ? <ErrorState onRetry={products.retry} /> : null}
      {products.status === 'ready' && !list.length ? (
        <EmptyState
          icon="search"
          title="No pieces match"
          body={
            filters.query
              ? `Nothing matches “${filters.query}” with these filters. Try fewer words or clear the filters.`
              : 'Nothing matches these filters.'
          }
          action={{ label: 'Clear search and filters', onPress: resetFilters }}
        />
      ) : null}
      <View style={styles.grid}>
        {pairs(list).map((row, i) => (
          <View key={i} style={styles.gridRow}>
            {row.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: space.gutter, paddingBottom: space.s },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: space.m,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  chips: { paddingHorizontal: space.gutter, gap: space.s, paddingVertical: space.xs },
  resultBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingVertical: space.m,
  },
  grid: { paddingHorizontal: space.gutter, gap: space.xl },
  gridRow: { flexDirection: 'row', gap: space.m },
});
