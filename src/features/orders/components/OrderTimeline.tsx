import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { OrderStatus, OrderStatusEvent } from '@/types';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { formatTime } from '@/utils/datetime';

export interface OrderTimelineProps {
  timeline: OrderStatusEvent[];
  currentStatus: OrderStatus;
}

const STATUS_ICONS: Record<OrderStatus, keyof typeof Ionicons.glyphMap> = {
  received: 'receipt-outline',
  preparing: 'flame-outline',
  ready: 'bag-check-outline',
  courier_assigned: 'person-outline',
  out_for_delivery: 'bicycle-outline',
  completed: 'checkmark-done-outline',
  cancelled: 'close-circle-outline',
};

/**
 * Live order tracking states (brief §11):
 * Received → Preparing → Ready → Courier assigned → Out for delivery → Completed
 * for a delivery order, and Received → Preparing → Ready for collection →
 * Completed otherwise. The courier steps are only ever in a delivery
 * sequence — see `statusSequence`.
 */
export const OrderTimeline = memo(function OrderTimeline({
  timeline,
  currentStatus,
}: OrderTimelineProps) {
  return (
    <View style={styles.container} accessibilityLabel="Order progress">
      {timeline.map((event, index) => {
        const reached = event.occurredAt !== null;
        const isCurrent = event.status === currentStatus;
        const isLast = index === timeline.length - 1;

        // Sighted users read this rail off a filled node and a bolder label.
        // §32.4 asks that colour never carries meaning on its own, so the
        // state goes into words as well, and each step is announced whole
        // rather than as four loose fragments.
        const state = isCurrent
          ? 'in progress now'
          : reached
            ? `done${event.occurredAt ? ` at ${formatTime(event.occurredAt)}` : ''}`
            : 'not yet';

        return (
          <View
            key={event.status}
            style={styles.step}
            accessible
            accessibilityLabel={`Step ${index + 1} of ${timeline.length}. ${event.label}, ${state}. ${event.description}`}
          >
            <View style={styles.rail} importantForAccessibility="no-hide-descendants">
              <View
                style={[
                  styles.node,
                  reached ? styles.nodeReached : null,
                  isCurrent ? styles.nodeCurrent : null,
                ]}
              >
                <Ionicons
                  name={STATUS_ICONS[event.status]}
                  size={16}
                  color={reached ? colors.onPrimary : colors.textDisabled}
                />
              </View>
              {!isLast ? (
                <View style={[styles.connector, reached ? styles.connectorReached : null]} />
              ) : null}
            </View>

            <View style={[styles.body, isLast ? styles.bodyLast : null]}>
              <View style={styles.titleRow}>
                <Text
                  variant={isCurrent ? 'h3' : 'bodyMedium'}
                  color={reached ? colors.textPrimary : colors.textDisabled}
                >
                  {event.label}
                </Text>
                {event.occurredAt ? (
                  <Text variant="caption" color={colors.textMuted}>
                    {formatTime(event.occurredAt)}
                  </Text>
                ) : null}
              </View>

              <Text variant="caption" color={reached ? colors.textSecondary : colors.textDisabled}>
                {event.description}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 0 },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 34 },
  node: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  nodeReached: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  nodeCurrent: { transform: [{ scale: 1.12 }] },
  connector: {
    flex: 1,
    width: 2,
    minHeight: 24,
    backgroundColor: colors.border,
  },
  connectorReached: { backgroundColor: colors.primary },
  body: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.xl },
  bodyLast: { paddingBottom: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
