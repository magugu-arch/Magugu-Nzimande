import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { FulfilmentType, Store } from '@/types';
import { Badge, Card, Text } from '@/components/ui';
import { hoursForDay } from '@/services/storeService';
import { isOpeningLater } from '@/store/fulfilmentStore';
import { colors, spacing } from '@/theme';
import { formatShortDate } from '@/utils/datetime';
import { formatDistance } from '@/utils/geo';

export interface StoreCardProps {
  store: Store;
  selected?: boolean;
  onPress: () => void;
  /** Flags stores that cannot serve the chosen fulfilment type. */
  fulfilmentType?: FulfilmentType;
  testID?: string;
}

function supportsFulfilment(store: Store, fulfilmentType: FulfilmentType): boolean {
  if (fulfilmentType === 'delivery') return store.supportsDelivery;
  if (fulfilmentType === 'collection') return store.supportsCollection;
  return store.supportsDineIn;
}

export const StoreCard = memo(function StoreCard({
  store,
  selected = false,
  onPress,
  fulfilmentType,
  testID,
}: StoreCardProps) {
  const today = hoursForDay(store, new Date().getDay());
  // A branch that has not opened yet is not "closed" — it has never been open,
  // and no fulfilment type is available at it. Selecting it would only produce
  // a blocker at checkout, so the card refuses the tap here instead.
  const openingLater = isOpeningLater(store);
  const supported =
    !openingLater && (fulfilmentType ? supportsFulfilment(store, fulfilmentType) : true);

  return (
    <Card
      onPress={supported ? onPress : undefined}
      selected={selected}
      raised={selected}
      testID={testID}
      accessibilityLabel={
        openingLater
          ? `${store.name}, opening ${formatShortDate(store.opensOn!)}, not yet taking orders`
          : `${store.name}, ${formatDistance(store.distanceKm)} away`
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
        ) : (
          <Badge label={formatDistance(store.distanceKm)} tone="neutral" icon="navigate" />
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Ionicons
            name="ellipse"
            size={8}
            color={
              openingLater
                ? colors.status.info
                : store.isOpenNow
                  ? colors.status.success
                  : colors.status.error
            }
          />
          <Text
            variant="caption"
            color={
              openingLater
                ? colors.status.info
                : store.isOpenNow
                  ? colors.status.success
                  : colors.status.error
            }
          >
            {openingLater
              ? `Opening ${formatShortDate(store.opensOn!)}`
              : store.isOpenNow
                ? 'Open now'
                : 'Closed'}
          </Text>
        </View>

        {today ? (
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
