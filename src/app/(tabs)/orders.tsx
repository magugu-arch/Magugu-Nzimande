import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Order, Product } from '@/types';
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
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { useMenu } from '@/features/menu/hooks';
import { useOrders } from '@/features/orders/hooks';
import { readyLabelFor, statusCopy } from '@/services/orderService';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing, CART_BAR_HEIGHT, TAB_BAR_HEIGHT } from '@/theme';
import { formatDateTime, formatEtaWindow, formatRelativeDay } from '@/utils/datetime';
import { formatPrice } from '@/utils/money';

type Filter = 'active' | 'past';

/** Order History + Re-order (brief §4). */
export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const orders = useOrders();
  const menu = useMenu();
  const addLine = useCartStore((state) => state.addLine);

  const [filter, setFilter] = useState<Filter>('active');

  const { active, past } = useMemo(() => {
    const list = orders.data ?? [];
    return {
      active: list.filter((order) => order.status !== 'completed' && order.status !== 'cancelled'),
      past: list.filter((order) => order.status === 'completed' || order.status === 'cancelled'),
    };
  }, [orders.data]);

  const visible = filter === 'active' ? active : past;

  const handleReorder = useCallback(
    (order: Order) => {
      if (!menu.data) return;
      const products = new Map<string, Product>(
        menu.data.products.map((product) => [product.id, product]),
      );

      let added = 0;
      order.lines.forEach((line) => {
        const product = products.get(line.productId);
        if (!product?.available) return;
        addLine(product, line.selectedOptions, line.quantity, line.specialInstructions);
        added += 1;
      });

      if (added > 0) router.push('/cart');
    },
    [menu.data, addLine, router],
  );

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
            onReorder={() => handleReorder(item)}
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
  const isActive = order.status !== 'completed' && order.status !== 'cancelled';
  const completedSteps = order.timeline.filter((event) => event.occurredAt !== null).length;
  const firstLine = order.lines[0];

  return (
    <Card
      onPress={onPress}
      raised={isActive}
      accessibilityLabel={`Order ${order.reference}, ${statusCopy(order.status).label}`}
      testID={`order-card-${order.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeadings}>
          <Text variant="caption" color={colors.textMuted}>
            {formatRelativeDay(order.placedAt)} · {order.reference}
          </Text>
          <Text variant="h3">{statusCopy(order.status).label}</Text>
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
            {order.scheduledFor
              ? `Scheduled · ${formatDateTime(order.scheduledFor)}`
              : `${readyLabelFor(order.fulfilmentType)} in ${formatEtaWindow(order.etaMinutes)}`}
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
