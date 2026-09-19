import { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Divider, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { FoodImage } from '@/components/food/FoodImage';
import { venue } from '@/data/pappasContent';
import { factText, isVerified } from '@/data/businessInput';
import { cancelReservation, fetchReservation } from '@/services/reservationService';
import type { Reservation } from '@/types/reservation';
import { colors, radius, spacing, aspect } from '@/theme';
import { formatLongDate, formatTime } from '@/utils/datetime';

/**
 * Reservation confirmation — brief §7, screen 17.
 *
 * "Confirmation is a premium moment: reservation details, map, add to
 * calendar, change / cancel and optional pre-order or event add-on."
 *
 * ── The word this screen will not use ────────────────────────────────────
 *
 * "Confirmed", until Pappas has confirmed it.
 *
 * A request arrives here as `requested`, and the screen says so: the request
 * is with the restaurant, and they will come back. §15 forbids inventing
 * customer promises, and "Table confirmed for Friday at 7" against an app
 * with no booking system behind it is the most consequential promise this
 * product could fabricate — the failure mode is a guest standing in the
 * doorway of a full restaurant.
 *
 * So the premium moment is real and the certainty is honest. Those are not in
 * tension: a good concierge tells you they are checking, and then tells you.
 */
export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const reservation = useQuery({
    queryKey: ['reservation', id],
    queryFn: () => fetchReservation(id!),
    enabled: Boolean(id),
  });

  const cancel = useMutation({
    mutationFn: () => cancelReservation(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservation', id] });
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const openDirections = useCallback(() => {
    // The square, not the restaurant's own pin — nobody has supplied that, and
    // `pappasContent` says so. Nelson Mandela Square is a published landmark
    // and gets a guest to the door; a fabricated pin would get them to a
    // doorway that is not ours.
    const query = encodeURIComponent(`${venue.name}, Nelson Mandela Square, Sandton`);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  }, []);

  if (reservation.isPending) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingState message="Finding your reservation" />
      </Screen>
    );
  }

  if (reservation.isError || !reservation.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ErrorState
          title="We could not find that reservation"
          message="It may have been cancelled. Your reservations are in your account."
          onRetry={() => void reservation.refetch()}
        />
      </Screen>
    );
  }

  const booking = reservation.data;
  const when = new Date(booking.scheduledFor);
  const tone = toneFor(booking);
  // Narrowed once, so the button and its handler cannot disagree about
  // whether there is a number to call.
  const phoneNumber = isVerified(venue.phone) ? venue.phone.value : null;

  return (
    <Screen scroll padded={false} edges={['top']} bottomInset={spacing.xxl}>
      <View style={styles.hero}>
        <FoodImage
          assetKey="diningRoom"
          variant="hero"
          style={styles.heroImage}
          withScrim
          scrimIntensity="strong"
        />
        <View style={styles.heroCopy}>
          <Text variant="accent" color={colors.accent}>
            We look forward to it
          </Text>
          <Text variant="hero" color={colors.textOnDark}>
            {tone.headline}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* The status, in words rather than a colour alone — §13. */}
        <Card style={[styles.status, { backgroundColor: tone.background }]}>
          <Ionicons name={tone.icon} size={22} color={tone.ink} />
          <View style={styles.statusCopy}>
            <Text variant="captionMedium" color={tone.ink}>
              {tone.label}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {tone.detail}
            </Text>
          </View>
        </Card>

        <Card style={styles.detailCard}>
          <Row icon="calendar-outline" label="Date">
            {formatLongDate(when)}
          </Row>
          <Divider />
          <Row icon="time-outline" label="Time">
            {formatTime(when)}
          </Row>
          <Divider />
          <Row icon="people-outline" label="Party">
            {booking.partySize === 1 ? '1 guest' : `${booking.partySize} guests`}
          </Row>
          {booking.seating !== 'no-preference' ? (
            <>
              <Divider />
              <Row icon="location-outline" label="Seating">
                {seatingLabel(booking.seating)}
              </Row>
            </>
          ) : null}
          {booking.occasion !== 'none' ? (
            <>
              <Divider />
              <Row icon="sparkles-outline" label="Occasion">
                {occasionLabel(booking.occasion)}
              </Row>
            </>
          ) : null}
          <Divider />
          <Row icon="person-outline" label="Under">
            {booking.guestName}
          </Row>
          <Divider />
          <Row icon="bookmark-outline" label="Reference">
            {booking.reference}
          </Row>
        </Card>

        {booking.notes ? (
          <Card style={styles.notes}>
            <Text variant="overline" color={colors.textMuted}>
              Your note to us
            </Text>
            <Text variant="body">{booking.notes}</Text>
          </Card>
        ) : null}

        <Card style={styles.venue}>
          <Text variant="overline" color={colors.accentInk}>
            Finding us
          </Text>
          <Text variant="h3">{venue.name}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {factText(venue.addressLine, (line) => line)}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {venue.landmark.value}, {venue.suburb.value}
          </Text>
          <View style={styles.venueActions}>
            <Button label="Directions" variant="secondary" size="sm" onPress={openDirections} />
            {/*
              The call button only exists when there is a number to call.
              A `tel:` link to a placeholder is worse than no button: it
              fails silently, on the screen a guest reaches for when they
              are already standing outside.
            */}
            {phoneNumber ? (
              <Button
                label="Call the restaurant"
                variant="secondary"
                size="sm"
                onPress={() => void Linking.openURL(`tel:${phoneNumber}`)}
              />
            ) : null}
          </View>
        </Card>

        {booking.status === 'requested' || booking.status === 'confirmed' ? (
          <Button
            label="Cancel reservation"
            variant="text"
            onPress={() => cancel.mutate()}
            loading={cancel.isPending}
            fullWidth
          />
        ) : null}

        <Button
          label="Back to Pappas"
          variant="tertiary"
          onPress={() => router.replace('/home')}
          fullWidth
        />
      </View>
    </Screen>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text variant="caption" color={colors.textMuted} style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue}>
        {children}
      </Text>
    </View>
  );
}

interface Tone {
  headline: string;
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  ink: string;
  background: string;
}

function toneFor(reservation: Reservation): Tone {
  switch (reservation.status) {
    case 'requested':
      return {
        headline: 'Your request is with us',
        label: 'Awaiting confirmation',
        detail: 'The restaurant will confirm shortly. We will let you know as soon as they do.',
        icon: 'hourglass-outline',
        ink: colors.status.warning,
        background: colors.status.warningSoft,
      };
    case 'confirmed':
      return {
        headline: 'Your table is booked',
        label: 'Confirmed by Pappas',
        detail: 'We are expecting you. Please let us know if anything changes.',
        icon: 'checkmark-circle-outline',
        ink: colors.status.success,
        background: colors.status.successSoft,
      };
    case 'declined':
      return {
        headline: 'We could not take this one',
        label: 'Not available',
        detail:
          reservation.declineReason ??
          'That sitting is full. Try another time and we will do our best.',
        icon: 'close-circle-outline',
        ink: colors.status.error,
        background: colors.status.errorSoft,
      };
    case 'cancelled':
      return {
        headline: 'This reservation is cancelled',
        label: 'Cancelled',
        detail: 'Nothing was charged. We hope to see you another time.',
        icon: 'remove-circle-outline',
        ink: colors.textSecondary,
        background: colors.surfaceSunken,
      };
    case 'completed':
      return {
        headline: 'Thank you for joining us',
        label: 'Visited',
        detail: 'We hope it was a good evening.',
        icon: 'heart-outline',
        ink: colors.status.success,
        background: colors.status.successSoft,
      };
    case 'no-show':
      return {
        headline: 'We missed you',
        label: 'Not attended',
        detail: 'The table was held. Do let us know next time if plans change.',
        icon: 'alert-circle-outline',
        ink: colors.status.warning,
        background: colors.status.warningSoft,
      };
  }
}

function seatingLabel(seating: Reservation['seating']): string {
  const labels: Record<Reservation['seating'], string> = {
    'no-preference': 'No preference',
    'dining-room': 'Dining room',
    window: 'By the window',
    bar: 'At the bar',
    outdoor: 'Outside',
    quiet: 'Somewhere quiet',
  };
  return labels[seating];
}

function occasionLabel(occasion: Reservation['occasion']): string {
  const labels: Record<Reservation['occasion'], string> = {
    none: '—',
    birthday: 'Birthday',
    anniversary: 'Anniversary',
    celebration: 'Celebration',
    business: 'Business',
    'date-night': 'Date night',
  };
  return labels[occasion];
}

const styles = StyleSheet.create({
  hero: { position: 'relative' },
  heroImage: { width: '100%', aspectRatio: aspect.hero },
  heroCopy: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.xxl,
    gap: spacing.xxs,
  },
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xl, gap: spacing.lg },
  status: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderColor: 'transparent',
  },
  statusCopy: { flex: 1, gap: spacing.xxs },
  detailCard: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { width: 78 },
  rowValue: { flex: 1, textAlign: 'right' },
  notes: { padding: spacing.lg, gap: spacing.xs },
  venue: { padding: spacing.lg, gap: spacing.xs, borderRadius: radius.lg },
  venueActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
});
