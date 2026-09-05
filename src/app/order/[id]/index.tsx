import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { OrderStatus } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  ListRow,
  LoadingState,
  OfflineState,
  ProgressBar,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { OrderTotals } from '@/features/cart/components/OrderTotals';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { CourierTracking } from '@/features/orders/components/CourierTracking';
import { useCancelOrder, useOrder } from '@/features/orders/hooks';
import { useReorder } from '@/features/orders/useReorder';
import { orderLineLabel } from '@/features/orders/lineLabel';
import {
  countdownStillApplies,
  deliveryFailed,
  liveStatusBadge,
  liveStatusCopy,
  liveStatusTone,
  timelineFor,
} from '@/features/orders/liveStatus';
import { isOfflinePending } from '@/features/system/queryPhase';
import { minutesUntilDue, readyLabelFor, statusCopy } from '@/services/orderService';
import { useNow } from '@/features/system/useNow';
import { colors, radius, spacing } from '@/theme';
import { describeOptions } from '@/utils/cart';
import { formatDateTime, formatEtaWindow } from '@/utils/datetime';
import { announce } from '@/utils/accessibility';
import { callNumber, isDiallable, openDirections } from '@/utils/linking';
import { directionsTargetFor } from '@/features/orders/directions';
import { formatPrice } from '@/utils/money';
import { track } from '@/ux/analytics';
import { ask, tell } from '@/ux/dialog';

/** Live Order Tracking + Order Details + Re-order (brief §4). */
export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const order = useOrder(id, { poll: true });
  const cancelOrder = useCancelOrder();

  const reorder = useReorder();

  /**
   * My Journey opened. Distinguishes "ordered and tracked it" from "ordered
   * and left", which is what tells you whether the status screen is doing its
   * job. Re-announced when the status changes, not on every poll tick — this
   * screen polls, so anything keyed on render would report continuously.
   */
  const announcedJourney = useRef<string | null>(null);
  useEffect(() => {
    const tracked = order.data;
    if (!tracked) return;
    const key = `${tracked.id}:${tracked.status}`;
    if (announcedJourney.current === key) return;
    announcedJourney.current = key;
    track('view_order_status', { orderId: tracked.id, status: tracked.status });
  }, [order.data]);

  // The card counts down, so it needs a reason to re-render as the clock
  // moves. Without this the line is worked out once when the screen opens and
  // then sits there — which is the bug in a different disguise.
  const now = useNow();

  /**
   * Live tracking polls every fifteen seconds and the hero copy changes under
   * the customer — from Preparing to Ready to Out for delivery. That is the
   * entire purpose of the screen, and a screen reader announces none of it: it
   * reads what was on screen when it last looked. Without this, the only way
   * to find out the food is ready is to swipe back through the page again.
   */
  const announcedStatus = useRef<OrderStatus | null>(null);
  const status = order.data?.status;

  useEffect(() => {
    if (!status) return;
    // The first read is what the screen opened on, which the reader is about
    // to announce anyway.
    if (announcedStatus.current === null) {
      announcedStatus.current = status;
      return;
    }
    if (announcedStatus.current === status) return;
    announcedStatus.current = status;

    const copy = statusCopy(status);
    announce(`${copy.label}. ${copy.description}`);
  }, [status]);

  const handleCancel = useCallback(async () => {
    if (!order.data) return;
    const orderId = order.data.id;
    const confirmed = await ask({
      title: 'Cancel this order?',
      message: 'We can only cancel before the kitchen starts cooking.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;

    cancelOrder.mutate(orderId, {
      onError: (error) =>
        void tell(
          'Too late to cancel',
          error instanceof Error ? error.message : 'Please call the store.',
        ),
    });
  }, [order.data, cancelOrder]);

  if (order.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Your order" />
        <LoadingState message="Checking on your order…" />
      </Screen>
    );
  }

  // Same as everywhere else: a paused query is somebody with no signal, not a
  // missing order. "We can't find that order" is a bad thing to tell a customer
  // standing in a lift waiting for their food.
  if (isOfflinePending(order)) {
    return <OfflineState onRetry={() => void order.refetch()} />;
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
  const dueInMinutes = minutesUntilDue(data, now);

  const canCall = isDiallable(data.storePhone);
  /**
   * Somewhere to send them, or null.
   *
   * A delivery is coming to the customer, so directions to the kitchen are
   * noise; collection and dine-in are the orders somebody travels to. The third
   * condition — that the record actually carries the branch's coordinates — is
   * the one this screen was missing. See `directionsTargetFor`.
   */
  const directions = directionsTargetFor(data);

  return (
    <Screen scroll edges={['top', 'bottom']} testID="order-tracking-screen">
      <ScreenHeader title={data.reference} subtitle={formatDateTime(data.placedAt)} />

      {/* Status hero */}
      <Card
        style={[
          styles.statusCard,
          data.status === 'cancelled' || deliveryFailed(data) ? styles.cancelledCard : null,
        ]}
      >
        <View style={styles.statusHeader}>
          <Badge label={liveStatusBadge(data)} tone={liveStatusTone(data)} />
          <Text variant="caption" color={colors.textOnDarkMuted}>
            {data.storeName}
          </Text>
        </View>

        <Text variant="h1" color={colors.textOnDark} testID="tracking-status">
          {liveStatusCopy(data).label}
        </Text>
        <Text variant="body" color={colors.textOnDarkMuted}>
          {liveStatusCopy(data).description}
        </Text>

        {isActive && !deliveryFailed(data) ? (
          <>
            <ProgressBar
              progress={progress}
              trackColor="rgba(255,255,255,0.18)"
              style={styles.progress}
              accessibilityLabel={`Order ${Math.round(progress * 100)} percent complete`}
            />
            {/*
              A countdown, not a constant. `etaMinutes` is how long the order
              takes, so printing it directly meant the line never moved: three
              quarters of an hour in, an order out with a driver still read
              "Out for delivery in 35 – 45 min" — next to a progress bar that
              had been climbing the whole time.

              Once it is past due the window is dropped rather than restated or
              turned negative. The status line above already says where the
              order is, and a time nobody believes any more is worse than no
              time at all.
            */}
            {data.scheduledFor ? (
              <Text variant="captionMedium" color={colors.textOnDark} testID="tracking-eta">
                {`Scheduled for ${formatDateTime(data.scheduledFor)}`}
              </Text>
            ) : dueInMinutes > 0 && countdownStillApplies(data) ? (
              <Text variant="captionMedium" color={colors.textOnDark} testID="tracking-eta">
                {`${readyLabelFor(data.fulfilmentType)} in ${formatEtaWindow(dueInMinutes)}`}
              </Text>
            ) : null}
          </>
        ) : null}

        {/*
         * The courier, once one is assigned.
         *
         * Two statuses, not one. This used to render only at
         * `out_for_delivery`, which meant the whole time a driver was on
         * their way *to the store* the screen said nothing about them — and
         * that is the stretch a customer spends wondering whether anybody is
         * coming at all. The wording follows the courier's own status rather
         * than being one sentence for both, because "on the way" means
         * something different to somebody waiting at home.
         */}
        {data.driverName &&
        (data.status === 'courier_assigned' || data.status === 'out_for_delivery') ? (
          <View style={styles.driverRow} testID="order-courier">
            <View style={styles.driverAvatar}>
              <Text variant="captionMedium" color={colors.onPrimary}>
                {data.driverName.charAt(0)}
              </Text>
            </View>
            <View style={styles.driverBody}>
              <Text variant="bodyMedium" color={colors.textOnDark}>
                {data.status === 'out_for_delivery'
                  ? `${data.driverName} is on the way`
                  : `${data.driverName} is collecting your order`}
              </Text>
              <Text variant="caption" color={colors.textOnDarkMuted}>
                {data.status === 'out_for_delivery'
                  ? `Heading to ${data.addressSummary}`
                  : `Picking up from ${data.storeName}`}
              </Text>
            </View>
          </View>
        ) : null}

        {/*
          The table, which the order has carried since checkout and which was
          drawn on exactly one screen: the confirmation, seen once, immediately
          after paying. Close it and come back — which is what somebody does
          while they wait — and the number was gone from the tracking screen,
          the Orders card and the receipt alike.

          It sits with the driver row rather than beside the store details for
          the same reason that row does: this is the "where is my food going"
          line, and for a dine-in order the answer is a table rather than a
          street. Nobody had seen the gap because every seeded dine-in order
          was `completed`, so no live one had ever been opened.
        */}
        {data.tableNumber ? (
          <View style={styles.driverRow} testID="order-table">
            <View style={styles.driverAvatar}>
              <Ionicons name="restaurant-outline" size={15} color={colors.onPrimary} />
            </View>
            <View style={styles.driverBody}>
              <Text variant="bodyMedium" color={colors.textOnDark}>
                Table {data.tableNumber}
              </Text>
              <Text variant="caption" color={colors.textOnDarkMuted}>
                {`Bringing it to you at ${data.storeName}`}
              </Text>
            </View>
          </View>
        ) : null}
      </Card>

      {/* Live courier map (brief §2), when a provider is authorised to expose one */}
      {data.delivery ? <CourierTracking job={data.delivery} /> : null}

      {/* Timeline */}
      <Card style={styles.card}>
        <Text variant="h3">Progress</Text>
        <OrderTimeline timeline={timelineFor(data)} currentStatus={data.status} />
      </Card>

      {/* Items */}
      <Card style={styles.card}>
        <Text variant="h3">What you ordered</Text>

        {data.lines.map((line) => (
          <View
            key={line.id}
            style={styles.line}
            accessible
            accessibilityLabel={orderLineLabel(line)}
            testID={`order-line-${line.id}`}
          >
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
              {/*
                The note the customer typed, which the receipt had been
                dropping. Drawn the way the checkout review draws it, because
                this is the same fact one screen later and a customer who read
                it in quotation marks before paying should recognise it after.
              */}
              {/*
                Never clamped. The box that produces this caps it at 200
                characters (`product/[id]`), and at 320pt three lines showed 57
                pixels of 285 — a fifth of what somebody typed, cut mid-word,
                with no ellipsis, because React Native Web compiles the clamp to
                `overflow: clip`. A customer who spends the whole allowance on
                access details cannot check what they asked for. Two hundred
                characters is four or five lines on a page that already scrolls.
              */}
              {line.specialInstructions ? (
                <Text variant="caption" color={colors.textMuted}>
                  “{line.specialInstructions}”
                </Text>
              ) : null}
            </View>
            <Text variant="bodyMedium">{formatPrice(line.lineTotal)}</Text>
          </View>
        ))}

        <Divider spacingSize="sm" />

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

      {/* Reaching the store */}
      {canCall || directions ? (
        <Card style={styles.card} padded={false}>
          <View style={styles.contactRows}>
            {canCall ? (
              <ListRow
                title="Call the store"
                // The number alone, not "name · number": the pair wrapped and
                // broke the number across two lines, and the branch is already
                // named in the status card at the top of this screen.
                subtitle={data.storePhone}
                icon="call-outline"
                onPress={() => void callNumber(data.storePhone)}
                accessibilityLabel={`Call ${data.storeName} on ${data.storePhone}`}
                testID="order-call-store"
              />
            ) : null}

            {canCall && directions ? <Divider spacingSize="none" /> : null}

            {directions ? (
              <ListRow
                title="Get directions"
                subtitle={data.storeAddress}
                icon="navigate-outline"
                onPress={() => void openDirections(directions)}
                accessibilityLabel={`Directions to ${data.storeName}, ${data.storeAddress}`}
                testID="order-directions"
              />
            ) : null}
          </View>
        </Card>
      ) : null}

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
          onPress={() => {
            if (!order.data) return;
            // §15 `reorder` — the "repeat ordering" dashboard. Before the call,
            // because `reorder` navigates away.
            track('reorder', { orderId: order.data.id, itemCount: order.data.lines.length });
            void reorder(order.data);
          }}
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
  // ListRow brings its own vertical padding and a 52pt minimum height, so the
  // card is unpadded and only the horizontal inset is applied here — padding
  // the card as well would give these two rows twice the breathing room of
  // every other row in the app.
  contactRows: { paddingHorizontal: spacing.lg },
  actions: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  ratedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
