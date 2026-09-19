import { useCallback } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
            {/*
              The wordmark alone, with no descriptor under it.

              `GREEK & MEDITERRANEAN` used to sit here in 11px letterspaced
              gold, directly on the photograph, and measured 1.95:1 against
              the 4.5:1 that small text owes §32. Nothing reasonable rescues
              it: gold on a lit plate needs about 0.80 of black over the
              picture to clear the threshold, which is the "heavy gradient"
              §12 rules out, and going white only reaches the 3.39:1 the
              wordmark itself gets — fine for 26pt display type, still short
              for 11px.

              So the line comes off the photograph rather than the photograph
              being destroyed to carry it. `PAPPAS` passes on its own, the
              descriptor is already set under the mark in `BrandMark`
              wherever there is a solid ground for it, and it closes the
              screen in the footer.
            */}
            <Text variant="h1" color={colors.textOnDark}>
              {brand.name}
            </Text>
            <Pressable
              onPress={() => router.push('/account/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={21} color={colors.textOnDark} />
            </Pressable>
          </View>

          {/*
            The copy sits on its own scrim, not on the photograph.

            Measured rather than judged by eye: with only `heroScrim` under it,
            the worst pixels behind each run gave 1.58:1 for the script line,
            2.59:1 for the headline and 1.76:1 for the greeting, against §32's
            3:1 for display type and 4.5:1 for body. The medians were fine —
            7:1 and better — which is exactly why looking at it was not enough.
            The failures are scattered bright spots, a lemon and a white plate
            rim, and no gradient tuned to thirds can find those.

            So this is a gradient shaped to the copy rather than to the frame:
            transparent where it meets the photograph, near-solid by the time
            it reaches the first line of text. `locations` puts the whole fade
            in the block's padded top, so the photograph keeps its bottom edge
            and every run below sits on charcoal.
          */}
          <LinearGradient
            colors={['rgba(26,26,26,0)', 'rgba(26,26,26,0.84)', 'rgba(26,26,26,0.96)']}
            locations={[0, 0.26, 1]}
            style={styles.heroCopyScrim}
          />

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
                  {/*
                    Two lines, not one.

                    At one line every tagline on the carousel truncated in the
                    middle of a word — "Small plates. Big m…", "Fresh.
                    Vibrant. Medi…" — which is worse than showing nothing: an
                    ellipsis mid-phrase reads as a rendering fault, and the
                    half-word it leaves is the part that carried no meaning.
                    These taglines are two short sentences; the second line is
                    all they ever needed.
                  */}
                  <Text variant="micro" color={colors.textOnDarkMuted} numberOfLines={2}>
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
            <Text variant="overline" color={colors.textOnDark}>
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

  /**
   * The hero sizes to its own content, with §5's editorial 4:3 as a floor.
   *
   * It used to be a fixed 4:3 frame with both the wordmark row and the copy
   * block absolutely positioned inside it — the first pinned to the top, the
   * second to the bottom. Neither knew about the other, and 4:3 at 390pt is
   * 292pt of height for a safe-area inset, a letterspaced lockup, a greeting,
   * a two-line display headline, a script line and a button. They collided:
   * "Savour something unforgettable" ran up through PAPPAS, and the descriptor
   * disappeared behind the notifications bell.
   *
   * Worse on a handset than in a browser, which is why it survived the screen
   * sweep — the web build has `insets.top` of 0 and a phone has 47, so every
   * real device pushed the lockup 47pt further into the headline. Overlap is
   * not overflow, so nothing measuring the right-hand edge could see it.
   *
   * Laying the two out in flow and letting the container grow makes the
   * collision impossible to reintroduce: a longer greeting, a bigger accessible
   * font or a taller notch adds height rather than stealing it from the
   * headline. `minHeight` keeps the editorial proportion when the copy is
   * short, which is the case the 4:3 was there for.
   */
  hero: {
    position: 'relative',
    /**
     * Taller than the 4:3 this started at, because the copy needs a scrim and
     * a scrim needs the photograph to have somewhere to be.
     *
     * At 4:3 — 292pt on a 390pt handset — the lockup takes 57 and the copy
     * block 180, leaving about 55pt of visible photograph. Darkening the copy
     * enough to read would have left a charcoal panel with a sliver of food
     * above it. At 1:1.08 there is a real editorial frame between the two.
     */
    minHeight: SCREEN_WIDTH * 1.08,
    // Lockup at the top, copy at the foot of the frame. The photograph is out
    // of flow behind both, so it takes no part in this.
    justifyContent: 'space-between',
  },
  /**
   * The photograph is the hero's background, so it fills whatever height the
   * copy above settles on. With all four edges pinned both dimensions are
   * already determined, so `FoodImage`'s own aspect ratio has nothing left to
   * constrain and steps aside.
   */
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
  },
  heroCopy: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
    gap: spacing.xxs,
  },
  /** Behind the copy, exactly its size. Paint, so it never eats the CTA. */
  heroCopyScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '42%',
    pointerEvents: 'none',
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
  /**
   * `gap`, which was missing, and is the whole bug.
   *
   * A `text` Button draws no background and no horizontal padding, so three
   * of them in a row with nothing between them rendered as one run of
   * underlined capitals: "FIND USCONTACTPRIVACY". It looked like a single
   * broken link, and there was no way to tell where to press for which.
   *
   * `columnGap` and `rowGap` separately because this wraps at 320pt: the
   * horizontal gap wants to be generous enough to read as three controls,
   * the vertical one only wants to clear the line.
   */
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.xxl,
    rowGap: spacing.sm,
    marginTop: spacing.sm,
  },
});
