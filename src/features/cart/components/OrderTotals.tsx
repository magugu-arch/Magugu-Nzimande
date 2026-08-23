import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { CartTotals, FulfilmentType } from '@/types';
import { Divider, Text } from '@/components/ui';
import { businessRules } from '@/constants/config';
import { colors, radius, spacing } from '@/theme';
import { formatPrice, groupDigits } from '@/utils/money';

export interface OrderTotalsProps {
  totals: CartTotals;
  fulfilmentType: FulfilmentType;
  voucherCode?: string;
  rewardName?: string;
  /** Hides the "spend R x more for free delivery" nudge on confirmation screens. */
  showNudge?: boolean;
}

interface RowProps {
  label: string;
  value: string;
  emphasis?: boolean;
  positive?: boolean;
}

const Row = memo(function Row({ label, value, emphasis = false, positive = false }: RowProps) {
  return (
    <View style={styles.row}>
      <Text
        variant={emphasis ? 'h3' : 'body'}
        color={emphasis ? colors.textPrimary : colors.textSecondary}
        style={styles.rowLabel}
      >
        {label}
      </Text>
      <Text
        variant={emphasis ? 'h3' : 'bodyMedium'}
        color={positive ? colors.status.success : colors.textPrimary}
      >
        {value}
      </Text>
    </View>
  );
});

/** Shared totals block used by Cart, Order Review and Order Details. */
export const OrderTotals = memo(function OrderTotals({
  totals,
  fulfilmentType,
  voucherCode,
  rewardName,
  showNudge = true,
}: OrderTotalsProps) {
  const remainingForFreeDelivery = businessRules.freeDeliveryThreshold - totals.subtotal;
  const showFreeDeliveryNudge =
    showNudge &&
    fulfilmentType === 'delivery' &&
    totals.deliveryFee > 0 &&
    remainingForFreeDelivery > 0;

  return (
    <View style={styles.container}>
      <Row label="Subtotal" value={formatPrice(totals.subtotal)} />

      {fulfilmentType === 'delivery' ? (
        <Row
          label="Delivery fee"
          value={totals.deliveryFee === 0 ? 'Free' : formatPrice(totals.deliveryFee)}
          positive={totals.deliveryFee === 0}
        />
      ) : null}

      {totals.serviceFee > 0 ? (
        <Row label="Service fee" value={formatPrice(totals.serviceFee)} />
      ) : null}

      {totals.discount > 0 ? (
        <Row
          label={voucherCode ? `Promo · ${voucherCode}` : 'Promo discount'}
          value={`−${formatPrice(totals.discount)}`}
          positive
        />
      ) : null}

      {totals.rewardsDiscount > 0 ? (
        <Row
          label={rewardName ? `Reward · ${rewardName}` : 'Rewards discount'}
          value={`−${formatPrice(totals.rewardsDiscount)}`}
          positive
        />
      ) : null}

      <Divider spacingSize="sm" />

      <Row label="Total" value={formatPrice(totals.total)} emphasis />

      {totals.pointsEarned > 0 ? (
        <View style={styles.points}>
          <Ionicons name="star" size={13} color={colors.primary} />
          <Text variant="caption" color={colors.textSecondary}>
            You&apos;ll earn {groupDigits(totals.pointsEarned)} bb.q points on this order
          </Text>
        </View>
      ) : null}

      {showFreeDeliveryNudge ? (
        <View style={styles.nudge}>
          <Ionicons name="bicycle-outline" size={15} color={colors.status.info} />
          <Text variant="caption" color={colors.status.info} style={styles.nudgeText}>
            Add {formatPrice(remainingForFreeDelivery)} more for free delivery
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { flex: 1 },
  points: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.status.infoSoft,
  },
  nudgeText: { flex: 1 },
});
