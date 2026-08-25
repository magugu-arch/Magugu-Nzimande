import { businessRules, config } from '@/constants/config';
import type { Order, OrderStatus, OrderStatusEvent, PlaceOrderInput } from '@/types';
import { addMinutes } from '@/utils/datetime';
import { delay, request } from './apiClient';
import { stores } from './data/storeData';
import { currentAddresses, currentPaymentMethods } from './accountService';
import { describePaymentMethod } from './paymentService';
import { fetchReward, markVoucherUsed, recordPoints, restoreVoucher } from './rewardsService';

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
  /** When the kitchen starts. Same as `placedAt` unless the order is scheduled. */
  startedAt: Date = placedAt,
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
      occurredAt: reached
        ? // "Received" is when the customer placed it, which for a scheduled
          // order is not when the kitchen picks it up. Every later step runs
          // off the kitchen's clock.
          (index === 0
            ? placedAt
            : addMinutes(startedAt, Math.round(stepMinutes * index))
          ).toISOString()
        : null,
    };
  });
}

/** In-memory ledger for mock mode, seeded with realistic order history. */
const ledger: Order[] = [];
let referenceCounter = 4822;

/**
 * The store details an order carries with it: how to phone the branch and how
 * to drive to it. Derived from the store record rather than typed out at each
 * call site, so a seeded order and a freshly placed one can never disagree
 * about where the same branch is.
 */
function storeSnapshot(
  storeId: string,
): Pick<
  Order,
  'storeId' | 'storeName' | 'storePhone' | 'storeAddress' | 'storeLatitude' | 'storeLongitude'
> {
  const store = stores.find((candidate) => candidate.id === storeId) ?? stores[0];

  return {
    storeId: store?.id ?? storeId,
    storeName: store?.name ?? 'bb.q Chicken',
    storePhone: store?.phone ?? '',
    storeAddress: store ? `${store.addressLine}, ${store.suburb}` : '',
    storeLatitude: store?.latitude ?? 0,
    storeLongitude: store?.longitude ?? 0,
  };
}

function seedHistory(): void {
  if (ledger.length > 0) return;
  // Somebody who installed the app this morning has never ordered.
  if (config.seedProfile === 'new-customer') return;

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
    ...storeSnapshot('store-sandton'),
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
    ...storeSnapshot('store-rosebank'),
    paymentMethodLabel: 'Mastercard ending 7702',
    etaMinutes: 25,
    rating: 4,
    ratingComment: 'Crispy as always, collection was quick.',
  });
}

/**
 * When the kitchen actually starts an order.
 *
 * For an ASAP order that is the moment it was placed. For a scheduled one it
 * is `etaMinutes` before the slot, so the food is ready when the customer
 * asked for it rather than the instant they paid.
 *
 * Never earlier than `placedAt`: a slot inside the preparation window would
 * otherwise start the kitchen's clock before the order existed.
 */
export function workStartsAt(order: Order): Date {
  const placed = new Date(order.placedAt);
  if (!order.scheduledFor) return placed;

  const due = new Date(order.scheduledFor);
  if (Number.isNaN(due.getTime())) return placed;

  const start = addMinutes(due, -order.etaMinutes);
  return start.getTime() < placed.getTime() ? placed : start;
}

/**
 * Minutes until this order is due, from now. Negative once it is overdue.
 *
 * `etaMinutes` is how long the order takes, counted from when the kitchen
 * starts — a property of the order, fixed when it is placed. Tracking printed
 * it directly, so the line never moved. Driven in a browser, advancing the
 * clock a quarter of an hour at a time:
 *
 *     t+0min  : Out for delivery in 35 – 45 min
 *     t+15min : Out for delivery in 35 – 45 min
 *     t+30min : Out for delivery in 35 – 45 min
 *     t+45min : Out for delivery in 35 – 45 min
 *
 * Three quarters of an hour after ordering — through preparing, ready and out
 * with a driver — still forty minutes away, on the one screen a hungry person
 * actually watches. The progress bar beside it was moving the whole time,
 * which makes it worse: two things on the same card, one of them true.
 *
 * Counted from `workStartsAt` rather than `placedAt`, so an order booked for
 * tomorrow evening is not reported as forty minutes overdue all night.
 */
export function minutesUntilDue(order: Order, now: Date = new Date()): number {
  const due = addMinutes(workStartsAt(order), order.etaMinutes);
  return Math.round((due.getTime() - now.getTime()) / 60_000);
}

/**
 * Advance a mock order, so tracking reflects the passage of real time between
 * screen visits.
 *
 * Measured from when the kitchen starts, not from when the customer paid.
 * This counted from `placedAt` and ignored `scheduledFor` entirely: an order
 * booked for tomorrow at 18:00 and paid for at 14:00 today read "Completed —
 * Enjoy. Thanks for ordering with bb.q." by 14:42 the same afternoon, and
 * dropped out of Active into Past orders. Verified in a browser before the
 * fix.
 *
 * It was never going to ship — the real backend drives status and this runs
 * only against the mock. It still had to go. The mock is what the franchise
 * is shown before the backend exists, and it is the contract the backend gets
 * built against; a demo that marks tomorrow's dinner delivered sends someone
 * chasing a bug that is really a wrong idea about what an order means.
 * Scheduling also stopped being an edge case the moment closed branches
 * started telling customers to schedule.
 */
function advance(order: Order): Order {
  if (order.status === 'completed' || order.status === 'cancelled') return order;

  const sequence = statusSequence(order.fulfilmentType);
  const placedAt = new Date(order.placedAt);
  const startedAt = workStartsAt(order);

  const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60_000;
  const stepMinutes = order.etaMinutes / Math.max(1, sequence.length - 1);
  // Clamped at both ends: a scheduled order sits at "received" until its slot
  // comes round, rather than indexing off the front of the sequence.
  const reachedIndex = Math.max(
    0,
    Math.min(sequence.length - 1, Math.floor(elapsedMinutes / stepMinutes)),
  );
  const status = sequence[reachedIndex] ?? order.status;

  return {
    ...order,
    status,
    timeline: buildTimeline(order.fulfilmentType, status, placedAt, order.etaMinutes, startedAt),
  };
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (!config.useMockApi) {
    return request<Order>('/v1/orders', { method: 'POST', body: input });
  }

  seedHistory();

  const store = stores.find((candidate) => candidate.id === input.storeId) ?? stores[0];
  // Asked of the ledgers as they stand, not of the arrays they were seeded
  // from — otherwise an address the customer added this morning does not
  // exist as far as their order is concerned.
  const address = currentAddresses().find((candidate) => candidate.id === input.addressId);
  const payment = currentPaymentMethods().find(
    (candidate) => candidate.id === input.paymentMethodId,
  );

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
    ...storeSnapshot(input.storeId),
    ...(address
      ? { addressId: address.id, addressSummary: `${address.line1}, ${address.suburb}` }
      : {}),
    ...(input.tableNumber ? { tableNumber: input.tableNumber } : {}),
    ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
    // A saved card has a label worth showing — "Visa ending 4821" tells them
    // which card. A rail has no saved record to find, so the type names it.
    // Falling back to a flat 'Card' put "Paid with: Card" on the receipt for
    // an order somebody is paying for in cash at their front door.
    paymentMethodLabel: payment?.label ?? describePaymentMethod(input.paymentMethodType),
    ...(input.redeemedRewardId ? { redeemedRewardId: input.redeemedRewardId } : {}),
    ...(input.voucherCode ? { voucherCode: input.voucherCode } : {}),
    etaMinutes,
    ...(input.fulfilmentType === 'delivery' ? { driverName: 'Sipho' } : {}),
  };

  ledger.unshift(order);

  /**
   * Settle the points with the order, which is where `redeemedRewardId` on
   * the payload says they settle.
   *
   * Spent first, then earned, so the balance never dips below nought on the
   * way through. The server owns the real judgement of whether the customer
   * still had the points by the time the order arrived — this records, it does
   * not adjudicate.
   */
  if (input.redeemedRewardId) {
    const reward = await fetchReward(input.redeemedRewardId).catch(() => null);
    if (reward) {
      recordPoints({
        description: `${reward.name} · order ${order.reference}`,
        points: -reward.pointsCost,
        orderReference: order.reference,
      });
    }
  }

  // A one-time code is only one-time if something spends it.
  if (input.voucherCode) markVoucherUsed(input.voucherCode);

  if (input.totals.pointsEarned > 0) {
    recordPoints({
      description: `Order ${order.reference}`,
      points: input.totals.pointsEarned,
      lifetimeDelta: input.totals.pointsEarned,
      orderReference: order.reference,
    });
  }

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

  /**
   * Asked of where the order has actually got to, not of what was last
   * written down about it.
   *
   * Every other read in this file advances the order first — the status is
   * derived from the clock, so a stored one is only as fresh as the last time
   * somebody happened to look. This was the exception, and it was the one
   * place where the stored value decided something. Two hours after placing:
   *
   *     nobody opened the app  → CANCEL SUCCEEDED, status now: cancelled
   *     somebody looked first  → status is completed, and the cancel is refused
   *
   * The same order, at the same moment, cancellable or not depending on
   * whether a screen had fetched it. The kitchen cooked that one and a driver
   * delivered it.
   */
  const current = advance(existing);
  ledger[index] = current;

  if (current.status !== 'received') {
    throw new Error(cannotCancelBecause(current.status));
  }

  const cancelled: Order = { ...current, status: 'cancelled' };
  ledger[index] = cancelled;

  /**
   * Put the points back exactly as they were before this order.
   *
   * The earning is reversed against lifetime as well as the balance — those
   * points were never really earned, so they must not go on holding up a tier.
   * A spent reward is refunded to the balance only, which is where it came
   * from.
   */
  if (cancelled.totals.pointsEarned > 0) {
    recordPoints({
      description: `Order ${cancelled.reference} cancelled`,
      points: -cancelled.totals.pointsEarned,
      lifetimeDelta: -cancelled.totals.pointsEarned,
      orderReference: cancelled.reference,
    });
  }

  if (cancelled.voucherCode) restoreVoucher(cancelled.voucherCode);

  if (cancelled.redeemedRewardId) {
    const reward = await fetchReward(cancelled.redeemedRewardId).catch(() => null);
    if (reward) {
      recordPoints({
        description: `${reward.name} returned · order ${cancelled.reference} cancelled`,
        points: reward.pointsCost,
        orderReference: cancelled.reference,
      });
    }
  }

  return delay(cancelled, 300);
}

/**
 * Why this order cannot be called back, in the customer's terms.
 *
 * One message covered every case — "already being prepared" — which is untrue
 * of an order sitting on a driver's back seat and absurd of one eaten an hour
 * ago. The status is known; saying it costs nothing and tells them whether to
 * phone the branch or let it go.
 */
function cannotCancelBecause(status: OrderStatus): string {
  switch (status) {
    case 'preparing':
      return 'This order is already in the kitchen and can no longer be cancelled.';
    case 'ready':
      return 'This order is cooked and waiting — call the store if something is wrong.';
    case 'out_for_delivery':
      return 'Your driver already has this order — call the store if something is wrong.';
    case 'completed':
      return 'This order has already been delivered.';
    case 'cancelled':
      return 'This order was already cancelled.';
    case 'received':
      // Unreachable: the caller only asks once the status is not 'received'.
      return 'This order can no longer be cancelled.';
  }
}

export async function rateOrder(orderId: string, rating: number, comment?: string): Promise<Order> {
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
