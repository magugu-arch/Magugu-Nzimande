import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { BrandIcon, type BrandIconName } from '@/components/brand/BrandIcon';
import { Wordmark } from '@/components/brand/Wordmark';
import { EventCard } from '@/components/mabu/Cards';
import { MabuHero } from '@/components/mabu/MabuHero';
import { DishFeatureCard } from '@/components/mabu/Menu';
import {
  BrassRule,
  ErrorState,
  IconButton,
  LoadingBlock,
  Photo,
  PremiumButton,
  SectionTitle,
  Text,
} from '@/components/ui';
import { formatRand } from '@/domain/shared/format';
import { venueWeekday, venueDate } from '@/domain/shared/time';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { PageMeta } from '@/seo/PageMeta';
import { restaurantSchema } from '@/seo/structured';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';
import { track } from '@/utils/analytics';
import { callVenue, emailVenue, openDirections } from '@/utils/linking';

const QUICK: { icon: BrandIconName; label: string; href: string }[] = [
  { icon: 'reservations', label: 'Reservations', href: '/book' },
  { icon: 'menu', label: 'Menu', href: '/menu' },
  { icon: 'wine', label: 'Wine', href: '/menu?section=wine' },
  { icon: 'events', label: 'Events', href: '/events' },
  { icon: 'vouchers', label: 'Vouchers', href: '/vouchers/new' },
  { icon: 'location', label: 'Location', href: '/visit' },
  { icon: 'gallery', label: 'Gallery', href: '/gallery' },
  { icon: 'contact', label: 'Contact', href: '/support' },
];

/** §5 Home — convert intent into action. Book is one tap away; availability two. */
export default function Home() {
  const insets = useSafeAreaInsets();
  const signedIn = useSession((s) => !!s.actor);
  const home = useRpc('content.home');
  const inbox = useRpc('notifications.inbox', undefined, { enabled: signedIn });

  useEffect(() => track('home_viewed'), []);

  if (home.isPending) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingHorizontal: spacing.gutter }]}>
        <LoadingBlock lines={5} />
      </View>
    );
  }
  if (home.isError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.xxl }]}>
        <ErrorState message={errorMessage(home.error)} onRetry={() => void home.refetch()} />
      </View>
    );
  }

  const { home: content, venue, highlights, wineSpotlight, nextEvent, flags } = home.data;
  const todayHours = venue.hours.find((h) => h.day === venueWeekday(venueDate(new Date())));

  return (
    <View style={styles.root}>
      <PageMeta
        description={`${content.essenceTitle} Book a table at Mábu, Waterfall Wilds, Waterfall City, Midrand.`}
        path="/home"
        type="restaurant.restaurant"
        schema={[restaurantSchema(venue)]}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <MabuHero
          photo={content.heroPhoto}
          label="A signature fillet on a black stone plate in Mábu's candle-lit dining room"
          title={content.heroTitle}
        >
          {flags.bookingEnabled ? (
            <PremiumButton
              label="Book your table"
              onPress={() => router.push('/book')}
              testID="home-book"
            />
          ) : null}
          <PremiumButton
            label="Explore the menu"
            variant="secondary"
            onPress={() => router.push('/menu')}
          />
        </MabuHero>

        {/* Context strip: today's hours and where we are. */}
        <Pressable
          onPress={() => router.push('/visit')}
          accessibilityRole="button"
          accessibilityLabel={`Today ${todayHours?.hours ? `open ${todayHours.hours}` : 'closed'}. ${venue.area}. Opens visit details.`}
          style={styles.strip}
        >
          <View style={styles.stripItem}>
            <Feather name="clock" size={14} color={colors.accent} />
            <Text variant="bodySmall">Today {todayHours?.hours ?? 'closed'}</Text>
          </View>
          <View style={styles.stripDivider} />
          <View style={styles.stripItem}>
            <Feather name="map-pin" size={14} color={colors.accent} />
            <Text variant="bodySmall" numberOfLines={1}>
              {venue.area}
            </Text>
          </View>
        </Pressable>

        <View style={styles.pad}>
          {/* The Mábu Experience */}
          <View style={styles.essence}>
            <Text variant="eyebrow" color="accent">
              Our essence
            </Text>
            <Text variant="h1" accessibilityRole="header">
              {content.essenceTitle}
            </Text>
            <BrassRule />
            <Text variant="body" color="textMuted">
              {content.essenceBody}
            </Text>
          </View>

          <SectionTitle
            eyebrow="From the kitchen"
            title="Menu highlights"
            action="Full menu"
            onAction={() => router.push('/menu')}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {highlights.map((d) => (
            <DishFeatureCard key={d.id} dish={d} />
          ))}
        </ScrollView>

        <View style={styles.pad}>
          {flags.eventsEnabled && nextEvent ? (
            <>
              <SectionTitle
                eyebrow="Events & experiences"
                title="Coming up"
                action="All events"
                onAction={() => router.push('/events')}
              />
              <EventCard event={nextEvent} />
            </>
          ) : null}

          {wineSpotlight ? (
            <>
              <SectionTitle eyebrow="Wine spotlight" title="The perfect pairing" />
              <Pressable
                onPress={() => router.push(`/wine/${wineSpotlight.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${wineSpotlight.producer} ${wineSpotlight.name}. Pairs with our signature cuts.`}
                style={styles.wine}
              >
                <Photo
                  photo={wineSpotlight.photo ?? 'dish-wines'}
                  label={`A bottle of ${wineSpotlight.producer} ${wineSpotlight.name}`}
                  style={styles.winePhoto}
                />
                <View style={{ flex: 1, gap: spacing.xs, padding: spacing.lg }}>
                  <Text variant="eyebrow" color="textMuted">
                    {wineSpotlight.producer}
                  </Text>
                  <Text variant="h3">{wineSpotlight.name}</Text>
                  <Text variant="bodySmall" color="textMuted" numberOfLines={3}>
                    {wineSpotlight.tastingNotes}
                  </Text>
                  <Text variant="price" color="accent">
                    {formatRand(wineSpotlight.bottlePriceCents)}
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}

          {flags.vouchersEnabled ? (
            <Pressable
              onPress={() => router.push('/vouchers/new')}
              accessibilityRole="button"
              accessibilityLabel={`${content.voucherTitle} ${content.voucherBody}`}
              style={styles.voucher}
            >
              <Photo
                photo="texture-pattern"
                label=""
                style={StyleSheet.absoluteFill}
                scrim="full"
              />
              <View style={{ padding: spacing.xl, gap: spacing.sm }}>
                <BrandIcon name="vouchers" size={30} />
                <Text variant="h2">{content.voucherTitle}</Text>
                <Text variant="body" color="textMuted">
                  {content.voucherBody}
                </Text>
                <Text variant="eyebrow" color="accent" style={{ marginTop: spacing.sm }}>
                  Gift Mábu →
                </Text>
              </View>
            </Pressable>
          ) : null}

          {content.stories.map((story) => (
            <View key={story.id} style={styles.story}>
              <Photo photo={story.photo} label={story.title} style={styles.storyPhoto} />
              <Text variant="eyebrow" color="accent" style={{ marginTop: spacing.lg }}>
                {story.eyebrow}
              </Text>
              <Text variant="h2" style={{ marginTop: spacing.xs }}>
                {story.title}
              </Text>
              <Text variant="body" color="textMuted" style={{ marginTop: spacing.sm }}>
                {story.body}
              </Text>
              {story.id === 'story-gather' ? (
                <PremiumButton
                  label="Enquire about private functions"
                  variant="secondary"
                  style={{ marginTop: spacing.lg }}
                  onPress={() => router.push('/private-functions')}
                />
              ) : null}
            </View>
          ))}
        </View>

        {/* The board's brand-icons panel, as quick links. */}
        <View style={styles.quick}>
          <Text variant="eyebrow" color="accent" style={{ marginBottom: spacing.lg }}>
            Everything Mábu
          </Text>
          <View style={styles.quickGrid}>
            {QUICK.map((q) => (
              <Pressable
                key={q.label}
                onPress={() => router.push(q.href as never)}
                accessibilityRole="button"
                accessibilityLabel={q.label}
                style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.7 }]}
              >
                <BrandIcon name={q.icon} size={30} />
                <Text variant="eyebrow" style={{ fontSize: 9, letterSpacing: 1.4 }}>
                  {q.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.pad, styles.footer]}>
          <Wordmark size={36} />
          <View style={styles.footerActions}>
            {venue.phone ? (
              <IconButton
                icon="phone"
                label="Call Mábu"
                onPress={() => void callVenue(venue.phone!)}
              />
            ) : null}
            <IconButton
              icon="mail"
              label="Email reservations"
              onPress={() => void emailVenue(venue.email)}
            />
            <IconButton
              icon="navigation"
              label="Directions"
              onPress={() => void openDirections(venue.mapsQuery)}
            />
            {venue.instagram ? (
              <IconButton
                icon="instagram"
                label="Mábu on Instagram"
                onPress={() => void Linking.openURL(venue.instagram!)}
              />
            ) : null}
          </View>
          <Text variant="caption" color="textSubtle" align="center">
            {venue.email}
          </Text>
        </View>
      </ScrollView>

      {/* Floating chrome over the hero. */}
      <View style={[styles.chrome, { top: insets.top + spacing.md }]} pointerEvents="box-none">
        <Text variant="eyebrow" color="accent" style={styles.chromeMark}>
          MÁBU
        </Text>
        {signedIn ? (
          <IconButton
            icon="bell"
            label="Notifications"
            onPhoto
            badge={inbox.data?.unread}
            onPress={() => router.push('/notifications')}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: spacing.gutter },
  chrome: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chromeMark: { fontSize: 15, letterSpacing: 5 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    gap: spacing.md,
  },
  stripItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  stripDivider: { width: 1, height: 16, backgroundColor: colors.border },
  essence: { gap: spacing.md, marginTop: spacing.xxl },
  carousel: { gap: spacing.lg, paddingHorizontal: spacing.gutter },
  wine: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  winePhoto: { width: 118 },
  voucher: {
    marginTop: spacing.xxl,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  story: { marginTop: spacing.xxl },
  storyPhoto: { height: 240, borderRadius: radius.md },
  quick: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.forest,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.gutter,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xl },
  quickItem: { width: '25%', alignItems: 'center', gap: spacing.sm, minHeight: 64 },
  footer: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxxl },
  footerActions: { flexDirection: 'row', gap: spacing.md },
});
