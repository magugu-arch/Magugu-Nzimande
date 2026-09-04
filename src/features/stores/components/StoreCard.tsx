import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { FulfilmentType, Store } from '@/types';
import { Badge, Card, Text } from '@/components/ui';
import { isOpeningLater } from '@/store/fulfilmentStore';
import { colors, spacing } from '@/theme';
import { formatShortDate } from '@/utils/datetime';
import { formatDistance } from '@/utils/geo';
import { closureReason, isTradingNow, windowInForce } from '@/utils/tradingHours';
import { supportsFulfilment } from '@/utils/fulfilment';

export interface StoreCardProps {
  store: Store;
  selected?: boolean;
  onPress: () => void;
  /** Flags stores that cannot serve the chosen fulfilment type. */
  fulfilmentType?: FulfilmentType;
  testID?: string;
}

export const StoreCard = memo(function StoreCard({
  store,
  selected = false,
  onPress,
  fulfilmentType,
  testID,
}: StoreCardProps) {
  // The window in force, which is today's row except when a late window from
  // the night before is still running. Printing today's row there put
  // "Open now · 11:00 – 22:00" on a card fifteen minutes from last orders.
  const today = windowInForce(store);

  /**
   * Why it is shut, which decides both words on this card.
   *
   * "Closed" printed beside "10:00 – 22:00" at two in the afternoon is a card
   * arguing with itself, and that is exactly what a branch shut by its own
   * flag produced: the badge read the flag, the hours row read the timetable,
   * and neither knew about the other. A customer reads it as a bug in the app
   * and taps anyway.
   */
  const closure = closureReason(store);
  // A branch that has not opened yet is not "closed" — it has never been open,
  // and no fulfilment type is available at it. Selecting it would only produce
  // a blocker at checkout, so the card refuses the tap here instead.
  const openingLater = isOpeningLater(store);
  // Derived, not read off the record: the card can be handed a store that came
  // out of storage rather than off the wire, and `isOpenNow` there is only as
  // fresh as whenever it was last saved.
  const trading = isTradingNow(store);
  const supported =
    !openingLater && (fulfilmentType ? supportsFulfilment(store, fulfilmentType) : true);

  /**
   * Whether there is a distance to show at all.
   *
   * There is not, whenever the customer has declined the location prompt or has
   * not been asked — which is most of the time. This badge used to be filled in
   * regardless, from a distance the store service measured against the
   * Johannesburg CBD, so a customer in Durban was told Rosebank was 6.4 km away
   * and the list was sorted to match. `distanceKm` is now absent rather than
   * invented, and the badge goes with it.
   */
  const located = typeof store.distanceKm === 'number';

  return (
    <Card
      onPress={supported ? onPress : undefined}
      selected={selected}
      raised={selected}
      testID={testID}
      accessibilityLabel={
        openingLater
          ? `${store.name}, opening ${formatShortDate(store.opensOn!)}, not yet taking orders`
          : located
            ? `${store.name}, ${formatDistance(store.distanceKm!)} away`
            : `${store.name}, ${store.suburb}`
      }
      style={supported ? undefined : styles.unavailable}
    >
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text variant="h3" numberOfLines={1}>
            {store.name}
          </Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {store.addressLine}, {store.suburb}
          </Text>
        </View>

        {selected ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        ) : located ? (
          <Badge label={formatDistance(store.distanceKm!)} tone="neutral" icon="navigate" />
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Ionicons
            name="ellipse"
            size={8}
            color={
              openingLater
                ? colors.status.info
                : trading
                  ? colors.status.success
                  : colors.status.error
            }
          />
          <Text
            variant="caption"
            color={
              openingLater
                ? colors.status.info
                : trading
                  ? colors.status.success
                  : colors.status.error
            }
          >
            {openingLater
              ? `Opening ${formatShortDate(store.opensOn!)}`
              : trading
                ? 'Open now'
                : closure === 'unavailable'
                  ? 'Temporarily closed'
                  : 'Closed'}
          </Text>
        </View>

        {/* Withheld when the timetable is not what is shutting the branch:
            today's window would otherwise sit beside "Temporarily closed"
            saying the branch is open now. */}
        {today && closure !== 'unavailable' ? (
          <Text variant="caption" color={colors.textMuted}>
            {today.opensAt} – {today.closesAt}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>
            ~{store.preparationMinutes} min
          </Text>
        </View>
      </View>

      <View style={styles.services}>
        {store.supportsDelivery ? <Badge label="Delivery" tone="neutral" /> : null}
        {store.supportsCollection ? <Badge label="Collection" tone="neutral" /> : null}
        {store.supportsDineIn ? <Badge label="Dine-in" tone="neutral" /> : null}
      </View>

      {openingLater ? (
        <Text variant="caption" color={colors.status.info}>
          Not taking orders yet.
        </Text>
      ) : null}

      {!supported && !openingLater && fulfilmentType ? (
        <Text variant="caption" color={colors.status.warning}>
          This store does not offer {fulfilmentType === 'dinein' ? 'dine-in' : fulfilmentType}.
        </Text>
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  unavailable: { opacity: 0.55 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  titles: { flex: 1, gap: spacing.xxs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
});
