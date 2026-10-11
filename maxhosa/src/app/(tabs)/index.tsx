import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { Button } from '@/components/Button';
import { BagButton, SearchButton } from '@/components/HeaderActions';
import { Group, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { ProductCard } from '@/components/ProductCard';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingSkeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { LiveOrderCard } from '@/components/delivery/LiveOrderCard';
import { radius, space } from '@/design/tokens';
import { useCategories, useProducts, useStories } from '@/features/catalogue';
import { useShopFilters } from '@/store/shop';

const HERO_ASSET = 'mx-asset-10';

export default function Home() {
  const { width } = useWindowDimensions();
  const products = useProducts();
  const categories = useCategories();
  const stories = useStories();
  const setFilters = useShopFilters((s) => s.set);
  const resetFilters = useShopFilters((s) => s.reset);
  const heroHeight = Math.min(640, Math.max(460, width * 1.3));
  const cardWidth = Math.min(220, width * 0.44);

  const shopNew = () => {
    resetFilters();
    router.navigate('/shop');
  };

  return (
    <Screen
      title="Home"
      inTabs
      hero={
        <View style={StyleSheet.absoluteFill}>
          <AssetImage
            assetId={HERO_ASSET}
            style={StyleSheet.absoluteFill}
            contentPosition="top"
            priority="high"
          />
          <View style={styles.scrim} />
          <View style={styles.heroCopy}>
            <Text variant="eyebrow" color="white" style={{ opacity: 0.9 }}>
              Sample campaign · concept imagery
            </Text>
            <Text
              variant="display"
              color="white"
              style={{ marginVertical: space.m }}
              accessibilityRole="header"
            >
              A considered way to discover, wear and experience MAXHOSA AFRICA.
            </Text>
            <View style={styles.heroActions}>
              <Button
                label="Explore the collection"
                variant="light"
                onPress={() => router.push({ pathname: '/story/[id]', params: { id: 's1' } })}
              />
              <Button label="Shop new arrivals" variant="glass" onPress={shopNew} />
            </View>
          </View>
        </View>
      }
      heroHeight={heroHeight}
      wordmark="MAXHOSA AFRICA"
      left={<SearchButton onMedia />}
      right={<BagButton onMedia />}
    >
      <LiveOrderCard />

      <Section title="Shop by category">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {categories.data?.map((c) => (
            <PressableScale
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              onPress={() => {
                resetFilters();
                setFilters({ category: c.id });
                router.navigate('/shop');
              }}
              style={[styles.category, { width: width * 0.34 }]}
            >
              <AssetImage assetId={c.assetId} decorative style={StyleSheet.absoluteFill} />
              <View style={styles.categoryScrim} />
              <Text variant="callout" weight="600" color="white" style={styles.categoryLabel}>
                {c.label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      </Section>

      <Section title="New arrivals" action={{ label: 'See all', onPress: shopNew }}>
        {products.status === 'loading' ? <LoadingSkeleton rows={1} /> : null}
        {products.status === 'error' ? <ErrorState onRetry={products.retry} /> : null}
        {products.data ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {[...products.data]
              .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
              .slice(0, 6)
              .map((p) => (
                <ProductCard key={p.id} product={p} width={cardWidth} />
              ))}
          </ScrollView>
        ) : null}
      </Section>

      {stories.data?.[1] ? (
        <Section title="From the journal">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${stories.data[1].title}, placeholder copy`}
            pressedScale={0.98}
            onPress={() =>
              router.push({ pathname: '/story/[id]', params: { id: stories.data![1]!.id } })
            }
            style={{ paddingHorizontal: space.gutter }}
          >
            <AssetImage assetId={stories.data[1].heroAssetId} decorative style={styles.story} />
            <Text variant="eyebrow" color="ink3" style={{ marginTop: space.m }}>
              {stories.data[1].kind} · placeholder copy
            </Text>
            <Text variant="heading" style={{ marginTop: space.xs }}>
              {stories.data[1].title}
            </Text>
          </PressableScale>
        </Section>
      ) : null}

      <Section title="Private styling">
        <Group>
          <Row
            first
            icon="calendar-outline"
            title="Request a styling appointment"
            subtitle="Studio visit, personal or virtual styling — sample availability"
            onPress={() => router.push('/appointment')}
          />
        </Group>
      </Section>

      <Section
        title="Available now"
        action={{
          label: 'See all',
          onPress: () => {
            resetFilters();
            setFilters({ availability: 'available' });
            router.navigate('/shop');
          },
        }}
      >
        {products.data ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {products.data
              .filter((p) => p.variants.some((v) => v.stock === 'available'))
              .slice(0, 6)
              .map((p) => (
                <ProductCard key={p.id} product={p} width={cardWidth} />
              ))}
          </ScrollView>
        ) : null}
      </Section>

      <View style={styles.footer}>
        <Text variant="footnote" color="ink2">
          Images are concept assets, not approved product photography. Prices, sizes and stock are
          invented to show how the real catalogue will read.
        </Text>
      </View>
    </Screen>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {action ? (
          <PressableScale onPress={action.onPress} accessibilityRole="button" hitSlop={10}>
            <Text
              variant="subhead"
              weight="600"
              color="ink2"
              style={{ textDecorationLine: 'underline' }}
            >
              {action.label}
            </Text>
          </PressableScale>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.28)' },
  heroCopy: { position: 'absolute', left: space.gutter, right: space.gutter, bottom: space.xl },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  section: { paddingTop: space.xxl },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: space.gutter,
    paddingBottom: space.m,
  },
  rail: { paddingHorizontal: space.gutter, gap: space.m },
  category: {
    aspectRatio: 3 / 4,
    borderRadius: radius.m,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  categoryScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.22)' },
  categoryLabel: { padding: space.m },
  story: { aspectRatio: 4 / 5, borderRadius: radius.m },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.xxl },
});
