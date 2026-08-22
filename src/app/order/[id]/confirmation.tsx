import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { OrderTotals } from '@/features/cart/components/OrderTotals';
import { useOrder } from '@/features/orders/hooks';
import { readyLabelFor } from '@/services/orderService';
import { colors, radius, spacing } from '@/theme';
import { formatDateTime, formatEtaWindow } from '@/utils/datetime';

/** Order Confirmation (brief §4). */
export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);

  if (order.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingState message="Confirming your order…" />
      </Screen>
    );
  }

  if (order.isError || !order.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ErrorState
          title="We can't find that order"
          message="If you were charged, it will appear in your order history shortly."
          onRetry={() => void order.refetch()}
        />
        <Button label="Go to orders" onPress={() => router.replace('/(tabs)/orders')} />
      </Screen>
    );
  }

  const data = order.data;
  const fulfilmentLabel =
    data.fulfilmentType === 'delivery'
      ? 'Delivering to'
      : data.fulfilmentType === 'collection'
        ? 'Collect from'
        : 'Dining in at';
  const fulfilmentValue =
    data.fulfilmentType === 'delivery' ? (data.addressSummary ?? 'Your address') : data.storeName;

  return (
    <Screen scroll edges={['top', 'bottom']} testID="order-confirmation-screen">
      <View style={styles.hero}>
        <View style={styles.tick}>
          <Ionicons name="checkmark" size={40} color={colors.onPrimary} />
        </View>

        <Text variant="display" align="center">
          Order placed
        </Text>
        <Text variant="bodyLarge" color={colors.textSecondary} align="center">
          Thanks. The kitchen has your order and is getting started.
        </Text>

        <View style={styles.reference}>
          <Text variant="overline" color={colors.textMuted}>
            Order reference
          </Text>
          <Text variant="h2">{data.reference}</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <DetailRow
          icon="time-outline"
          label={data.scheduledFor ? 'Scheduled for' : readyLabelFor(data.fulfilmentType)}
          value={
            data.scheduledFor ? formatDateTime(data.scheduledFor) : formatEtaWindow(data.etaMinutes)
          }
        />
        <DetailRow
          icon={data.fulfilmentType === 'delivery' ? 'bicycle-outline' : 'storefront-outline'}
          label={fulfilmentLabel}
          value={fulfilmentValue}
        />
        {data.tableNumber ? (
          <DetailRow icon="restaurant-outline" label="Table" value={data.tableNumber} />
        ) : null}
        <DetailRow icon="card-outline" label="Paid with" value={data.paymentMethodLabel} />
      </Card>

      <Card style={styles.card}>
        <OrderTotals totals={data.totals} fulfilmentType={data.fulfilmentType} showNudge={false} />
      </Card>

      <View style={styles.actions}>
        <Button
          label="Track this order"
          onPress={() => router.replace(`/order/${data.id}`)}
          size="lg"
          iconLeft="navigate-outline"
          testID="confirmation-track"
        />
        <Button
          label="Back to home"
          onPress={() => router.replace('/(tabs)/home')}
          variant="text"
        />
      </View>
    </Screen>
  );
}

interface DetailRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.detailBody}>
        <Text variant="caption" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="bodyMedium" numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  tick: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing.sm,
  },
  reference: {
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  card: { gap: spacing.lg, marginBottom: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  detailBody: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.sm, paddingVertical: spacing.lg },
});
