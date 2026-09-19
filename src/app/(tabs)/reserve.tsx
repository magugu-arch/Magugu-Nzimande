import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Chip, LoadingState, Screen, Text } from '@/components/ui';
import { FoodImage } from '@/components/food/FoodImage';
import { venue } from '@/data/pappasContent';
import { fetchSlots, tradingHoursUnknown } from '@/services/reservationService';
import { useReservationStore } from '@/store/reservationStore';
import { reservationRules } from '@/types/reservation';
import { colors, radius, spacing, aspect } from '@/theme';
import { shortDayName, shortMonthName } from '@/utils/datetime';

/**
 * Reserve — brief §7's screens 15 and 16, the first two steps.
 *
 * "Reservation should feel like concierge service. Date → time → party size →
 * seating preference / occasion → details → confirmation. Keep the form
 * visually light. Use progressive disclosure rather than a long single page."
 *
 * ── How the steps are split ──────────────────────────────────────────────
 *
 * The brief lists six stages; this screen holds the first three and
 * `/reserve/details` holds the rest. That is not a compression of the brief —
 * it is what "progressive disclosure" means when the first three answers are
 * each one tap and mutually dependent.
 *
 * Date, party size and time belong on one screen because choosing any of them
 * changes what the others may be: a Sunday has different sittings from a
 * Tuesday, and a table for ten has fewer than a table for two. Splitting them
 * across three screens would make a guest walk forward and back to see the
 * consequence of a choice, which is the opposite of concierge. Seating,
 * occasion and contact details are independent of each other and of these,
 * and go on the second screen.
 *
 * The rule the split follows: one screen per set of choices that constrain
 * each other. Six screens of one field each is a form pretending to be a
 * journey.
 */
export default function ReserveScreen() {
  const router = useRouter();
  const draft = useReservationStore((state) => state.draft);
  const setDate = useReservationStore((state) => state.setDate);
  const setTime = useReservationStore((state) => state.setTime);
  const setPartySize = useReservationStore((state) => state.setPartySize);

  const [showAllDates, setShowAllDates] = useState(false);

  const dates = useMemo(() => upcomingDates(showAllDates ? 28 : 10), [showAllDates]);
  const partySizes = useMemo(
    () =>
      Array.from(
        { length: reservationRules.maxPartySize - reservationRules.minPartySize + 1 },
        (_, index) => reservationRules.minPartySize + index,
      ),
    [],
  );

  const selectedDate = draft.date ?? dates[0]?.iso;
  const partySize = draft.partySize ?? 2;

  const slots = useQuery({
    queryKey: ['reservation-slots', selectedDate, partySize],
    queryFn: () => fetchSlots(selectedDate!, partySize),
    enabled: Boolean(selectedDate),
  });

  const canContinue = Boolean(draft.date && draft.time && draft.partySize);

  const handleContinue = useCallback(() => {
    router.push('/reserve/details');
  }, [router]);

  return (
    <Screen scroll padded={false} edges={['top']} bottomInset={96}>
      {/*
        The hero. §5 asks for "one large, editorial food or venue image with
        one dominant action" and the same restraint applies here — the window
        table looking onto Nelson Mandela Square is what a guest is booking,
        so it is what they see.
      */}
      <View style={styles.hero}>
        <FoodImage
          assetKey="squareView"
          variant="hero"
          style={styles.heroImage}
          withScrim
          scrimIntensity="strong"
        />
        <View style={styles.heroCopy}>
          <Text variant="overline" color={colors.textOnDark}>
            Reserve a table
          </Text>
          <Text variant="hero" color={colors.textOnDark}>
            Join us on the Square
          </Text>
          <Text variant="body" color={colors.textOnDarkMuted} style={styles.heroBody}>
            {venue.story.value}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <StepHeading step={1} title="When would you like to join us?" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {dates.map((date) => (
            <DateTile
              key={date.iso}
              label={date.weekday}
              day={date.day}
              month={date.month}
              selected={draft.date === date.iso}
              onPress={() => setDate(date.iso)}
            />
          ))}
        </ScrollView>
        {!showAllDates ? (
          <Button
            label="See more dates"
            variant="tertiary"
            size="sm"
            onPress={() => setShowAllDates(true)}
            style={styles.moreDates}
          />
        ) : null}

        <StepHeading step={2} title="How many of you?" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {partySizes.map((size) => (
            <Chip
              key={size}
              label={size === 1 ? '1 guest' : `${size} guests`}
              selected={draft.partySize === size}
              onPress={() => setPartySize(size)}
            />
          ))}
        </ScrollView>
        {/*
          A party above the form's ceiling is an event, not a booking — §9's
          private dining enquiry. Offering it here rather than at the end
          means a guest planning a table of sixteen is not walked through
          four steps before being told.
        */}
        <Card style={styles.largeParty}>
          <Ionicons name="people-outline" size={20} color={colors.secondary} />
          <View style={styles.largePartyCopy}>
            <Text variant="captionMedium">More than {reservationRules.maxPartySize}?</Text>
            <Text variant="caption" color={colors.textMuted}>
              Larger tables are arranged through private dining.
            </Text>
          </View>
          <Button
            label="Enquire"
            variant="tertiary"
            size="sm"
            onPress={() => router.push('/functions')}
          />
        </Card>

        <StepHeading step={3} title="What time suits you?" />
        {/*
          The honest caveat. Nobody has supplied Pappas' trading hours, and
          §15 forbids inventing them — so the app offers a spread of sittings
          and says plainly that the restaurant confirms. That is true whatever
          the hours turn out to be: every request is confirmed by the
          restaurant. See `reservationService`.
        */}
        {tradingHoursUnknown() ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.secondary} />
            <Text variant="caption" color={colors.textSecondary} style={styles.noticeCopy}>
              Times are confirmed by the restaurant. We will come back to you shortly after you send
              your request.
            </Text>
          </View>
        ) : null}

        {slots.isPending ? (
          <LoadingState message="Finding sittings" />
        ) : (
          <View style={styles.slots}>
            {(slots.data ?? []).map((slot) => (
              <Chip
                key={slot.time}
                label={slot.time}
                selected={draft.time === slot.time}
                disabled={!slot.available}
                onPress={() => setTime(slot.time)}
                style={styles.slot}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button label="Continue" onPress={handleContinue} disabled={!canContinue} fullWidth />
      </View>
    </Screen>
  );
}

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <View style={styles.stepHeading}>
      <Text variant="overline" color={colors.accentInk}>
        Step {step}
      </Text>
      <Text variant="h2">{title}</Text>
    </View>
  );
}

function DateTile({
  label,
  day,
  month,
  selected,
  onPress,
}: {
  label: string;
  day: string;
  month: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${label} ${day} ${month}`}
      selected={selected}
      style={[styles.dateTile, selected ? styles.dateTileSelected : null]}
    >
      <Text variant="micro" color={selected ? colors.onPrimary : colors.textMuted}>
        {label.toUpperCase()}
      </Text>
      <Text variant="h2" color={selected ? colors.onPrimary : colors.textPrimary}>
        {day}
      </Text>
      <Text variant="micro" color={selected ? colors.onPrimary : colors.textMuted}>
        {month.toUpperCase()}
      </Text>
    </Card>
  );
}

/** The next `count` days, starting today. */
function upcomingDates(
  count: number,
): { iso: string; weekday: string; day: string; month: string }[] {
  const out: { iso: string; weekday: string; day: string; month: string }[] = [];
  const start = new Date();
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    out.push({
      iso: date.toISOString().slice(0, 10),
      // The repository's own formatters, never Intl: Hermes ships without
      // full ICU on some builds and `toLocaleDateString` then silently falls
      // back to US formatting. See `utils/datetime`.
      weekday: shortDayName(date),
      day: String(date.getDate()),
      month: shortMonthName(date),
    });
  }
  return out;
}

const styles = StyleSheet.create({
  hero: { position: 'relative' },
  heroImage: { width: '100%', aspectRatio: aspect.hero },
  heroCopy: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.xxl,
    gap: spacing.xs,
  },
  heroBody: { marginTop: spacing.sm },
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl, gap: spacing.md },
  stepHeading: { marginTop: spacing.lg, gap: spacing.xxs },
  row: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.gutter },
  moreDates: { alignSelf: 'flex-start' },
  dateTile: {
    minWidth: 68,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  dateTileSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  largeParty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.secondarySoft,
    borderColor: colors.secondarySoft,
  },
  largePartyCopy: { flex: 1, gap: spacing.xxs },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  noticeCopy: { flex: 1 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { minWidth: 76 },
  footer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
