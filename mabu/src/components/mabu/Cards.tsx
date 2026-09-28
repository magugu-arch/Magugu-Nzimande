import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import type { Availability, Experience } from '@/domain/experiences/types';
import type { ReservationRecord } from '@/domain/reservations/types';
import { STATUS_LABEL } from '@/domain/reservations/status';
import type { Voucher } from '@/domain/vouchers/types';
import type { VenueContent } from '@/content/types';
import {
  formatDateLong,
  formatDateShort,
  formatDateWithYear,
  formatRand,
  formatTime,
} from '@/domain/shared/format';
import { colors, radius, spacing } from '@/theme';
import { callVenue, emailVenue, openDirections, type MapsApp } from '@/utils/linking';
import { BrandIcon } from '../brand/BrandIcon';
import { Card, Photo, PremiumButton, Text } from '../ui';
import { AvailabilityChip } from './TimeSlotGrid';
import { ExperienceBadge } from './Menu';

export const OCCASION_LABEL: Record<string, string> = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  business: 'Business',
  'date-night': 'Date night',
  celebration: 'Celebration',
  other: 'Other',
};

/** §25 EventCard. */
export function EventCard({
  event,
  compact,
}: {
  event: Experience & { availability: Availability };
  compact?: boolean;
}) {
  const price =
    event.priceCents === null ? 'Price on request' : `${formatRand(event.priceCents)} per guest`;
  return (
    <Pressable
      onPress={() => router.push(`/events/${event.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatDateLong(event.startsAt)} at ${formatTime(event.startsAt)}, ${price}`}
      style={({ pressed }) => [styles.event, pressed && styles.pressed]}
    >
      <Photo
        photo={event.heroPhoto}
        label=""
        style={[styles.eventPhoto, compact && { height: 170 }]}
        scrim="bottom"
      />
      <View style={styles.eventDate}>
        <Text variant="h2" color="accent" style={{ lineHeight: 28 }}>
          {Number(formatDateShort(event.startsAt).split(' ')[1])}
        </Text>
        <Text variant="eyebrow">{formatDateShort(event.startsAt).split(' ')[2]}</Text>
      </View>
      <View style={styles.eventBody}>
        <View style={styles.row}>
          <AvailabilityChip state={event.availability} />
          {event.isSample ? <ExperienceBadge label="Sample" tone="muted" /> : null}
        </View>
        <Text variant="h3">{event.title}</Text>
        <Text variant="bodySmall" color="textMuted">
          {formatDateLong(event.startsAt)} · {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
        </Text>
        <Text variant="price" color="accent">
          {price}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * §25 VoucherCard — a gift card with the board's floral pattern, the value,
 * the recipient and the code. The QR is shown on the voucher's own screen.
 */
export function VoucherCard({ voucher, onPress }: { voucher: Voucher; onPress?: () => void }) {
  const status =
    voucher.status === 'active'
      ? voucher.remainingCents < voucher.amountCents
        ? `${formatRand(voucher.remainingCents)} remaining`
        : 'Active'
      : voucher.status === 'pending_payment'
        ? 'Awaiting payment confirmation'
        : voucher.status === 'redeemed'
          ? 'Fully used'
          : voucher.status === 'expired'
            ? 'Expired'
            : 'Cancelled';
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/vouchers/${voucher.id}`))}
      accessibilityRole="button"
      accessibilityLabel={`Gift voucher, ${formatRand(voucher.amountCents)}, for ${voucher.recipientName}. ${status}`}
      style={({ pressed }) => [styles.voucher, pressed && styles.pressed]}
    >
      <Photo photo="texture-pattern" label="" style={StyleSheet.absoluteFill} scrim="full" />
      <View style={styles.voucherInner}>
        <View style={styles.row}>
          <Text variant="eyebrow" color="accent" style={{ flex: 1 }}>
            MÁBU · Gift voucher
          </Text>
          <BrandIcon name="vouchers" size={22} />
        </View>
        <Text variant="hero" style={{ marginTop: spacing.lg }}>
          {formatRand(voucher.amountCents)}
        </Text>
        <Text variant="bodySmall" color="textMuted">
          For {voucher.recipientName}
          {voucher.occasion ? ` · ${voucher.occasion}` : ''}
        </Text>
        <View style={[styles.row, { marginTop: spacing.lg }]}>
          <Text variant="eyebrow" style={{ flex: 1 }}>
            {voucher.status === 'active' || voucher.status === 'redeemed'
              ? voucher.code
              : '•••• ••••'}
          </Text>
          <Text variant="caption" color={voucher.status === 'active' ? 'success' : 'textMuted'}>
            {status}
          </Text>
        </View>
        {voucher.expiresAt && voucher.status === 'active' ? (
          <Text variant="caption" color="textSubtle">
            Valid until {formatDateWithYear(voucher.expiresAt)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A booking as a row in My Bookings. */
export function ReservationRow({ reservation }: { reservation: ReservationRecord }) {
  const active = ['confirmed', 'rescheduled', 'requested'].includes(reservation.status);
  return (
    <Pressable
      onPress={() => router.push(`/booking/${reservation.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Table for ${reservation.partySize}, ${formatDateLong(reservation.startsAt)} at ${formatTime(reservation.startsAt)}, ${STATUS_LABEL[reservation.status]}`}
      style={({ pressed }) => [styles.resRow, pressed && styles.pressed]}
    >
      <View style={styles.resDate}>
        <Text variant="h2" color={active ? 'accent' : 'textMuted'} style={{ lineHeight: 30 }}>
          {Number(formatDateShort(reservation.startsAt).split(' ')[1])}
        </Text>
        <Text variant="eyebrow" color="textMuted">
          {formatDateShort(reservation.startsAt).split(' ')[2]}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title">
          {formatDateShort(reservation.startsAt).split(' ')[0]} · {formatTime(reservation.startsAt)}
        </Text>
        <Text variant="bodySmall" color="textMuted">
          Table for {reservation.partySize}
          {reservation.occasion ? ` · ${OCCASION_LABEL[reservation.occasion]}` : ''}
        </Text>
        <Text
          variant="caption"
          color={
            reservation.status === 'cancelled' || reservation.status === 'no-show'
              ? 'textSubtle'
              : 'accent'
          }
        >
          {STATUS_LABEL[reservation.status]}
          {reservation.depositStatus === 'pending' ? ' · deposit due' : ''}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

/** §25 ReservationConfirmation — the summary block shared by confirmation and manage screens. */
export function ReservationSummary({
  reservation,
  venue,
}: {
  reservation: ReservationRecord;
  venue?: VenueContent;
}) {
  const rows: [string, string][] = [
    ['Reference', reservation.reference],
    ['Date', formatDateLong(reservation.startsAt)],
    ['Time', formatTime(reservation.startsAt)],
    [
      'Guests',
      `${reservation.partySize}${reservation.children ? ` (incl. ${reservation.children} children)` : ''}`,
    ],
    ['Venue', venue ? `${venue.name}, ${venue.area}` : 'Mábu Restaurant, Waterfall Wilds'],
  ];
  if (reservation.occasion)
    rows.push(['Occasion', OCCASION_LABEL[reservation.occasion] ?? reservation.occasion]);
  if (reservation.depositCents > 0) {
    rows.push([
      'Deposit',
      `${formatRand(reservation.depositCents)} · ${reservation.depositStatus.replace('_', ' ')}`,
    ]);
  }
  return (
    <Card style={{ gap: spacing.md }}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.summaryRow}>
          <Text variant="eyebrow" color="textMuted" style={{ width: 96 }}>
            {k}
          </Text>
          <Text variant="body" style={{ flex: 1 }} selectable={k === 'Reference'}>
            {v}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** §25 Map / Directions Card — the floor pattern, the address, and one tap to each maps app. */
export function DirectionsCard({ venue }: { venue: VenueContent }) {
  const apps: { app: MapsApp; label: string }[] = [
    { app: 'google', label: 'Google Maps' },
    { app: 'apple', label: 'Apple Maps' },
    { app: 'waze', label: 'Waze' },
  ];
  return (
    <View style={styles.directions}>
      <Photo photo="floor-pattern" label="" style={styles.directionsPhoto} scrim="full" />
      <View style={styles.directionsPin}>
        <BrandIcon name="location" size={34} />
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Text variant="eyebrow" color="accent">
          Find your way to Mábu
        </Text>
        <View>
          {venue.addressLines.map((l) => (
            <Text key={l} variant="body">
              {l}
            </Text>
          ))}
        </View>
        <View style={styles.row}>
          {apps.map((a) => (
            <PremiumButton
              key={a.app}
              label={a.label}
              variant="secondary"
              compact
              style={{ flex: 1, paddingHorizontal: spacing.xs }}
              onPress={() => void openDirections(venue.mapsQuery, a.app)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** The human fallback (§23): shown wherever a provider cannot help. */
export function ContactActions({ venue, subject }: { venue: VenueContent; subject?: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {venue.phone ? (
        <PremiumButton
          label="Call reservations"
          icon="phone"
          variant="secondary"
          onPress={() => void callVenue(venue.phone!)}
        />
      ) : null}
      <PremiumButton
        label="Email reservations"
        icon="mail"
        variant="secondary"
        onPress={() => void emailVenue(venue.email, subject ?? 'Reservation request')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  event: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  eventPhoto: { height: 220 },
  eventDate: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    backgroundColor: colors.scrimStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  eventBody: { padding: spacing.lg, gap: spacing.xs },
  voucher: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    minHeight: 200,
  },
  voucherInner: { padding: spacing.xl, gap: 2 },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resDate: { width: 52, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'baseline' },
  directions: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  directionsPhoto: { height: 140 },
  directionsPin: { position: 'absolute', top: 52, alignSelf: 'center' },
});
