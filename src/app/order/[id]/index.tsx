import { useCallback } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Product } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  LoadingState,
  ProgressBar,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { OrderTotals } from '@/features/cart/components/OrderTotals';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { useCancelOrder, useOrder } from '@/features/orders/hooks';
import { useMenu } from '@/features/menu/hooks';
import { readyLabelFor, statusCopy } from '@/services/orderService';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing } from '@/theme';
import { describeOptions } from '@/utils/cart';
import { formatDateTime, formatEtaWindow } from '@/utils/datetime';
import { formatPrice } from '@/utils/money';

/** Live Order Tracking + Order Details + Re-order (brief §4). */
export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const order = useOrder(id, { poll: true });
  const cancelOrder = useCancelOrder();
  const menu = useMenu();
  const addLine = useCartStore((state) => state.addLine);

  const handleReorder = useCallback(() => {
    if (!order.data || !menu.data) return;

    const products = new Map<string, Product>(
      menu.data.products.map((product) => [product.id, product]),
    );

    let added = 0;
    let unavailable = 0;

    order.data.lines.forEach((line) => {
      const product = products.get(line.productId);
      // An item that has left the menu cannot be re-added — say so rather than
      // silently dropping it from the basket.
      if (!product || !product.available) {
        unavailable += 1;
        return;
      }
      addLine(product, line.selectedOptions, line.quantity, line.specialInstructions);
      added += 1;
    });

    if (added === 0) {
      Alert.alert('Nothing to reorder', 'None of these items are on the menu right now.');
      return;
    }

    if (unavailable > 0) {
      Alert.alert(
        'Added what we could',
        `${added} item${added === 1 ? '' : 's'} added. ${unavailable} ${unavailable === 1 ? 'is' : 'are'} no longer available.`,
        [{ text: 'View cart', onPress: () => router.push('/cart') }],
      );
      return;
    }

    router.push('/cart');
  }, [order.data, menu.data, addLine, router]);

  const handleCancel = useCallback(() => {
    if (!order.data) return;
    Alert.alert('Cancel this order?', 'We can only cancel before the kitchen starts cooking.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: () => {
          cancelOrder.mutate(order.data.id, {
            onError: (error) =>
              Alert.alert(
                'Too late to cancel',
                error instanceof Error ? error.message : 'Please call the store.',
              ),
          });
        },
      },
    ]);
  }, [order.data, cancelOrder]);

  if (order.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Your order" />
        <LoadingState message="Checking on your order…" />
      </Screen>
    );
  }

  if (order.isError || !order.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Your order" />
        <ErrorState onRetry={() => void order.refetch()} />
      </Screen>
    );
  }

  const data = order.data;
  const isActive = data.status !== 'completed' && data.status !== 'cancelled';
  const completedSteps = data.timeline.filter((event) => event.occurredAt !== null).length;
  const progress = completedSteps / Math.max(1, data.timeline.length);

  return (
    <Screen scroll edges={['top', 'bottom']} testID="order-tracking-screen">
      <ScreenHeader title={data.reference} subtitle={formatDateTime(data.placedAt)} />

      {/* Status hero */}
      <Card style={[styles.statusCard, data.status === 'cancelled' ? styles.cancelledCard : null]}>
        <View style={styles.statusHeader}>
          <Badge
            label={
              isActive ? 'In progress' : data.status === 'cancelled' ? 'Cancelled' : 'Completed'
            }
            tone={isActive ? 'primary' : data.status === 'cancelled' ? 'warning' : 'success'}
          />
          <Text variant="caption" color={colors.textOnDarkMuted}>
            {data.storeName}
          </Text>
        </View>

        <Text variant="h1" color={colors.textOnDark}>
          {statusCopy(data.status).label}
        </Text>
        <Text variant="body" color={colors.textOnDarkMuted}>
          {statusCopy(data.status).description}
        </Text>

        {isActive ? (
          <>
            <ProgressBar
              progress={progress}
              trackColor="rgba(255,255,255,0.18)"
              style={styles.progress}
              accessibilityLabel={`Order ${Math.round(progress * 100)} percent complete`}
            />
            <Text variant="captionMedium" color={colors.textOnDark}>
              {data.scheduledFor
                ? `Scheduled for ${formatDateTime(data.scheduledFor)}`
                : `${readyLabelFor(data.fulfilmentType)} in ${formatEtaWindow(data.etaMinutes)}`}
            </Text>
          </>
        ) : null}

        {data.driverName && data.status === 'out_for_delivery' ? (
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text variant="captionMedium" color={colors.onPrimary}>
                {data.driverName.charAt(0)}
              </Text>
            </View>
            <View style={styles.driverBody}>
              <Text variant="bodyMedium" color={colors.textOnDark}>
                {data.driverName} is on the way
              </Text>
              <Text variant="caption" color={colors.textOnDarkMuted}>
                Heading to {data.addressSummary}
              </Text>
            </View>
          </View>
        ) : null}
      </Card>

      {/* Timeline */}
      <Card style={styles.card}>
        <Text variant="h3">Progress</Text>
        <OrderTimeline timeline={data.timeline} currentStatus={data.status} />
      </Card>

      {/* Items */}
      <Card style={styles.card}>
        <Text variant="h3">What you ordered</Text>

        {data.lines.map((line) => (
          <View key={line.id} style={styles.line}>
            <FoodImage
              assetKey={line.assetKey}
              variant="thumb"
              rounded="sm"
              compactPlaceholder
              style={styles.lineImage}
            />
            <View style={styles.lineBody}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {line.quantity} × {line.name}
              </Text>
              {describeOptions(line).length > 0 ? (
                <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
                  {describeOptions(line)}
                </Text>
              ) : null}
            </View>
            <Text variant="bodyMedium">{formatPrice(line.lineTotal)}</Text>
          </View>
        ))}

        <Divider spacingSize="sm" />

        <OrderTotals totals={data.totals} fulfilmentType={data.fulfilmentType} showNudge={false} />
      </Card>

      {/* Store contact */}
      <Card
        onPress={() => void Linking.openURL(`tel:${data.storeName}`)}
        style={styles.card}
        accessibilityLabel={`Call ${data.storeName}`}
      >
        <View style={styles.contactRow}>
          <View style={styles.contactIcon}>
            <Ionicons name="call-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.contactBody}>
            <Text variant="bodyMedium">Call the store</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {data.storeName}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        {data.status === 'received' ? (
          <Button
            label="Cancel order"
            onPress={handleCancel}
            variant="tertiary"
            loading={cancelOrder.isPending}
            testID="order-cancel"
          />
        ) : null}

        {data.status === 'completed' && data.rating === undefined ? (
          <Button
            label="Rate this order"
            onPress={() => router.push(`/order/${data.id}/rate`)}
            iconLeft="star-outline"
            testID="order-rate-cta"
          />
        ) : null}

        {data.rating !== undefined ? (
          <View style={styles.ratedRow}>
            <Ionicons name="star" size={16} color={colors.primary} />
            <Text variant="caption" color={colors.textSecondary}>
              You rated this order {data.rating} out of 5
            </Text>
          </View>
        ) : null}

        <Button
          label="Order this again"
          onPress={handleReorder}
          variant={data.status === 'completed' ? 'primary' : 'tertiary'}
          iconLeft="repeat"
          testID="order-reorder"
        />

        <Button
          label="Need help with this order?"
          onPress={() => router.push(`/account/contact?order=${data.reference}`)}
          variant="text"
          preserveCase
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.brand.black,
    borderWidth: 0,
  },
  cancelledCard: { backgroundColor: colors.neutral.grey700 },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progress: { marginTop: spacing.sm },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  driverBody: { flex: 1, gap: spacing.xxs },
  card: { gap: spacing.md, marginBottom: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineImage: { width: 48, borderRadius: radius.sm },
  lineBody: { flex: 1, gap: spacing.xxs },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  contactBody: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  ratedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
