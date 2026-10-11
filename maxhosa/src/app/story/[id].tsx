import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { BagButton } from '@/components/HeaderActions';
import { PressableScale } from '@/components/PressableScale';
import { ProductCard } from '@/components/ProductCard';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useProducts, useStories } from '@/features/catalogue';

const PLACEHOLDER =
  'Editorial placeholder — awaiting brand-approved copy. Collection stories, motif meanings and cultural context are published only from text MAXHOSA AFRICA has approved.';

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const stories = useStories();
  const products = useProducts();
  const story = stories.data?.find((s) => s.id === id);

  if (stories.status === 'ready' && !story) {
    return (
      <Screen title="Story">
        <EmptyState
          icon="book-outline"
          title="Story not found"
          body="It may have been unpublished."
        />
      </Screen>
    );
  }
  if (!story) return <Screen title="">{null}</Screen>;
  const heroHeight = Math.min(width * 1.25, 600);

  return (
    <Screen
      title={story.title}
      hero={
        <AssetImage assetId={story.heroAssetId} style={StyleSheet.absoluteFill} priority="high" />
      }
      heroHeight={heroHeight}
      right={<BagButton onMedia />}
    >
      <View style={styles.prose}>
        <Text variant="eyebrow" color="ink3">
          {story.kind} · concept imagery
        </Text>
        <Text variant="display" accessibilityRole="header" style={{ marginTop: space.s }}>
          {story.title}
        </Text>
        {/* Approved copy renders here when the provider supplies it; never generated. */}
        <View style={[styles.placeholder, { borderColor: colors.hairlineStrong }]}>
          <Text variant="callout" color="ink2">
            {story.body ?? PLACEHOLDER}
          </Text>
        </View>
      </View>
      <View style={styles.images}>
        {story.mediaAssetIds.map((a, i) => (
          <PressableScale
            key={a}
            pressedScale={0.98}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open image"
            onPress={() => router.push({ pathname: '/zoom/[asset]', params: { asset: a } })}
            style={i === 0 ? styles.full : styles.half}
          >
            <AssetImage assetId={a} style={styles.image} />
          </PressableScale>
        ))}
      </View>
      <Text variant="heading" accessibilityRole="header" style={styles.shopTitle}>
        Shop the story
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {story.productIds
          .map((pid) => products.data?.find((p) => p.id === pid))
          .filter((p) => !!p)
          .map((p) => (
            <ProductCard key={p.id} product={p} width={Math.min(200, width * 0.44)} />
          ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  prose: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  placeholder: {
    marginTop: space.l,
    padding: space.l,
    borderRadius: radius.m,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  images: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s,
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
  },
  full: { width: '100%' },
  half: { width: '48.6%' },
  image: { aspectRatio: 4 / 5, borderRadius: radius.s },
  shopTitle: { paddingHorizontal: space.gutter, paddingTop: space.xxl, paddingBottom: space.m },
  rail: { paddingHorizontal: space.gutter, gap: space.m },
});
