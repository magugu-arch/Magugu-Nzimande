import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  OfflineState,
  Screen,
  Text,
} from '@/components/ui';
import { OrderTotals } from '@/features/cart/components/OrderTotals';
import { useOrder } from '@/features/orders/hooks';
import { readyLabelFor } from '@/services/orderService';
import { colors, radius, spacing } from '@/theme';
import { formatDateTime, formatEtaWindow } from '@/utils/datetime';
import { isOfflinePending } from '@/features/system/queryPhase';

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

  /*
    A paused query is somebody with no signal, not a missing order — the same
    rule as the tracking screen next door, and this was the last screen in the
    app without it.

    `isError` is false and `data` is undefined while a query is paused, so the
    branch below caught it and rendered "We can't find that order. If you were
    charged, it will appear in your order history shortly." That is a claim
    about the world from an app that has not looked, and it carries a second
    one — "if you were charged" — inviting doubt about whether the payment
    happened.

    `audit:offline` scored it as *honest but unnamed*: the retry button says
    "Try again", which is enough to clear the sweep's honesty test, so the
    finding read "blames itself when it knows the device is offline". The
    screen had the one fact that would have explained everything and did not
    use it.

    Not the just-paid path: `usePlaceOrder` seeds the cache with the order, so
    a customer coming straight from checkout has it in hand. It is the cold
    arrival that lands here — a push notification deep-linking to this screen
    on a fresh launch, or a relaunch after the cache has gone — which is
    exactly the route somebody takes when they want to check an order they
    already placed.
  */
  if (isOfflinePending(order)) {
    return (
      <Screen edges={['top', 'bottom']} testID="confirmation-offline">
        <OfflineState onRetry={() => void order.refetch()} />
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
        <Text variant="quote" color={colors.textSecondary} align="center">
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
        <OrderTotals
          totals={data.totals}
          fulfilmentType={data.fulfilmentType}
          showNudge={false}
          /*
            The order carries both. Without them the receipt read "Promo
            discount" and "Rewards discount" while the cart the customer had
            just left said "Promo · WELCOME50" and "Reward · Free French
            Fries" — the record held the facts, the component had the slots,
            and nothing joined them up.
          */
          {...(data.voucherCode ? { voucherCode: data.voucherCode } : {})}
          {...(data.rewardName ? { rewardName: data.rewardName } : {})}
        />
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
          testID="confirmation-home"
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
