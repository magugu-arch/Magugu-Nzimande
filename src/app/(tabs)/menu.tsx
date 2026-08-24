import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { CategoryId, Product } from '@/types';
import { OfflineState, Chip, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { isOfflinePending } from '@/features/system/queryPhase';
import { useFavouritesStore } from '@/store/favouritesStore';
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { ProductRow } from '@/features/menu/components/ProductRow';
import { useCategories, useMenu, useProductSearch } from '@/features/menu/hooks';
import { POPULAR_SEARCH_TERMS } from '@/services/menuService';
import { colors, radius, spacing, typography, CART_BAR_HEIGHT, TAB_BAR_HEIGHT } from '@/theme';

/**
 * Menu tab — doubles as Menu Categories, Product Listing and Search.
 *
 * A `?category=` param deep-links straight to a category (Home tiles use it).
 * Typing in the field switches the list to search results without a route
 * change, which is what customers expect from a QSR app.
 */
export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();

  const categories = useCategories();
  const menu = useMenu();

  /**
   * The `?category=` deep link decides the category until the customer picks
   * one themselves. Derived rather than synced through an effect, so a tap on
   * Home lands on the right category in the first render — no filter flash.
   */
  const [chosenCategory, setChosenCategory] = useState<CategoryId | 'all' | 'favourites' | null>(
    null,
  );
  const activeCategory: CategoryId | 'all' | 'favourites' =
    chosenCategory ?? (params.category ? (params.category as CategoryId) : 'all');

  const favouriteIds = useFavouritesStore((state) => state.productIds);

  const [query, setQuery] = useState('');
  const search = useProductSearch(query);

  const isSearching = query.trim().length >= 2;

  const listedProducts: Product[] = useMemo(() => {
    if (isSearching) return search.data ?? [];
    const all = menu.data?.products ?? [];
    if (activeCategory === 'all') return all;
    if (activeCategory === 'favourites') {
      // Ordered by when they were hearted, newest first, not by menu order.
      return favouriteIds
        .map((id) => all.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product));
    }
    return all.filter((product) => product.categoryId === activeCategory);
  }, [isSearching, search.data, menu.data, activeCategory, favouriteIds]);

  const openProduct = useCallback(
    (product: Product) => router.push(`/product/${product.id}`),
    [router],
  );

  const sectionTitle = useMemo(() => {
    if (isSearching)
      return `${listedProducts.length} result${listedProducts.length === 1 ? '' : 's'}`;
    if (activeCategory === 'all') return 'Everything on the menu';
    if (activeCategory === 'favourites') return 'Your favourites';
    return categories.data?.find((category) => category.id === activeCategory)?.name ?? 'Menu';
  }, [isSearching, listedProducts.length, activeCategory, categories.data]);

  const renderBody = () => {
    if (menu.isLoading) return <LoadingState message="Loading the menu…" />;
    // Offline is not empty and not broken. Without this the screen falls
    // through to a factual claim it cannot back up.
    if (isOfflinePending(menu)) return <OfflineState onRetry={() => void menu.refetch()} />;
    if (menu.isError) return <ErrorState onRetry={() => void menu.refetch()} />;

    if (isSearching && search.isLoading) return <LoadingState message="Searching…" />;

    if (listedProducts.length === 0) {
      return isSearching ? (
        <EmptyState
          icon="search-outline"
          title="Nothing matched that"
          message={`We couldn't find anything for "${query.trim()}". Try a flavour, or browse the full menu.`}
          actionLabel="Clear search"
          onActionPress={() => setQuery('')}
          testID="menu-search-empty"
        />
      ) : activeCategory === 'favourites' ? (
        // Reachable only if every hearted product has since left the menu.
        <EmptyState
          icon="heart-outline"
          title="Nothing saved right now"
          message="The items you hearted are not on the menu at the moment. Browse what is."
          actionLabel="See the full menu"
          onActionPress={() => setChosenCategory('all')}
          testID="menu-favourites-empty"
        />
      ) : (
        <EmptyState
          title="Nothing here yet"
          message="This category is empty right now. Check back shortly."
        />
      );
    }

    return (
      <FlatList
        data={listedProducts}
        keyExtractor={(product) => product.id}
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            onPress={() => openProduct(item)}
            testID={`menu-row-${item.id}`}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: TAB_BAR_HEIGHT + CART_BAR_HEIGHT },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text variant="h2" style={styles.listTitle}>
            {sectionTitle}
          </Text>
        }
      />
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text variant="h1">Menu</Text>

        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chicken, sides, meals…"
            placeholderTextColor={colors.textDisabled}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search the menu"
            testID="menu-search-input"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {isSearching ? null : (
          <FlatList
            data={[
              { id: 'all' as const, name: 'All' },
              // Only offered once there is something in it: an empty filter is
              // a dead end, and a chip that leads nowhere teaches people to
              // stop tapping chips.
              ...(favouriteIds.length > 0
                ? [{ id: 'favourites' as const, name: `Favourites (${favouriteIds.length})` }]
                : []),
              ...(categories.data ?? []).map((category) => ({
                id: category.id,
                name: category.name,
              })),
            ]}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            renderItem={({ item }) => (
              <Chip
                label={item.name}
                selected={activeCategory === item.id}
                onPress={() => setChosenCategory(item.id)}
                testID={`menu-category-${item.id}`}
              />
            )}
          />
        )}

        {isSearching &&
        listedProducts.length === 0 &&
        !search.isLoading ? null : isSearching ? null : (
          <View style={styles.suggestions}>
            <Text variant="micro" color={colors.textMuted}>
              POPULAR SEARCHES
            </Text>
            <View style={styles.suggestionRow}>
              {POPULAR_SEARCH_TERMS.slice(0, 4).map((term) => (
                <Pressable
                  key={term}
                  onPress={() => setQuery(term)}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${term}`}
                  style={styles.suggestion}
                >
                  <Text variant="caption" color={colors.textSecondary}>
                    {term}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.body}>{renderBody()}</View>

      <StickyCartBar offsetBottom={TAB_BAR_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  suggestions: { gap: spacing.sm },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  body: { flex: 1, paddingHorizontal: spacing.gutter },
  listContent: { paddingTop: spacing.md },
  listTitle: { paddingBottom: spacing.sm },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
});
