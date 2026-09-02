import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { DeliveryJob } from '@/types';
import { Card, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
// Not `toLocaleTimeString`: Hermes ships without full ICU on some builds, so a
// time would render differently on two phones. Same reason `groupDigits` exists.
import { formatTime } from '@/utils/datetime';

export interface CourierTrackingProps {
  job: DeliveryJob;
}

/**
 * The courier surface (brief §2: "integration-ready courier map when a provider
 * exposes authorised tracking data").
 *
 * The conditional in that sentence is the whole design. A courier network may
 * run the delivery and still not be permitted to publish a live position —
 * authorisation to *deliver* and authorisation to *track* are separate grants,
 * and the second is the one that usually is not given. So this component has
 * two states and the unauthorised one is the default, not the fallback:
 *
 *   `trackingAvailable: false`  say where the order is in words, and say
 *                               plainly that there is no live map. A customer
 *                               told "tracking is not available for this
 *                               delivery" is better served than one staring at
 *                               an empty rectangle wondering if it is loading.
 *   `trackingAvailable: true`   the position the provider reported, with the
 *                               map itself still to be mounted — see below.
 *
 * **The map is deliberately not drawn yet.** Rendering one needs a maps
 * provider with a key, and §12 is explicit that mapping services require their
 * own accounts, contracts and credentials. What is built is the surface that
 * receives it, the data path that feeds it, and the permission check that gates
 * it — so mounting a real map is a component swap inside this file rather than
 * a change to the order service, the provider interface or the tracking screen.
 * Drawing a fake map would be worse than none: it would look finished.
 */
export function CourierTracking({ job }: CourierTrackingProps) {
  const eta = job.etaMinutes;
  // A finished job has nothing left to track. Saying "the progress below is
  // updated as your order moves" under a delivered order is copy describing a
  // journey that has ended.
  const settled = job.status === 'DELIVERED' || job.status === 'CANCELLED';

  return (
    <Card style={styles.card} testID="courier-tracking">
      <View style={styles.header}>
        <Ionicons
          name={job.trackingAvailable ? 'navigate-circle-outline' : 'information-circle-outline'}
          size={18}
          color={colors.primary}
        />
        <Text variant="h3" style={styles.title}>
          Delivery
        </Text>
      </View>

      {job.trackingAvailable && job.courierPosition ? (
        <View style={styles.mapSlot} testID="courier-map-slot">
          <Text variant="caption" color={colors.textSecondary} align="center">
            Live position reported {formatTime(job.courierPosition.reportedAt)}
          </Text>
        </View>
      ) : settled ? (
        <Text variant="caption" color={colors.textSecondary}>
          {job.status === 'DELIVERED'
            ? 'Delivered by your driver.'
            : 'This delivery was cancelled.'}
        </Text>
      ) : (
        <Text variant="caption" color={colors.textSecondary}>
          Live map tracking is not available for this delivery. The progress below is updated as
          your order moves.
        </Text>
      )}

      {eta !== undefined && !settled ? (
        <Text variant="bodyMedium" testID="courier-eta">
          {eta === 0 ? 'Arriving now' : `About ${eta} min away`}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  mapSlot: {
    minHeight: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
});
