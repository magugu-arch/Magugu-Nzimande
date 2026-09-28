import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { BrandIcon, type BrandIconName } from '@/components/brand/BrandIcon';
import { DishFeatureCard, WineCard } from '@/components/mabu/Menu';
import { ErrorState, LoadingBlock, Photo, Screen, SectionTitle, Text } from '@/components/ui';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { colors, radius, spacing } from '@/theme';

const SECTIONS: { key: string; label: string; icon: BrandIconName; photo: string; href: string }[] =
  [
    {
      key: 'food',
      label: 'Food',
      icon: 'menu',
      photo: 'fillet-closeup',
      href: '/menu?section=food',
    },
    {
      key: 'dessert',
      label: 'Desserts',
      icon: 'vouchers',
      photo: 'chocolate-fondant',
      href: '/menu?section=dessert',
    },
    { key: 'wine', label: 'Wine', icon: 'wine', photo: 'wine-pour', href: '/menu?section=wine' },
  ];

/** §4 Discover — explore the Mábu world: food, desserts, wine, collections and stories. */
export default function Discover() {
  const { width } = useWindowDimensions();
  const menu = useRpc('content.menu');
  const home = useRpc('content.home');

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
          <Text variant="eyebrow" color="accent">
            Discover
          </Text>
          <Text variant="h1" accessibilityRole="header">
            The Mábu world
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/menu?focus=1')}
          accessibilityRole="search"
          accessibilityLabel="Search dishes, ingredients and wines"
          style={styles.search}
        >
          <Feather name="search" size={18} color={colors.textMuted} />
          <Text variant="body" color="textSubtle">
            Search dishes, ingredients, wines
          </Text>
        </Pressable>

        <View style={styles.sections}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => router.push(s.href as never)}
              accessibilityRole="button"
              accessibilityLabel={`${s.label} menu`}
              style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.8 }]}
            >
              <Photo photo={s.photo} label="" style={StyleSheet.absoluteFill} scrim="bottom" />
              <View style={styles.sectionLabel}>
                <BrandIcon name={s.icon} size={22} />
                <Text variant="eyebrow">{s.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {menu.isPending ? (
        <View style={styles.pad}>
          <LoadingBlock />
        </View>
      ) : menu.isError ? (
        <ErrorState message={errorMessage(menu.error)} onRetry={() => void menu.refetch()} />
      ) : (
        <>
          <View style={styles.pad}>
            <SectionTitle eyebrow="Curated" title="Collections" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {menu.data.collections.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/collection/${c.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}. ${c.description}`}
                style={({ pressed }) => [{ width: width * 0.72 }, pressed && { opacity: 0.8 }]}
              >
                <Photo photo={c.photo} label={c.name} style={styles.collectionPhoto} />
                <Text variant="h3" style={{ marginTop: spacing.md }}>
                  {c.name}
                </Text>
                <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
                  {c.description}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.pad}>
            <SectionTitle
              eyebrow="Signature"
              title="Chef's selection"
              action="All dishes"
              onAction={() => router.push('/menu?signature=1')}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {menu.data.dishes
              .filter((d) => d.signature || d.chefSelected)
              .map((d) => (
                <DishFeatureCard key={d.id} dish={d} width={180} />
              ))}
          </ScrollView>

          {home.data?.home.stories.length ? (
            <View style={styles.pad}>
              <SectionTitle eyebrow="Stories" title="Craft, fire and provenance" />
              {home.data.home.stories.slice(0, 2).map((s) => (
                <View key={s.id} style={styles.story}>
                  <Photo photo={s.photo} label={s.title} style={styles.storyPhoto} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text variant="eyebrow" color="accent">
                      {s.eyebrow}
                    </Text>
                    <Text variant="title">{s.title}</Text>
                    <Text variant="bodySmall" color="textMuted" numberOfLines={4}>
                      {s.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.pad}>
            <SectionTitle
              eyebrow="The cellar"
              title="Wines to pair"
              action="Wine list"
              onAction={() => router.push('/menu?section=wine')}
            />
            {menu.data.wines.slice(0, 3).map((w) => (
              <WineCard key={w.id} wine={w} />
            ))}

            <Pressable
              onPress={() => router.push('/gallery')}
              accessibilityRole="button"
              accessibilityLabel="Open the gallery"
              style={styles.gallery}
            >
              <Photo photo="dining-skyline" label="" style={StyleSheet.absoluteFill} scrim="full" />
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <BrandIcon name="gallery" size={30} />
                <Text variant="eyebrow">Gallery</Text>
              </View>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.gutter },
  search: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sections: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  sectionCard: {
    flex: 1,
    height: 150,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  sectionLabel: { padding: spacing.md, gap: spacing.xs, alignItems: 'flex-start' },
  rail: { gap: spacing.lg, paddingHorizontal: spacing.gutter },
  collectionPhoto: { height: 200, borderRadius: radius.md },
  story: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xl },
  storyPhoto: { width: 110, height: 130, borderRadius: radius.md },
  gallery: {
    marginTop: spacing.xxl,
    height: 150,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
});
