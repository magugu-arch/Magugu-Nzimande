import { useCallback } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Product } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import {
  Badge,
  Card,
  ErrorState,
  LoadingState,
  ProgressBar,
  Section,
  Text,
} from '@/components/ui';
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { FulfilmentSelector } from '@/features/home/components/FulfilmentSelector';
import { PromotionBanner } from '@/features/home/components/PromotionBanner';
import { ProductCard } from '@/features/menu/components/ProductCard';
import { useBestSellers, useCategories, usePopularProducts } from '@/features/menu/hooks';
import { useActiveOrder } from '@/features/orders/hooks';
import { useLoyaltyAccount, usePromotions } from '@/features/rewards/hooks';
import { statusCopy } from '@/services/orderService';
import { greetingFor, useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { absoluteFill, colors, radius, spacing, CART_BAR_HEIGHT, TAB_BAR_HEIGHT } from '@/theme';
import { formatEtaWindow } from '@/utils/datetime';

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
  const setCartFulfilment = useCartStore((state) => state.setFulfilmentType);

  const categories = useCategories();
  const popular = usePopularProducts(8);
  const bestSellers = useBestSellers(6);
  const promotions = usePromotions();
  const loyalty = useLoyaltyAccount();
  const activeOrder = useActiveOrder();

  const isLoading =
    categories.isLoading || popular.isLoading || promotions.isLoading || bestSellers.isLoading;
  const isError = categories.isError || popular.isError || promotions.isError;
  const isRefreshing =
    categories.isRefetching || popular.isRefetching || promotions.isRefetching;

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

        {/* Fulfilment + store */}
        <View style={styles.fulfilment}>
          <FulfilmentSelector value={fulfilmentType} onChange={handleFulfilmentChange} />

          <Pressable
            onPress={() => router.push('/checkout/store')}
            accessibilityRole="button"
            accessibilityLabel={
              store ? `Change store, currently ${store.name}` : 'Choose a store'
            }
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
                <FoodImage
                  assetKey={category.assetKey}
                  variant="card"
                  aspectRatio={3 / 2}
                  rounded="none"
                  withScrim
                />
                <View style={styles.categoryLabel}>
                  <Text variant="h3" color={colors.textOnDark}>
                    {category.name}
                  </Text>
                  <Text variant="micro" color={colors.textOnDarkMuted} numberOfLines={1}>
                    {category.tagline}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Section>

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
                <Text variant="h2">{loyalty.data.pointsBalance.toLocaleString('en-ZA')} points</Text>
              </View>
              <Badge label={loyalty.data.tierName} tone="dark" icon="star" />
            </View>

            <ProgressBar
              progress={loyalty.data.tierProgress}
              accessibilityLabel={`${Math.round(loyalty.data.tierProgress * 100)} percent to next tier`}
            />

            <Text variant="caption" color={colors.textSecondary}>
              {loyalty.data.nextTier
                ? `${loyalty.data.pointsToNextTier.toLocaleString('en-ZA')} points to ${
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
  content: { gap: spacing.xxl, paddingHorizontal: spacing.lg },
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
  categoryLabel: {
    ...absoluteFill,
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
