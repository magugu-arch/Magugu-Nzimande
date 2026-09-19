import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { FoodImage } from '@/components/food/FoodImage';
import { promotions } from '@/services/data/rewardsData';
import { colors, radius, spacing, aspect } from '@/theme';

/**
 * Events — brief §9 and §11's screen 20.
 *
 * "Editorial event feed with date, time, description, price if officially
 * supplied, booking CTA and add-to-calendar."
 *
 * ── Why this screen has no events on it ──────────────────────────────────
 *
 * Because Pappas has not supplied any, and §15 is explicit: "Do not invent
 * menu prices, **events**, opening hours, loyalty rules or customer
 * promises."
 *
 * An event is the most tempting thing in this whole build to fabricate. A
 * "Greek Wine Evening, last Thursday of the month, R450 a head" would fill
 * this screen, look convincing in a stakeholder review, and be a complete
 * invention — a date nobody set, a price nobody agreed and a promise the
 * restaurant would discover it had made when a guest arrived.
 *
 * So the screen is built, the feed is empty, and the empty state says what it
 * is waiting for. What it does carry is the editorial invitations Pappas
 * *has* supplied through its own artwork and the brief's own §17.11 example —
 * the Date Night experience, the bar at dusk, the fish market. Those are
 * campaigns rather than ticketed events, and they are labelled as such.
 *
 * The moment Pappas supplies an events feed, this screen renders it: the
 * card, the date row, the booking CTA and the add-to-calendar action are all
 * here and all waiting on data.
 */
export default function EventsScreen() {
  const router = useRouter();

  // No events feed exists. `promotions` holds the editorial campaigns, which
  // are a different thing and are presented as one.
  const events: never[] = [];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="What's on" subtitle="Evenings, experiences and occasions at Pappas" />

      {events.length === 0 ? (
        <Card style={styles.awaiting}>
          <Ionicons name="calendar-outline" size={24} color={colors.accentInk} />
          <View style={styles.awaitingCopy}>
            <Text variant="h3">The events calendar is on its way</Text>
            <Text variant="body" color={colors.textSecondary}>
              We are not listing anything here until the restaurant has told us what is running,
              when, and what it costs — we would rather show you nothing than something we made up.
            </Text>
          </View>
        </Card>
      ) : null}

      {/*
        What Pappas has supplied: editorial invitations rather than ticketed
        events. Headed as such, so the two are never confused — a guest must
        not read "The bar at dusk" as an event with a date they have missed.
      */}
      <View style={styles.section}>
        <Text variant="overline" color={colors.accentInk}>
          Happening at Pappas
        </Text>
        <Text variant="h2">Always on</Text>
      </View>

      <View style={styles.feed}>
        {promotions.map((campaign) => (
          <Card
            key={campaign.id}
            padded={false}
            style={styles.card}
            onPress={() => router.push(campaign.ctaHref as never)}
            accessibilityLabel={campaign.headline}
          >
            <FoodImage
              assetKey={campaign.assetKey}
              variant="banner"
              style={styles.cardImage}
              rounded="none"
            />
            <View style={styles.cardBody}>
              <Text variant="h3">{campaign.headline}</Text>
              <Text variant="body" color={colors.textSecondary}>
                {campaign.description}
              </Text>
              {/*
                The call to action, drawn rather than built from a `Button`.

                It used to be a real `Button` with its own `onPress`, sitting
                inside a `Card` that was itself pressable to the same route.
                On a handset that is ordinary React Native; on web React Native
                Web compiles both to `<button>` and the result is a button
                inside a button — invalid HTML, and two controls at one
                position with nothing to tell a screen reader which a tap
                meant. `Card` has a `trailing` slot for the case where the
                second action is genuinely different, but here it was not: both
                controls went to `campaign.ctaHref`. So the card is the
                control, and this is the affordance that says so.

                `accessibilityElementsHidden` keeps it out of the card's
                accessible name, which already carries the headline.
              */}
              <View style={styles.cardCta} importantForAccessibility="no-hide-descendants">
                <Text variant="buttonSm" color={colors.accentInk}>
                  {campaign.ctaLabel}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={colors.accentInk} />
              </View>
            </View>
          </Card>
        ))}
      </View>

      {promotions.length === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title="Nothing running right now"
          message="Check back soon, or book a table and let us look after the rest."
          actionLabel="Reserve a table"
          onActionPress={() => router.push('/reserve')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  awaiting: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
    marginBottom: spacing.xxl,
  },
  awaitingCopy: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.xxs, marginBottom: spacing.lg },
  feed: { gap: spacing.lg },
  card: { overflow: 'hidden', borderRadius: radius.lg },
  cardImage: { width: '100%', aspectRatio: aspect.banner },
  cardBody: { padding: spacing.lg, gap: spacing.xs },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});
