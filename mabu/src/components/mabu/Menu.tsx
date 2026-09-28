import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import type { Dish, WineItem } from '@/domain/menu/types';
import { WINE_STYLE_LABEL } from '@/domain/menu/types';
import { formatRand } from '@/domain/shared/format';
import { colors, HIT_SLOP, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { Photo, Text } from '../ui';

/** §25 MenuCategoryTabs — a horizontal rail; the active tab is underlined in brass. */
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
            onPress={() => {
              haptic.select();
              onChange(c.id);
            }}
            accessibilityRole="tab"
            aria-selected={selected}
            accessibilityLabel={c.label}
            style={styles.tab}
          >
            <Text variant="eyebrow" style={{ color: selected ? colors.accent : colors.textMuted }}>
              {c.label}
            </Text>
            <View style={[styles.tabLine, selected && styles.tabLineActive]} />
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

/** §25 MenuItemCard — an editorial row: photograph (or texture), name, copy, price. */
export function MenuItemCard({ dish, onPress }: { dish: Dish; onPress?: () => void }) {
  const badges = dishBadges(dish);
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/dish/${dish.id}`))}
      accessibilityRole="button"
      accessibilityLabel={`${dish.name}, ${formatRand(dish.priceCents)}${dish.available ? '' : ', sold out'}`}
      accessibilityHint="Opens the dish"
      style={({ pressed }) => [
        styles.item,
        pressed && styles.pressed,
        !dish.available && styles.soldOut,
      ]}
    >
      <Photo
        photo={dish.photo ?? 'texture-marble'}
        label={dish.photo ? dish.name : ''}
        style={styles.thumb}
      />
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
            {dish.name}
          </Text>
          <Text variant="price" color="accent">
            {formatRand(dish.priceCents)}
          </Text>
        </View>
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
      </View>
    </Pressable>
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
  tabs: { gap: spacing.xl, paddingHorizontal: spacing.gutter },
  tab: { paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center' },
  tabLine: { height: 1, marginTop: spacing.sm, backgroundColor: 'transparent' },
  tabLineActive: { backgroundColor: colors.accent },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  soldOut: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  thumb: { width: 84, height: 84, borderRadius: radius.md },
  itemBody: { flex: 1, gap: spacing.xs },
  itemTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
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
