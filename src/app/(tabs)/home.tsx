import { useCallback, useMemo } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Product } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import { Badge, Card, ErrorState, LoadingState, ProgressBar, Section, Text } from '@/components/ui';
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { FulfilmentSelector } from '@/features/home/components/FulfilmentSelector';
import { OpeningSoonBanner } from '@/features/stores/components/OpeningSoonBanner';
import { openingStatus } from '@/features/stores/opening';
import { useStoresForFulfilment } from '@/features/stores/hooks';
import { PromotionBanner } from '@/features/home/components/PromotionBanner';
import { ProductCard } from '@/features/menu/components/ProductCard';
import {
  useBestSellers,
  useCategories,
  usePopularProducts,
  useProductsByIds,
} from '@/features/menu/hooks';
import { useFavouritesStore } from '@/store/favouritesStore';
import { useActiveOrder } from '@/features/orders/hooks';
import { useLoyaltyAccount, usePromotions } from '@/features/rewards/hooks';
import { statusCopy } from '@/services/orderService';
import { greetingFor, useAuthStore } from '@/store/authStore';
import { tierProgressLabel } from '@/features/rewards/progressLabel';
import { useCartStore } from '@/store/cartStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import {
  absoluteFill,
  colors,
  radius,
  spacing,
  CART_BAR_HEIGHT,
  MIN_TOUCH_TARGET,
  TAB_BAR_HEIGHT,
} from '@/theme';
import { formatEtaWindow } from '@/utils/datetime';
import { groupDigits } from '@/utils/money';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(200, SCREEN_WIDTH * 0.52);
const HERO_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

/**
 * Home (brief §11): personalised greeting, fulfilment choice, promotional hero,
 * popular menu, best sellers, rewards summary and offers.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const user = useAuthStore((state) => state.user);
  const fulfilmentType = useFulfilmentStore((state) => state.fulfilmentType);
  const setFulfilmentType = useFulfilmentStore((state) => state.setFulfilmentType);
  const store = useFulfilmentStore((state) => state.store);

  // Whether anything is trading yet, across the whole network — not just the
  // branch this customer happens to have selected.
  const storesForType = useStoresForFulfilment(fulfilmentType);
  const opening = openingStatus(storesForType.data ?? []);
  const setCartFulfilment = useCartStore((state) => state.setFulfilmentType);

  const categories = useCategories();
  const popular = usePopularProducts(8);
  const bestSellers = useBestSellers(6);
  const promotions = usePromotions();
  const loyalty = useLoyaltyAccount();
  const activeOrder = useActiveOrder();

  const favouriteIds = useFavouritesStore((state) => state.productIds);
  const favouriteProducts = useProductsByIds(favouriteIds);
  // Keep the store's order — newest hearted first — rather than whatever order
  // the lookup came back in.
  const favourites = useMemo(() => {
    const found = favouriteProducts.data ?? [];
    return favouriteIds
      .map((id) => found.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product));
  }, [favouriteIds, favouriteProducts.data]);

  const isLoading =
    categories.isLoading || popular.isLoading || promotions.isLoading || bestSellers.isLoading;
  const isError = categories.isError || popular.isError || promotions.isError;
  const isRefreshing = categories.isRefetching || popular.isRefetching || promotions.isRefetching;

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const handleFulfilmentChange = useCallback(
    (next: typeof fulfilmentType) => {
      setFulfilmentType(next);
      // Keep the cart's pricing basis in step with the header selection.
      setCartFulfilment(next);
    },
    [setFulfilmentType, setCartFulfilment],
  );

  const openProduct = useCallback(
    (product: Product) => router.push(`/product/${product.id}`),
    [router],
  );

  if (isLoading) {
    return (
      <View style={[styles.stateContainer, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <LoadingState message="Warming up the fryers…" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.stateContainer, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ErrorState onRetry={handleRefresh} />
      </View>
    );
  }

  const heroPromotion = promotions.data?.[0];
  const otherPromotions = promotions.data?.slice(1) ?? [];
  const order = activeOrder.data;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: TAB_BAR_HEIGHT + CART_BAR_HEIGHT },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        testID="home-screen"
      >
        {/* Greeting + quick actions */}
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text variant="caption" color={colors.textSecondary}>
              {greetingFor(user)}
            </Text>
            <Text variant="h1">What are we eating?</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/account/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/menu')}
              accessibilityRole="button"
              accessibilityLabel="Search the menu"
              style={styles.iconButton}
            >
              <Ionicons name="search" size={21} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Not open yet — said here, before the menu invites an order that
            cannot be placed. */}
        {opening.nextOpening && !opening.anyTrading ? (
          <OpeningSoonBanner opensOn={opening.nextOpening} />
        ) : null}

        {/* Fulfilment + store */}
        <View style={styles.fulfilment}>
          <FulfilmentSelector value={fulfilmentType} onChange={handleFulfilmentChange} />

          <Pressable
            onPress={() => router.push('/checkout/store')}
            accessibilityRole="button"
            accessibilityLabel={store ? `Change store, currently ${store.name}` : 'Choose a store'}
            style={styles.storeRow}
          >
            <Ionicons name="location" size={17} color={colors.primary} />
            <Text variant="captionMedium" numberOfLines={1} style={styles.storeName}>
              {store ? store.name : 'Choose your nearest store'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Live order strip */}
        {order ? (
          <Card
            onPress={() => router.push(`/order/${order.id}`)}
            raised
            accessibilityLabel={`Track order ${order.reference}`}
            style={styles.trackingCard}
          >
            <View style={styles.trackingHeader}>
              <Badge label="Live order" tone="primary" icon="ellipse" />
              <Text variant="caption" color={colors.textOnDarkMuted}>
                {order.reference}
              </Text>
            </View>
            <Text variant="h3" color={colors.textOnDark}>
              {statusCopy(order.status).label}
            </Text>
            <Text variant="caption" color={colors.textOnDarkMuted}>
              {order.fulfilmentType === 'delivery' ? 'Arriving in' : 'Ready in'}{' '}
              {formatEtaWindow(order.etaMinutes)} · {order.storeName}
            </Text>
            <ProgressBar
              progress={
                order.timeline.filter((event) => event.occurredAt !== null).length /
                Math.max(1, order.timeline.length)
              }
              fillColor={colors.primary}
              trackColor="rgba(255,255,255,0.18)"
              style={styles.trackingProgress}
              accessibilityLabel="Order progress"
            />
          </Card>
        ) : null}

        {/* Promotional hero */}
        {heroPromotion ? (
          <PromotionBanner
            promotion={heroPromotion}
            width={HERO_WIDTH}
            onPress={() => router.push(`/offers/${heroPromotion.id}`)}
            testID="home-hero-promotion"
          />
        ) : null}

        {/* Categories */}
        <Section title="Browse the menu" subtitle="Everything on the bb.q board">
          <View style={styles.categoryGrid}>
            {(categories.data ?? []).map((category) => (
              <Pressable
                key={category.id}
                onPress={() => router.push(`/(tabs)/menu?category=${category.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${category.name}. ${category.tagline}`}
                style={({ pressed }) => [styles.categoryTile, pressed ? styles.pressed : null]}
              >
                {/*
                  The photograph sits *behind* the label rather than above it in
                  the flow, and the label is what gives the tile its height.

                  It was the other way round: a 3:2 image defined the box and an
                  absolutely-filled label floated over it, inside
                  `overflow: hidden`. That is fine until the text grows. At the
                  browser's largest text size `audit:text-scale` found every
                  tagline on this screen cut off — 32px of "Double-fried,
                  hand-glazed, unmistakably bb.q" gone — because the label had
                  outgrown a box whose height came from a picture.

                  `minHeight` keeps the tile the shape it was designed as while
                  the text is small enough to fit, and lets it grow past that
                  rather than clipping. The image covers whatever height results.
                */}
                <FoodImage
                  assetKey={category.assetKey}
                  variant="card"
                  rounded="none"
                  withScrim
                  style={styles.categoryImage}
                />
                <View style={styles.categoryLabel}>
                  <Text variant="h3" color={colors.textOnDark}>
                    {category.name}
                  </Text>
                  <Text variant="micro" color={colors.textOnDarkMuted}>
                    {category.tagline}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Favourites. Onboarding promises them "one tap away", and from here
            that has to mean here, not two taps into the Menu tab. Hidden until
            there is something in it — an empty row teaches people to scroll
            past that spot. */}
        {favourites.length > 0 ? (
          <Section
            title="Your favourites"
            subtitle="Straight back to what you liked"
            actionLabel="See all"
            onActionPress={() => router.push('/(tabs)/menu?category=favourites')}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {favourites.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  width={CARD_WIDTH}
                  onPress={() => openProduct(product)}
                />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {/* Popular */}
        <Section
          title="Popular right now"
          subtitle="What everyone else is ordering"
          actionLabel="See all"
          onActionPress={() => router.push('/(tabs)/menu')}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {(popular.data ?? []).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                width={CARD_WIDTH}
                onPress={() => openProduct(product)}
              />
            ))}
          </ScrollView>
        </Section>

        {/* Rewards summary */}
        {loyalty.data ? (
          <Card
            onPress={() => router.push('/(tabs)/rewards')}
            accessibilityLabel={`bb.q Rewards, ${loyalty.data.pointsBalance} points`}
            style={styles.rewardsCard}
          >
            <View style={styles.rewardsHeader}>
              <View style={styles.rewardsHeading}>
                <Text variant="overline" color={colors.primary}>
                  bb.q Rewards
                </Text>
                <Text variant="h2">{groupDigits(loyalty.data.pointsBalance)} points</Text>
              </View>
              <Badge label={loyalty.data.tierName} tone="dark" icon="star" />
            </View>

            <ProgressBar
              progress={loyalty.data.tierProgress}
              accessibilityLabel={tierProgressLabel(loyalty.data)}
            />

            <Text variant="caption" color={colors.textSecondary}>
              {loyalty.data.nextTier
                ? `${groupDigits(loyalty.data.pointsToNextTier)} points to ${
                    loyalty.data.nextTier.charAt(0).toUpperCase() + loyalty.data.nextTier.slice(1)
                  }`
                : "You're at our top tier. Enjoy it."}
            </Text>
          </Card>
        ) : null}

        {/* Best sellers */}
        <Section
          title="Best sellers"
          subtitle="Tried, tested and repeatedly reordered"
          actionLabel="See all"
          onActionPress={() => router.push('/(tabs)/menu')}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {(bestSellers.data ?? []).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                width={CARD_WIDTH}
                onPress={() => openProduct(product)}
              />
            ))}
          </ScrollView>
        </Section>

        {/* Offers */}
        {otherPromotions.length > 0 ? (
          <Section
            title="Offers for you"
            actionLabel="All offers"
            onActionPress={() => router.push('/offers')}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {otherPromotions.map((promotion) => (
                <PromotionBanner
                  key={promotion.id}
                  promotion={promotion}
                  size="compact"
                  width={CARD_WIDTH + 40}
                  onPress={() => router.push(`/offers/${promotion.id}`)}
                />
              ))}
            </ScrollView>
          </Section>
        ) : null}
      </ScrollView>

      <StickyCartBar offsetBottom={TAB_BAR_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stateContainer: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xxl, paddingHorizontal: spacing.gutter },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  greeting: { flex: 1, gap: spacing.xxs },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  fulfilment: { gap: spacing.md },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    // Wide but only 35 tall, which is the shape that reads as tappable and is
    // hardest to hit — the whole row is the target and none of it is tall
    // enough. This is how somebody changes which branch cooks their food.
    minHeight: MIN_TOUCH_TARGET,
  },
  storeName: { flex: 1 },
  trackingCard: { backgroundColor: colors.brand.black, gap: spacing.sm, borderWidth: 0 },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingProgress: { marginTop: spacing.xs },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  categoryTile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.brand.black,
  },
  categoryImage: absoluteFill,
  categoryLabel: {
    /*
      108 is what a 3:2 card comes to at the width these tiles take on a 320pt
      screen, so at normal text size the grid looks exactly as it did. Past that
      the label wins and the tile grows — which is the whole point.
    */
    minHeight: 108,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  carousel: { gap: spacing.md, paddingRight: spacing.lg },
  rewardsCard: { gap: spacing.md },
  rewardsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rewardsHeading: { flex: 1, gap: spacing.xxs },
  pressed: { opacity: 0.9 },
});
