import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
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
  IconButton,
  LoadingBlock,
  Photo,
  Screen,
  Text,
} from '@/components/ui';
import type { DietaryTag } from '@/domain/guests/types';
import { filterDishes, filterWines } from '@/domain/menu/search';
import type { WineItem } from '@/domain/menu/types';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { track } from '@/utils/analytics';

const DIETARY: { tag: DietaryTag; label: string }[] = [
  { tag: 'vegetarian', label: 'Vegetarian' },
  { tag: 'vegan', label: 'Vegan' },
  { tag: 'gluten-free', label: 'Gluten-free' },
  { tag: 'halal', label: 'Halal' },
];

const WINE_ORDER: WineItem['style'][] = ['sparkling', 'white', 'rose', 'red', 'dessert-fortified'];

const ALL = {
  id: 'all',
  label: 'All',
  tagline: 'Bold flavours, modern technique',
  heroPhoto: 'fillet-closeup',
  title: 'The Menu',
};

/**
 * §8–10 Menu as editorial content, in the layout of the supplied menu
 * designs: a hero per category, a rail of pill tabs, photographic dish
 * cards. Search covers names, ingredients and highlights across the whole
 * menu; dietary filters show only verified tags. Never a PDF.
 */
export default function Menu() {
  const params = useLocalSearchParams<{
    section?: 'food' | 'dessert' | 'wine';
    category?: string;
    focus?: string;
    signature?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const menu = useRpc('content.menu');
  const [category, setCategory] = useState<string>(
    params.category ??
      (params.section === 'wine' ? 'wine' : params.section === 'dessert' ? 'desserts' : 'all'),
  );
  const [searching, setSearching] = useState(params.focus === '1');
  const [query, setQuery] = useState('');
  const [dietary, setDietary] = useState<DietaryTag[]>([]);
  const [signatureOnly, setSignatureOnly] = useState(params.signature === '1');

  useEffect(() => track('menu_viewed', { category }), [category]);

  const data = menu.data;
  const tabs = useMemo(
    () => [{ id: ALL.id, label: ALL.label }, ...(data?.categories ?? [])],
    [data],
  );
  const meta = data?.categories.find((c) => c.id === category);
  const hero = meta
    ? { title: meta.label, tagline: meta.tagline, photo: meta.heroPhoto }
    : { title: ALL.title, tagline: ALL.tagline, photo: ALL.heroPhoto };
  const isWine = category === 'wine' && !query;
  const offeredDietary = DIETARY.filter((d) =>
    data?.dishes.some((x) => x.dietaryTags.includes(d.tag)),
  );

  const dishes = useMemo(() => {
    if (!data || isWine) return [];
    return filterDishes(data.dishes, {
      query,
      // A search spans the whole menu; a category only narrows browsing.
      category: query || category === 'all' ? undefined : (category as never),
      dietary,
      signatureOnly,
    });
  }, [data, isWine, category, query, dietary, signatureOnly]);
  const wines = useMemo(() => (data ? filterWines(data.wines, query) : []), [data, query]);

  const grouped =
    category === 'all' && !query
      ? (data?.categories ?? [])
          .filter((c) => c.id !== 'wine')
          .map((c) => ({ label: c.label, items: dishes.filter((d) => d.category === c.id) }))
          .filter((g) => g.items.length)
      : [{ label: '', items: dishes }];

  const heroHeight = Math.min(360, width * 0.82);

  return (
    <Screen padded={false} topInset={false}>
      {/* Category hero */}
      <View style={{ height: heroHeight + insets.top }}>
        <Animated.View
          key={hero.photo}
          entering={FadeIn.duration(400).reduceMotion(ReduceMotion.System)}
          style={styles.heroPhotoWrap}
        >
          <Photo photo={hero.photo} label="" style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* Obsidian on the left fading out over the photograph, as in the designs. */}
        <LinearGradient
          colors={[colors.background, 'rgba(11,11,11,0.55)', 'rgba(11,11,11,0)']}
          locations={[0.22, 0.48, 0.72]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(11,11,11,0)', colors.background]}
          locations={[0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.heroChrome, { top: insets.top + spacing.sm }]}>
          <IconButton
            icon="arrow-left"
            label="Back"
            onPhoto
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}
          />
          <Text variant="eyebrow" color="accent" style={styles.heroMark}>
            MÁBU
          </Text>
          <IconButton
            icon={searching ? 'x' : 'search'}
            label={searching ? 'Close search' : 'Search the menu'}
            onPhoto
            onPress={() => {
              if (searching) setQuery('');
              setSearching(!searching);
            }}
          />
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.heroRule} />
          <Text
            style={[styles.heroTitle, width < 360 && { fontSize: 40, lineHeight: 48 }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.2}
          >
            {query ? 'Search' : hero.title}
          </Text>
          <Text variant="eyebrow" color="accent" style={styles.heroTagline}>
            {query ? `Results for “${query}”` : hero.tagline}
          </Text>
        </View>
      </View>

      {searching ? (
        <View style={[styles.pad, styles.searchWrap]}>
          <View style={styles.search}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Dish, ingredient or wine…"
              placeholderTextColor={colors.textSubtle}
              style={styles.searchInput}
              accessibilityLabel="Search the menu"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      ) : null}

      <MenuCategoryTabs
        categories={tabs}
        active={category}
        onChange={(id) => {
          setCategory(id);
          setQuery('');
        }}
      />

      {!isWine ? (
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
        ) : isWine ? (
          WINE_ORDER.map((style) => {
            const list = wines.filter((w) => w.style === style);
            if (!list.length) return null;
            return (
              <View key={style} style={{ marginTop: spacing.lg }}>
                <Text variant="eyebrow" color="accent" accessibilityRole="header">
                  {wineStyleLabel(style)}
                </Text>
                {list.map((w) => (
                  <WineCard key={w.id} wine={w} />
                ))}
              </View>
            );
          })
        ) : dishes.length || (query && wines.length) ? (
          <>
            {grouped.map((g) => (
              <View key={g.label || 'list'} style={{ marginTop: spacing.md }}>
                {g.label ? (
                  <Text
                    variant="eyebrow"
                    color="accent"
                    accessibilityRole="header"
                    style={styles.group}
                  >
                    {g.label}
                  </Text>
                ) : null}
                {g.items.map((d) => (
                  <MenuItemCard key={d.id} dish={d} />
                ))}
              </View>
            ))}
            {query && wines.length ? (
              <View style={{ marginTop: spacing.lg }}>
                <Text variant="eyebrow" color="accent" accessibilityRole="header">
                  Wines
                </Text>
                {wines.map((w) => (
                  <WineCard key={w.id} wine={w} />
                ))}
              </View>
            ) : null}
          </>
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
        {!isWine ? (
          <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.sm }}>
            Dietary labels show only what our kitchen has verified. Please tell us about any allergy
            when you book.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.gutter },
  heroPhotoWrap: { position: 'absolute', top: 0, bottom: 0, right: 0, left: '28%' },
  heroChrome: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroMark: { fontSize: 18, letterSpacing: 6, lineHeight: 24 },
  heroCopy: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.xl,
  },
  heroRule: { width: 44, height: 2, backgroundColor: colors.accent, marginBottom: spacing.md },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: 48,
    lineHeight: 58,
    color: colors.text,
    maxWidth: '75%',
  },
  heroTagline: {
    letterSpacing: 3.2,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: '80%',
    marginTop: spacing.xs,
  },
  searchWrap: { marginBottom: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 16,
    minHeight: 48,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  group: { marginTop: spacing.md, marginBottom: spacing.md },
});
