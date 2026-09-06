import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Order } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
  ProgressBar,
  Text,
} from '@/components/ui';
import { isOfflinePending } from '@/features/system/queryPhase';
import { useNow } from '@/features/system/useNow';
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { useOrders } from '@/features/orders/hooks';
import { useReorder } from '@/features/orders/useReorder';
import { minutesUntilDue, readyLabelFor } from '@/services/orderService';
import {
  countdownStillApplies,
  liveStatusCopy,
  runningLate,
  RUNNING_LATE_LABEL,
} from '@/features/orders/liveStatus';
import { AccountRequired, useIsSignedOut } from '@/features/system/AccountRequired';
import { colors, radius, spacing, CART_BAR_HEIGHT, TAB_BAR_HEIGHT } from '@/theme';
import { formatDateTime, formatEtaWindow, formatRelativeDay } from '@/utils/datetime';
import { formatPrice } from '@/utils/money';

type Filter = 'active' | 'past';

/** Order History + Re-order (brief §4). */
export default function OrdersScreen() {
  const signedOut = useIsSignedOut();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const orders = useOrders();

  const [filter, setFilter] = useState<Filter>('active');

  const { active, past } = useMemo(() => {
    const list = orders.data ?? [];
    return {
      active: list.filter((order) => order.status !== 'completed' && order.status !== 'cancelled'),
      past: list.filter((order) => order.status === 'completed' || order.status === 'cancelled'),
    };
  }, [orders.data]);

  const visible = filter === 'active' ? active : past;

  const handleReorder = useReorder();

  // The app offers "Continue as guest" and then brought them here, to a screen
  // made entirely of account data. Only Profile ever checked.
  if (signedOut) {
    return (
      <AccountRequired
        title="Orders"
        message="Sign in to follow an order while it cooks, see what you have had before, and order it again."
        icon="receipt-outline"
        testID="orders-signed-out"
      />
    );
  }

  const renderBody = () => {
    if (orders.isLoading) return <LoadingState message="Fetching your orders…" />;
    // Offline is not empty and not broken. Without this the screen falls
    // through to a factual claim it cannot back up.
    if (isOfflinePending(orders)) return <OfflineState onRetry={() => void orders.refetch()} />;
    if (orders.isError) return <ErrorState onRetry={() => void orders.refetch()} />;

    if (visible.length === 0) {
      return filter === 'active' ? (
        <EmptyState
          icon="receipt-outline"
          title="No orders on the go"
          message="Nothing cooking right now. Have a look at what is on the menu."
          actionLabel="Browse the menu"
          onActionPress={() => router.push('/(tabs)/menu')}
          testID="orders-empty-active"
        />
      ) : (
        <EmptyState
          icon="time-outline"
          title="No past orders yet"
          message="Once you have ordered, everything lands here so you can reorder in two taps."
          actionLabel="Start an order"
          onActionPress={() => router.push('/(tabs)/menu')}
          testID="orders-empty-past"
        />
      );
    }

    return (
      <FlatList
        data={visible}
        keyExtractor={(order) => order.id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => router.push(`/order/${item.id}`)}
            onReorder={() => void handleReorder(item)}
            onRate={() => router.push(`/order/${item.id}/rate`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_HEIGHT + CART_BAR_HEIGHT }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={orders.isRefetching}
            onRefresh={() => void orders.refetch()}
            tintColor={colors.primary}
          />
        }
      />
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text variant="h1">Orders</Text>
        <View style={styles.filters}>
          <Chip
            label={`Active${active.length > 0 ? ` (${active.length})` : ''}`}
            selected={filter === 'active'}
            onPress={() => setFilter('active')}
            testID="orders-filter-active"
          />
          <Chip
            label="Past orders"
            selected={filter === 'past'}
            onPress={() => setFilter('past')}
            testID="orders-filter-past"
          />
        </View>
      </View>

      <View style={styles.body}>{renderBody()}</View>

      <StickyCartBar offsetBottom={TAB_BAR_HEIGHT} />
    </View>
  );
}

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  onReorder: () => void;
  onRate: () => void;
}

function OrderCard({ order, onPress, onReorder, onRate }: OrderCardProps) {
  const now = useNow();
  const isActive = order.status !== 'completed' && order.status !== 'cancelled';
  /**
   * A countdown, the same one the tracking screen shows.
   *
   * This printed `order.etaMinutes` — how long the order *takes*, fixed when
   * it was placed — so the card never moved. Tracking was found doing exactly
   * this and fixed; the card that leads to tracking was not, and nothing
   * noticed, because every seeded order was finished and the Active list was
   * empty by construction. With a live one in the seed the two screens
   * disagree out loud: "Out for delivery in 40 – 50 min" on the list, eight
   * minutes on the detail, same order, same second.
   *
   * Past due the window is dropped rather than restated or turned negative,
   * again matching tracking. The status line above already says where the
   * order is, and a time nobody believes is worse than no time.
   */
  const dueInMinutes = minutesUntilDue(order, now);
  const completedSteps = order.timeline.filter((event) => event.occurredAt !== null).length;
  const firstLine = order.lines[0];

  return (
    <Card
      onPress={onPress}
      raised={isActive}
      accessibilityLabel={`Order ${order.reference}, ${liveStatusCopy(order).label}`}
      testID={`order-card-${order.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeadings}>
          <Text variant="caption" color={colors.textMuted}>
            {formatRelativeDay(order.placedAt)} · {order.reference}
          </Text>
          <Text variant="h3">{liveStatusCopy(order).label}</Text>
        </View>

        <Badge
          label={
            order.fulfilmentType === 'delivery'
              ? 'Delivery'
              : order.fulfilmentType === 'collection'
                ? 'Collection'
                : 'Dine-in'
          }
          tone="neutral"
        />
      </View>

      {isActive ? (
        <>
          <ProgressBar
            progress={completedSteps / Math.max(1, order.timeline.length)}
            style={styles.progress}
            accessibilityLabel="Order progress"
          />
          <Text variant="caption" color={colors.primary}>
            {/*
              The same two rules as the tracking hero, because this card makes
              the same two claims: a countdown that has nothing left to measure
              (a collection order already boxed, or a delivery that failed), and
              a status sentence the courier leg has overruled.
            */}
            {order.scheduledFor
              ? runningLate(order, now)
                ? `Scheduled · ${formatDateTime(order.scheduledFor)} · ${RUNNING_LATE_LABEL.toLowerCase()}`
                : `Scheduled · ${formatDateTime(order.scheduledFor)}`
              : dueInMinutes > 0 && countdownStillApplies(order)
                ? `${readyLabelFor(order.fulfilmentType)} in ${formatEtaWindow(dueInMinutes)}`
                : runningLate(order, now)
                  ? RUNNING_LATE_LABEL
                  : liveStatusCopy(order).description}
          </Text>
        </>
      ) : null}

      <View style={styles.cardBody}>
        {firstLine ? (
          <FoodImage
            assetKey={firstLine.assetKey}
            variant="thumb"
            rounded="sm"
            compactPlaceholder
            style={styles.cardImage}
          />
        ) : null}

        <View style={styles.cardSummary}>
          <Text variant="bodyMedium" numberOfLines={2}>
            {order.lines.map((line) => `${line.quantity}× ${line.name}`).join(', ')}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {order.storeName}
          </Text>
        </View>

        <Text variant="price">{formatPrice(order.totals.total)}</Text>
      </View>

      {!isActive ? (
        <View style={styles.cardActions}>
          <Button
            label="Reorder"
            onPress={onReorder}
            variant="secondary"
            size="sm"
            iconLeft="repeat"
            fullWidth={false}
            style={styles.cardAction}
            testID={`order-reorder-${order.id}`}
          />
          {order.status === 'completed' && order.rating === undefined ? (
            <Button
              label="Rate"
              onPress={onRate}
              variant="tertiary"
              size="sm"
              iconLeft="star-outline"
              fullWidth={false}
              style={styles.cardAction}
            />
          ) : order.rating !== undefined ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={colors.primary} />
              <Text variant="caption" color={colors.textSecondary}>
                {order.rating}/5
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: {
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  filters: { flexDirection: 'row', gap: spacing.sm },
  body: { flex: 1 },
  list: { padding: spacing.lg },
  gap: { height: spacing.md },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardHeadings: { flex: 1, gap: spacing.xxs },
  progress: { marginTop: spacing.md },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cardImage: { width: 52, borderRadius: radius.sm },
  cardSummary: { flex: 1, gap: spacing.xxs },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  cardAction: { flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
