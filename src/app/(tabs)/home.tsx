import { useCallback } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FoodImage } from '@/components/food/FoodImage';
import { Badge, Button, Card, ProgressBar, Section, Text } from '@/components/ui';
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { useCategories } from '@/features/menu/hooks';
import { useActiveOrder } from '@/features/orders/hooks';
import { useLoyaltyAccount, usePromotions } from '@/features/rewards/hooks';
import { brand, venue } from '@/data/pappasContent';
import { fetchUpcomingReservation } from '@/services/reservationService';
import { statusCopy } from '@/services/orderService';
import { greetingFor, useAuthStore } from '@/store/authStore';
import {
  colors,
  radius,
  spacing,
  aspect,
  CART_BAR_HEIGHT,
  MIN_TOUCH_TARGET,
  TAB_BAR_HEIGHT,
} from '@/theme';
import { formatEtaWindow, formatLongDateNoYear, formatTime } from '@/utils/datetime';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMPAIGN_WIDTH = Math.min(300, SCREEN_WIDTH * 0.78);

/**
 * Home — brief §5.
 *
 * The brief sets out the whole screen, in order:
 *
 *   Hero            "one large, editorial food or venue image with one
 *                    dominant action. Never stack multiple competing CTAs."
 *   Quick actions    Reserve a table · Order now · View menu
 *   Marketing        a campaign carousel
 *   Rewards card     "without shouting discount language"
 *   Discover Pappas  food, cocktails, atmosphere, events
 *   Venue moment     the dining room and the window onto the square
 *   Personalised     welcome back, favourites, upcoming reservation
 *   Footer           address, hours, contact, directions, legal
 *
 * ── What changed from the screen this replaces ───────────────────────────
 *
 * The previous Home opened with "What are we eating?", a delivery/collection
 * toggle, a store picker and a promotional banner — a fast-food ordering
 * console, and a good one. §15's first guardrail rules it out for Pappas:
 * "Do not turn Pappas into a fast-food UI with dense grids, oversized red
 * CTAs or discount-first messaging."
 *
 * So the fulfilment toggle moves to where a customer is actually choosing how
 * to eat — the cart and checkout — rather than being the first decision the
 * app demands. A guest opening a restaurant app has usually not decided to
 * order at all; they are looking. Asking "delivery or collection?" before
 * showing them a single dish answers a question nobody asked.
 *
 * The single dominant action is Reserve. §4 puts Discover and Reserve ahead
 * of Order among the five customer jobs, and at a restaurant on Nelson
 * Mandela Square most guests eat in. Ordering is one tap away in the quick
 * actions, not buried.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const user = useAuthStore((state) => state.user);

  const categories = useCategories();
  const promotions = usePromotions();
  const loyalty = useLoyaltyAccount();
  const activeOrder = useActiveOrder();
  const reservation = useQuery({
    queryKey: ['reservations', 'upcoming'],
    queryFn: fetchUpcomingReservation,
  });

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const order = activeOrder.data;
  const booking = reservation.data;

  // §5's "Discover Pappas": food categories, cocktails, atmosphere. Three
  // editorial cards rather than a grid of ten — §12 warns against putting
  // large photo cards next to each other, and §6 asks for "editorial
  // separators and oversized section headings rather than dense grid
  // repetition".
  const discover = [
    {
      key: 'mezedakia' as const,
      eyebrow: 'To begin',
      title: 'Mezedakia',
      body: 'Small plates, meant for the middle of the table.',
      href: '/menu?category=mezedakia',
    },
    {
      key: 'cocktails' as const,
      eyebrow: 'The bar',
      title: 'Cocktails',
      body: 'Mediterranean botanicals, and the light going gold over the square.',
      href: '/menu?category=drinks',
    },
    {
      key: 'diningRoom' as const,
      eyebrow: 'The room',
      title: 'The Pappas experience',
      body: 'Olive trees, an open kitchen and a room built for long evenings.',
      href: '/about',
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_BAR_HEIGHT + CART_BAR_HEIGHT },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={categories.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        testID="home-screen"
      >
        {/*
          The hero. One image, one action.

          §5 is emphatic — "Never stack multiple competing CTAs" — so there is
          exactly one button here, and the quick actions below are a separate,
          quieter row rather than three more heroes.
        */}
        <View style={styles.hero}>
          <FoodImage
            assetKey="signatureMains"
            variant="hero"
            style={styles.heroImage}
            withScrim
            scrimIntensity="strong"
            aboveTheFold
          />
          <View style={[styles.heroTop, { paddingTop: insets.top + spacing.md }]}>
            <View>
              <Text variant="overline" color={colors.accent}>
                {brand.descriptor}
              </Text>
              <Text variant="h1" color={colors.textOnDark}>
                {brand.name}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/account/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={21} color={colors.textOnDark} />
            </Pressable>
          </View>

          <View style={styles.heroCopy}>
            <Text variant="caption" color={colors.textOnDarkMuted}>
              {greetingFor(user)}
            </Text>
            <Text variant="hero" color={colors.textOnDark}>
              Savour something unforgettable
            </Text>
            <Text variant="accent" color={colors.accent} style={styles.heroAccent}>
              {brand.script}
            </Text>
            <Button
              label="Reserve a table"
              onPress={() => router.push('/reserve')}
              style={styles.heroCta}
              testID="home-reserve-cta"
            />
          </View>
        </View>

        {/* §5's quick actions. Reserve is the hero above, so this row carries
            the other two rather than repeating it. */}
        <View style={styles.quickActions}>
          <QuickAction
            icon="restaurant-outline"
            label="View menu"
            onPress={() => router.push('/menu')}
          />
          <QuickAction
            icon="bag-handle-outline"
            label="Order now"
            onPress={() => router.push('/menu')}
          />
          <QuickAction
            icon="location-outline"
            label="Find us"
            onPress={() => router.push('/about')}
          />
        </View>

        {/*
          The active order, as §4's "persistent status card" — which is what
          replaces the Orders tab.
        */}
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
              {formatEtaWindow(order.etaMinutes)}
            </Text>
            <ProgressBar
              progress={
                order.timeline.filter((event) => event.occurredAt !== null).length /
                Math.max(1, order.timeline.length)
              }
              fillColor={colors.accent}
              trackColor="rgba(255,255,255,0.18)"
              style={styles.trackingProgress}
              accessibilityLabel="Order progress"
            />
          </Card>
        ) : null}

        {/*
          §5's "Your next visit". Above the marketing, deliberately: a guest
          with a table booked on Friday should see it before they see a
          campaign.
        */}
        {booking ? (
          <Card
            onPress={() => router.push(`/reserve/${booking.id}`)}
            accessibilityLabel="Your upcoming reservation"
            style={styles.reservationCard}
          >
            <View style={styles.reservationHeader}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text variant="overline" color={colors.primary}>
                Your next visit
              </Text>
            </View>
            <Text variant="h3">{formatLongDateNoYear(booking.scheduledFor)}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {formatTime(booking.scheduledFor)}
              {' · '}
              {booking.partySize === 1 ? '1 guest' : `${booking.partySize} guests`}
              {booking.status === 'requested' ? ' · awaiting confirmation' : ''}
            </Text>
          </Card>
        ) : null}

        {/* §5's marketing machine. */}
        {(promotions.data ?? []).length > 0 ? (
          <Section
            title="Happening at Pappas"
            bleed
            actionLabel="See all"
            onActionPress={() => router.push('/events')}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {(promotions.data ?? []).map((campaign) => (
                <Card
                  key={campaign.id}
                  padded={false}
                  onPress={() => router.push(`/offers/${campaign.id}`)}
                  accessibilityLabel={campaign.headline}
                  style={[styles.campaign, { width: CAMPAIGN_WIDTH }]}
                >
                  <FoodImage
                    assetKey={campaign.assetKey}
                    variant="card"
                    aspectRatio={3 / 2}
                    rounded="none"
                    aboveTheFold={false}
                  />
                  <View style={styles.campaignBody}>
                    <Text variant="h3" numberOfLines={2}>
                      {campaign.headline}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
                      {campaign.description}
                    </Text>
                  </View>
                </Card>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {/*
          The rewards card. §5: "show current recognition / points / next
          benefit without shouting discount language", and §8: "recognition,
          not coupon clipping".

          So it shows the member's standing and what it opens, not a points
          balance shouting at a discount. When the programme's economics are
          still unset — which they are, see `rewardsData.ts` — the progress
          bar is absent rather than drawn at zero, because a bar at zero
          implies a threshold nobody has set.
        */}
        <Section title="Pappas Rewards">
          <Card
            onPress={() => router.push('/rewards')}
            accessibilityLabel="Pappas Rewards"
            style={styles.rewards}
          >
            <View style={styles.rewardsHeader}>
              <Text variant="overline" color={colors.accentInk}>
                {loyalty.data?.tierName ?? 'Member'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <Text variant="h3">
              {loyalty.data && loyalty.data.lifetimePoints > 0
                ? 'Thank you for coming back'
                : 'Recognition, not coupons'}
            </Text>
            <Text variant="body" color={colors.textSecondary}>
              Your favourites remembered, invitations to member evenings, and a table held when we
              can.
            </Text>
            {loyalty.data && loyalty.data.pointsToNextTier > 0 ? (
              <ProgressBar
                progress={loyalty.data.tierProgress}
                fillColor={colors.accent}
                style={styles.rewardsProgress}
                accessibilityLabel="Progress to your next tier"
              />
            ) : null}
          </Card>
        </Section>

        {/* §5's "Discover Pappas". */}
        <Section title="Explore Pappas">
          <View style={styles.discover}>
            {discover.map((item) => (
              <Card
                key={item.key}
                padded={false}
                onPress={() => router.push(item.href as never)}
                accessibilityLabel={item.title}
                style={styles.discoverCard}
              >
                <FoodImage
                  assetKey={item.key}
                  variant="banner"
                  rounded="none"
                  aboveTheFold={false}
                />
                <View style={styles.discoverBody}>
                  <Text variant="overline" color={colors.secondary}>
                    {item.eyebrow}
                  </Text>
                  <Text variant="h2">{item.title}</Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {item.body}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </Section>

        {/* The menu, as an editorial row rather than a dense grid. */}
        <Section
          title="On the menu"
          bleed
          actionLabel="See all"
          onActionPress={() => router.push('/menu')}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {(categories.data ?? []).map((category) => (
              <Pressable
                key={category.id}
                onPress={() => router.push(`/menu?category=${category.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${category.name}. ${category.tagline}`}
                style={({ pressed }) => [styles.categoryTile, pressed ? styles.pressed : null]}
              >
                <FoodImage
                  assetKey={category.assetKey}
                  variant="card"
                  rounded="none"
                  withScrim
                  aboveTheFold={false}
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
          </ScrollView>
        </Section>

        {/*
          §5's venue moment: "use the Main Dining Room and Window/Square
          images for a location-led editorial module."
        */}
        <Pressable
          onPress={() => router.push('/about')}
          accessibilityRole="button"
          accessibilityLabel="About Pappas and finding us"
          style={styles.venue}
        >
          <FoodImage
            assetKey="squareView"
            variant="banner"
            rounded="none"
            withScrim
            scrimIntensity="strong"
            aboveTheFold={false}
          />
          <View style={styles.venueCopy}>
            <Text variant="overline" color={colors.accent}>
              {venue.landmark.value}
            </Text>
            <Text variant="h2" color={colors.textOnDark}>
              In the heart of Sandton
            </Text>
            <Text variant="caption" color={colors.textOnDarkMuted} numberOfLines={2}>
              A wall of glass onto the square, and a room that stays warm long after the light goes.
            </Text>
          </View>
        </Pressable>

        {/* §5's footer. */}
        <View style={styles.footer}>
          <Text variant="overline" color={colors.textMuted}>
            {brand.name} · {brand.descriptor}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {venue.landmark.value}, {venue.suburb.value}, {venue.city}
          </Text>
          <View style={styles.footerLinks}>
            <Button
              label="Find us"
              variant="text"
              size="sm"
              onPress={() => router.push('/about')}
            />
            <Button
              label="Contact"
              variant="text"
              size="sm"
              onPress={() => router.push('/account/contact')}
            />
            <Button
              label="Privacy"
              variant="text"
              size="sm"
              onPress={() => router.push('/account/legal')}
            />
          </View>
        </View>
      </ScrollView>

      <StickyCartBar />
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quickAction, pressed ? styles.pressed : null]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text variant="captionMedium" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xxl },

  hero: { position: 'relative' },
  heroImage: { width: '100%', aspectRatio: aspect.hero },
  heroTop: {
    position: 'absolute',
    top: 0,
    left: spacing.gutter,
    right: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroCopy: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.xxl,
    gap: spacing.xxs,
  },
  heroAccent: { marginTop: spacing.xs },
  heroCta: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
  },
  quickAction: {
    flex: 1,
    minHeight: 76,
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.9 },

  trackingCard: {
    marginHorizontal: spacing.gutter,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.surfaceDark,
    borderColor: colors.surfaceDark,
  },
  trackingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackingProgress: { marginTop: spacing.sm },

  reservationCard: {
    marginHorizontal: spacing.gutter,
    padding: spacing.lg,
    gap: spacing.xxs,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  reservationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  carousel: { gap: spacing.md, paddingHorizontal: spacing.gutter },
  campaign: { overflow: 'hidden', borderRadius: radius.lg },
  campaignBody: { padding: spacing.lg, gap: spacing.xxs },

  rewards: { marginHorizontal: spacing.gutter, padding: spacing.lg, gap: spacing.xs },
  rewardsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rewardsProgress: { marginTop: spacing.md },

  discover: { paddingHorizontal: spacing.gutter, gap: spacing.lg },
  discoverCard: { overflow: 'hidden', borderRadius: radius.lg },
  discoverBody: { padding: spacing.lg, gap: spacing.xxs },

  categoryTile: {
    width: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.imagePlaceholder,
  },
  categoryLabel: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },

  venue: { position: 'relative' },
  venueCopy: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.xl,
    gap: spacing.xxs,
  },

  footer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
});
