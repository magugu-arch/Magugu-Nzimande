import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import type { Dish, WineItem } from '@/domain/menu/types';
import { WINE_STYLE_LABEL } from '@/domain/menu/types';
import { formatRand } from '@/domain/shared/format';
import { colors, fontFamily, HIT_SLOP, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { useFavourite } from '@/features/useFavourite';
import { Photo, Text } from '../ui';

/**
 * §25 MenuCategoryTabs — a rail of pills; the active one is filled brass, as
 * in the supplied menu designs. Scrolls the active pill into view.
 */
export function MenuCategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  useEffect(() => {
    const x = offsets.current[active];
    if (x !== undefined)
      ref.current?.scrollTo({ x: Math.max(0, x - spacing.gutter), animated: true });
  }, [active]);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
      accessibilityRole="tablist"
    >
      {categories.map((c) => {
        const selected = c.id === active;
        return (
          <Pressable
            key={c.id}
            onLayout={(e) => {
              offsets.current[c.id] = e.nativeEvent.layout.x;
              // Measured after the first render: bring the initial selection into view.
              if (selected) {
                ref.current?.scrollTo({
                  x: Math.max(0, e.nativeEvent.layout.x - spacing.gutter),
                  animated: false,
                });
              }
            }}
            onPress={() => {
              haptic.select();
              onChange(c.id);
            }}
            accessibilityRole="tab"
            aria-selected={selected}
            accessibilityLabel={c.label}
            style={[styles.tab, selected && styles.tabActive]}
          >
            <Text
              variant="eyebrow"
              style={{ color: selected ? colors.textOnAccent : colors.text, letterSpacing: 1.6 }}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** §25 ExperienceBadge — small tracked capitals in a hairline frame. */
export function ExperienceBadge({
  label,
  tone = 'brass',
}: {
  label: string;
  tone?: 'brass' | 'muted' | 'copper';
}) {
  const color =
    tone === 'brass' ? colors.accent : tone === 'copper' ? colors.copper : colors.textMuted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text variant="eyebrow" style={{ color, fontSize: 9, lineHeight: 12, letterSpacing: 1.6 }}>
        {label}
      </Text>
    </View>
  );
}

export function dishBadges(d: Dish): { label: string; tone: 'brass' | 'muted' | 'copper' }[] {
  const out: { label: string; tone: 'brass' | 'muted' | 'copper' }[] = [];
  if (d.signature) out.push({ label: 'Signature', tone: 'brass' });
  else if (d.chefSelected) out.push({ label: 'Chef’s selection', tone: 'brass' });
  if (!d.available) out.push({ label: 'Sold out', tone: 'copper' });
  for (const t of d.dietaryTags)
    out.push({
      label: t === 'gluten-free' ? 'GF' : t === 'vegetarian' ? 'V' : t === 'vegan' ? 'VG' : t,
      tone: 'muted',
    });
  return out;
}

/**
 * §25 MenuItemCard, after the supplied menu designs: a rounded card with the
 * photograph on the left, the name in Playfair, key ingredients in tracked
 * capitals, a short description, the price in brass, and a round + that saves
 * the dish to Favourites. The dish area and the + are sibling buttons — one
 * button never sits inside another.
 */
export function MenuItemCard({ dish, onPress }: { dish: Dish; onPress?: () => void }) {
  // Cards stay as quiet as the designs: only sold-out and dietary marks here;
  // Signature and Chef's selection show on the dish itself.
  const badges = dishBadges(dish).filter((b) => b.tone !== 'brass');
  const fav = useFavourite('dish', dish.id);
  return (
    <View style={[styles.card, !dish.available && styles.soldOut]}>
      <Pressable
        onPress={onPress ?? (() => router.push(`/dish/${dish.id}`))}
        accessibilityRole="button"
        accessibilityLabel={`${dish.name}, ${formatRand(dish.priceCents)}${dish.available ? '' : ', sold out'}`}
        accessibilityHint="Opens the dish"
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        <Photo
          photo={dish.photo ?? 'texture-marble'}
          label={dish.photo ? dish.name : ''}
          style={styles.cardPhoto}
        />
        <View style={styles.cardBody}>
          <Text variant="h3" numberOfLines={2}>
            {dish.name}
          </Text>
          {dish.highlights?.length ? (
            <Text variant="eyebrow" color="textMuted" numberOfLines={1} style={styles.highlights}>
              {dish.highlights.join('  |  ')}
            </Text>
          ) : null}
          <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
            {dish.description}
          </Text>
          {badges.length ? (
            <View style={styles.badges}>
              {badges.map((b) => (
                <ExperienceBadge key={b.label} label={b.label} tone={b.tone} />
              ))}
            </View>
          ) : null}
          <Text variant="price" color="accent" style={styles.cardPrice}>
            {formatRand(dish.priceCents)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          haptic.select();
          fav.toggle();
        }}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={
          fav.saved ? `Remove ${dish.name} from favourites` : `Save ${dish.name} to favourites`
        }
        aria-pressed={fav.saved}
        style={[styles.plus, fav.saved && styles.plusOn]}
      >
        <Feather
          name={fav.saved ? 'check' : 'plus'}
          size={20}
          color={fav.saved ? colors.textOnAccent : colors.accent}
        />
      </Pressable>
    </View>
  );
}

/** A tall photographic card for carousels on Home and Discover. */
export function DishFeatureCard({ dish, width = 220 }: { dish: Dish; width?: number }) {
  return (
    <Pressable
      onPress={() => router.push(`/dish/${dish.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${dish.name}, ${formatRand(dish.priceCents)}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <Photo
        photo={dish.photo ?? 'texture-pattern'}
        label={dish.name}
        style={{ width, height: width * 1.2, borderRadius: radius.md }}
      />
      <Text variant="title" style={{ marginTop: spacing.md }} numberOfLines={1}>
        {dish.name}
      </Text>
      <Text variant="bodySmall" color="accent">
        {formatRand(dish.priceCents)}
      </Text>
    </Pressable>
  );
}

/** §25 WineCard. */
export function WineCard({ wine, onPress }: { wine: WineItem; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/wine/${wine.id}`))}
      accessibilityRole="button"
      accessibilityLabel={`${wine.producer} ${wine.name}, bottle ${formatRand(wine.bottlePriceCents)}${wine.glassPriceCents ? `, glass ${formatRand(wine.glassPriceCents)}` : ''}`}
      style={({ pressed }) => [styles.wine, pressed && styles.pressed]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="eyebrow" color="textMuted">
          {wine.producer}
        </Text>
        <Text variant="h3">
          {wine.name}
          {wine.vintage ? ` ${wine.vintage}` : ''}
        </Text>
        <Text variant="bodySmall" color="textMuted">
          {wine.varietal} · {wine.region}
        </Text>
      </View>
      <View style={styles.winePrices}>
        {wine.glassPriceCents ? (
          <Text variant="bodySmall" color="textMuted">
            Glass {formatRand(wine.glassPriceCents)}
          </Text>
        ) : null}
        <Text variant="price" color="accent">
          {formatRand(wine.bottlePriceCents)}
        </Text>
      </View>
    </Pressable>
  );
}

export function wineStyleLabel(style: WineItem['style']) {
  return WINE_STYLE_LABEL[style];
}

export function FavouriteButton({
  saved,
  onToggle,
  label,
  onPhoto,
}: {
  saved: boolean;
  onToggle: () => void;
  label: string;
  onPhoto?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onToggle();
      }}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove ${label} from favourites` : `Save ${label} to favourites`}
      aria-pressed={saved}
      style={[styles.fav, onPhoto && { backgroundColor: colors.scrim }]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M12 20.5 C12 20.5 3 14.8 3 8.8 C3 6 5.1 4 7.6 4 C9.4 4 11 5 12 6.6 C13 5 14.6 4 16.4 4 C18.9 4 21 6 21 8.8 C21 14.8 12 20.5 12 20.5 Z"
          stroke={saved ? colors.accent : colors.text}
          strokeWidth={1.5}
          fill={saved ? colors.accent : 'none'}
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

/** §28: sample seed content is labelled as such wherever it is shown. */
export function SampleContentNote({ what = 'menu' }: { what?: string }) {
  return (
    <View style={styles.sample} accessibilityRole="text">
      <Feather name="info" size={13} color={colors.textSubtle} />
      <Text variant="caption" color="textSubtle" style={{ flex: 1 }}>
        Sample {what} for preview. Final dishes, wines and prices will be supplied by Mábu.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: spacing.xs, paddingHorizontal: spacing.gutter, paddingVertical: spacing.sm },
  tab: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.accent },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  cardMain: { flex: 1, flexDirection: 'row', alignSelf: 'stretch' },
  cardPhoto: { width: '34%', minHeight: 140, alignSelf: 'stretch' },
  cardBody: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    gap: 4,
  },
  highlights: { fontSize: 9, lineHeight: 13, letterSpacing: 1.4 },
  cardPrice: { marginTop: 2, fontFamily: fontFamily.bodySemiBold },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginLeft: spacing.xs,
  },
  plusOn: { backgroundColor: colors.accent },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  soldOut: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  wine: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  winePrices: { alignItems: 'flex-end', gap: 2 },
  fav: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sample: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
});
