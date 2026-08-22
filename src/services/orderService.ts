import { businessRules, config } from '@/constants/config';
import type { Order, OrderStatus, OrderStatusEvent, PlaceOrderInput } from '@/types';
import { addMinutes } from '@/utils/datetime';
import { delay, request } from './apiClient';
import { stores } from './data/storeData';
import { savedAddresses, savedPaymentMethods } from './data/accountData';

/**
 * Order service.
 *
 * In mock mode orders live in an in-memory ledger that advances through the
 * real status sequence over time, so Live Tracking exercises genuine state
 * transitions instead of a hard-coded animation.
 */

const STATUS_COPY: Record<OrderStatus, { label: string; description: string }> = {
  received: {
    label: 'Order received',
    description: "We've got your order and sent it to the kitchen.",
  },
  preparing: {
    label: 'Preparing',
    description: 'Your chicken is being battered and dropped into the fryer.',
  },
  ready: {
    label: 'Ready',
    description: 'Boxed, sealed and ready to go.',
  },
  out_for_delivery: {
    label: 'Out for delivery',
    description: 'Your driver has collected the order and is on the way.',
  },
  completed: {
    label: 'Completed',
    description: 'Enjoy. Thanks for ordering with bb.q.',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'This order was cancelled.',
  },
};

/** The status sequence a live order walks through, by fulfilment type. */
export function statusSequence(fulfilmentType: PlaceOrderInput['fulfilmentType']): OrderStatus[] {
  if (fulfilmentType === 'delivery') {
    return ['received', 'preparing', 'ready', 'out_for_delivery', 'completed'];
  }
  return ['received', 'preparing', 'ready', 'completed'];
}

export function statusCopy(status: OrderStatus): { label: string; description: string } {
  return STATUS_COPY[status];
}

/** Label shown for the terminal "collect/deliver" step. */
export function readyLabelFor(fulfilmentType: PlaceOrderInput['fulfilmentType']): string {
  if (fulfilmentType === 'delivery') return 'Out for delivery';
  if (fulfilmentType === 'collection') return 'Ready for collection';
  return 'Ready at your table';
}

function buildTimeline(
  fulfilmentType: PlaceOrderInput['fulfilmentType'],
  currentStatus: OrderStatus,
  placedAt: Date,
  etaMinutes: number,
): OrderStatusEvent[] {
  const sequence = statusSequence(fulfilmentType);
  const currentIndex = sequence.indexOf(currentStatus);
  const stepMinutes = etaMinutes / Math.max(1, sequence.length - 1);

  return sequence.map((status, index) => {
    const reached = currentIndex >= 0 && index <= currentIndex;
    const label =
      status === 'out_for_delivery' || (status === 'ready' && fulfilmentType !== 'delivery')
        ? readyLabelFor(fulfilmentType)
        : STATUS_COPY[status].label;

    return {
      status,
      label,
      description: STATUS_COPY[status].description,
      occurredAt: reached ? addMinutes(placedAt, Math.round(stepMinutes * index)).toISOString() : null,
    };
  });
}

/** In-memory ledger for mock mode, seeded with realistic order history. */
const ledger: Order[] = [];
let referenceCounter = 4822;

function seedHistory(): void {
  if (ledger.length > 0) return;

  const historyPlacedAt = new Date(Date.now() - 3 * 86_400_000);
  ledger.push({
    id: 'order-4821',
    reference: 'BBQ-4821',
    placedAt: historyPlacedAt.toISOString(),
    fulfilmentType: 'delivery',
    status: 'completed',
    timeline: buildTimeline('delivery', 'completed', historyPlacedAt, 42),
    lines: [
      {
        id: 'honey-garlic__honey-garlic-size:honey-garlic-size-medium',
        productId: 'honey-garlic',
        name: 'Honey Garlic Chicken',
        assetKey: 'honeyGarlic',
        unitBasePrice: 165,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'honey-garlic-size',
            groupName: 'Choose your size',
            optionId: 'honey-garlic-size-medium',
            optionName: 'Medium · 9 pieces',
            priceDelta: 60,
          },
        ],
        unitPrice: 225,
        lineTotal: 225,
      },
      {
        id: 'cheesling-fries__cheesling-fries-size:cheesling-fries-size-regular',
        productId: 'cheesling-fries',
        name: 'Cheesling Fries',
        assetKey: 'cheeslingFries',
        unitBasePrice: 62,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'cheesling-fries-size',
            groupName: 'Size',
            optionId: 'cheesling-fries-size-regular',
            optionName: 'Regular',
            priceDelta: 0,
          },
        ],
        unitPrice: 62,
        lineTotal: 62,
      },
    ],
    totals: {
      subtotal: 287,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 324,
      pointsEarned: 287,
    },
    storeId: 'store-sandton',
    storeName: 'bb.q Chicken Sandton City',
    addressId: 'address-home',
    addressSummary: '14 Acacia Road, Melrose Arch',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 42,
    driverName: 'Sipho',
    rating: 5,
  });

  const olderPlacedAt = new Date(Date.now() - 12 * 86_400_000);
  ledger.push({
    id: 'order-4610',
    reference: 'BBQ-4610',
    placedAt: olderPlacedAt.toISOString(),
    fulfilmentType: 'collection',
    status: 'completed',
    timeline: buildTimeline('collection', 'completed', olderPlacedAt, 25),
    lines: [
      {
        id: 'half-and-half__half-and-half-flavours:half-flavour-golden|half-and-half-flavours:half-flavour-hot',
        productId: 'half-and-half',
        name: 'Half & Half Chicken',
        assetKey: 'halfAndHalf',
        unitBasePrice: 189,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'half-and-half-flavours',
            groupName: 'Pick your two flavours',
            optionId: 'half-flavour-golden',
            optionName: 'Golden Original',
            priceDelta: 0,
          },
          {
            groupId: 'half-and-half-flavours',
            groupName: 'Pick your two flavours',
            optionId: 'half-flavour-hot',
            optionName: 'Hot Spicy',
            priceDelta: 0,
          },
          {
            groupId: 'half-and-half-size',
            groupName: 'Choose your size',
            optionId: 'half-and-half-size-large',
            optionName: 'Large · 12 pieces',
            priceDelta: 115,
          },
        ],
        unitPrice: 304,
        lineTotal: 304,
      },
    ],
    totals: {
      subtotal: 304,
      deliveryFee: 0,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 309,
      pointsEarned: 304,
    },
    storeId: 'store-rosebank',
    storeName: 'bb.q Chicken Rosebank',
    paymentMethodLabel: 'Mastercard ending 7702',
    etaMinutes: 25,
    rating: 4,
    ratingComment: 'Crispy as always, collection was quick.',
  });
}

/**
 * Advance a mock order based on how long ago it was placed, so tracking
 * reflects the passage of real time between screen visits.
 */
function advance(order: Order): Order {
  if (order.status === 'completed' || order.status === 'cancelled') return order;

  const sequence = statusSequence(order.fulfilmentType);
  const elapsedMinutes = (Date.now() - new Date(order.placedAt).getTime()) / 60_000;
  const stepMinutes = order.etaMinutes / Math.max(1, sequence.length - 1);
  const reachedIndex = Math.min(sequence.length - 1, Math.floor(elapsedMinutes / stepMinutes));
  const status = sequence[reachedIndex] ?? order.status;

  return {
    ...order,
    status,
    timeline: buildTimeline(order.fulfilmentType, status, new Date(order.placedAt), order.etaMinutes),
  };
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (!config.useMockApi) {
    return request<Order>('/v1/orders', { method: 'POST', body: input });
  }

  seedHistory();

  const store = stores.find((candidate) => candidate.id === input.storeId) ?? stores[0];
  const address = savedAddresses.find((candidate) => candidate.id === input.addressId);
  const payment = savedPaymentMethods.find((candidate) => candidate.id === input.paymentMethodId);

  const preparation = store?.preparationMinutes ?? businessRules.defaultPreparationMinutes;
  const etaMinutes =
    input.fulfilmentType === 'delivery'
      ? preparation + businessRules.deliveryBufferMinutes
      : preparation;

  const placedAt = new Date();
  referenceCounter += 1;

  const order: Order = {
    id: `order-${referenceCounter}`,
    reference: `BBQ-${referenceCounter}`,
    placedAt: placedAt.toISOString(),
    fulfilmentType: input.fulfilmentType,
    status: 'received',
    timeline: buildTimeline(input.fulfilmentType, 'received', placedAt, etaMinutes),
    lines: input.lines,
    totals: input.totals,
    storeId: store?.id ?? 'store-sandton',
    storeName: store?.name ?? 'bb.q Chicken',
    ...(address ? { addressId: address.id, addressSummary: `${address.line1}, ${address.suburb}` } : {}),
    ...(input.tableNumber ? { tableNumber: input.tableNumber } : {}),
    ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
    paymentMethodLabel: payment?.label ?? 'Card',
    etaMinutes,
    ...(input.fulfilmentType === 'delivery' ? { driverName: 'Sipho' } : {}),
  };

  ledger.unshift(order);
  return delay(order, 900);
}

export async function fetchOrders(): Promise<Order[]> {
  if (!config.useMockApi) return request<Order[]>('/v1/orders');

  seedHistory();
  const advanced = ledger.map(advance);
  // Keep the ledger in step so a later fetch of one order agrees with the list.
  advanced.forEach((order, index) => {
    ledger[index] = order;
  });
  return delay(advanced);
}

export async function fetchOrder(orderId: string): Promise<Order> {
  if (!config.useMockApi) {
    return request<Order>(`/v1/orders/${encodeURIComponent(orderId)}`);
  }

  seedHistory();
  const index = ledger.findIndex((order) => order.id === orderId || order.reference === orderId);
  const existing = ledger[index];
  if (!existing) throw new Error('Order not found');

  const advanced = advance(existing);
  ledger[index] = advanced;
  return delay(advanced, 200);
}

/** The order the customer should currently be tracking, if any. */
export async function fetchActiveOrder(): Promise<Order | null> {
  const orders = await fetchOrders();
  return (
    orders.find((order) => order.status !== 'completed' && order.status !== 'cancelled') ?? null
  );
}

export async function cancelOrder(orderId: string): Promise<Order> {
  if (!config.useMockApi) {
    return request<Order>(`/v1/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
  }

  const index = ledger.findIndex((order) => order.id === orderId);
  const existing = ledger[index];
  if (!existing) throw new Error('Order not found');
  if (existing.status !== 'received') {
    throw new Error('This order is already being prepared and can no longer be cancelled.');
  }

  const cancelled: Order = { ...existing, status: 'cancelled' };
  ledger[index] = cancelled;
  return delay(cancelled, 300);
}

export async function rateOrder(
  orderId: string,
  rating: number,
  comment?: string,
): Promise<Order> {
  if (!config.useMockApi) {
    return request<Order>(`/v1/orders/${encodeURIComponent(orderId)}/rating`, {
      method: 'POST',
      body: { rating, comment },
    });
  }

  const index = ledger.findIndex((order) => order.id === orderId);
  const existing = ledger[index];
  if (!existing) throw new Error('Order not found');

  const rated: Order = {
    ...existing,
    rating,
    ...(comment && comment.trim().length > 0 ? { ratingComment: comment.trim() } : {}),
  };
  ledger[index] = rated;
  return delay(rated, 400);
}
