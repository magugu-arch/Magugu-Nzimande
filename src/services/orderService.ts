import { businessRules, config } from '@/constants/config';
import type { Order, OrderStatus, OrderStatusEvent, PlaceOrderInput } from '@/types';
import { addMinutes } from '@/utils/datetime';
import { delay, request } from './apiClient';
import { stores } from './data/storeData';
import { currentAddresses, currentPaymentMethods } from './accountService';
import { describePaymentMethod } from './paymentService';
import { fetchReward, markVoucherUsed, recordPoints, restoreVoucher } from './rewardsService';
import { deliveryProvider, deliveryStatusToOrderStatus } from '@/providers/delivery';
import { checkedOrder, checkedOrders } from './wireChecks';

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
  courier_assigned: {
    label: 'Driver assigned',
    description: 'A driver is on the way to the store to collect your order.',
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
    return ['received', 'preparing', 'ready', 'courier_assigned', 'out_for_delivery', 'completed'];
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
    // Omitted rather than zeroed when there is no branch to read them off.
    // `0, 0` is a point in the Gulf of Guinea, and the tracking screen would
    // have offered directions to it.
    ...(store ? { storeLatitude: store.latitude, storeLongitude: store.longitude } : {}),
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
/** The kitchen's share of the estimate — the road is the courier's. */
function kitchenMinutes(order: Order): number {
  return order.fulfilmentType === 'delivery'
    ? Math.max(1, order.etaMinutes - businessRules.deliveryBufferMinutes)
    : order.etaMinutes;
}

/**
 * When the food actually reached the counter.
 *
 * A courier job is anchored to this rather than to the moment somebody opened
 * the app. The mock creates jobs lazily on read — there is no server to create
 * them on time — and without backdating, an order fetched an hour late would
 * start its courier leg an hour late, so a delivery could never complete unless
 * a screen happened to be watching. That is the same defect this file already
 * warns about in `advance`: looking at an order must not change it.
 */
function readyAt(order: Order): Date {
  return addMinutes(workStartsAt(order), kitchenMinutes(order));
}

function advance(order: Order): Order {
  if (order.status === 'completed' || order.status === 'cancelled') return order;

  const sequence = statusSequence(order.fulfilmentType);
  const placedAt = new Date(order.placedAt);
  const startedAt = workStartsAt(order);

  /**
   * How far the *kitchen* can take an order, which is not all the way.
   *
   * A delivery order's steps past "ready" belong to the courier network, and
   * this function has no knowledge of it — so without a ceiling the clock alone
   * would walk an order into "Driver assigned" and "Out for delivery" on
   * nothing but elapsed minutes. It did, and a browser run caught it: the
   * timeline announced a driver two minutes before `attachDelivery` had asked
   * for one, and the courier card underneath stayed empty because there was no
   * driver to name.
   *
   * The kitchen owns cooking and stops at the counter. `attachDelivery` takes
   * it from there, on the provider's word.
   */
  const ceiling =
    order.fulfilmentType === 'delivery' ? sequence.indexOf('ready') : sequence.length - 1;

  const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60_000;
  // Paced over the kitchen's own share of the estimate. A delivery ETA is
  // preparation *plus* the road, and the road is the courier's; pacing the
  // kitchen over the whole figure would have food sitting uncooked for the
  // length of a drive nobody has started.
  const stepMinutes = kitchenMinutes(order) / Math.max(1, ceiling);
  // Clamped at both ends: a scheduled order sits at "received" until its slot
  // comes round, rather than indexing off the front of the sequence.
  const reachedIndex = Math.max(0, Math.min(ceiling, Math.floor(elapsedMinutes / stepMinutes)));
  // Never backwards: an order already handed to a courier is past anything the
  // kitchen has to say about it.
  const currentIndex = sequence.indexOf(order.status);
  const status = sequence[Math.max(reachedIndex, currentIndex)] ?? order.status;

  return {
    ...order,
    status,
    timeline: buildTimeline(order.fulfilmentType, status, placedAt, order.etaMinutes, startedAt),
  };
}

/**
 * Bring the courier leg up to date, and let it drive the customer's status.
 *
 * Separate from `advance` because a provider call is asynchronous and `advance`
 * is not — and because the kitchen and the courier network are genuinely two
 * systems running in parallel once an order is placed. `advance` owns the
 * kitchen. This owns the courier, and reconciles the two.
 *
 * Three rules, each of which is a defect avoided:
 *
 *   - A courier is requested when there is something to collect, not when the
 *     order is placed. Requesting at placement would have a driver dispatched
 *     to a store for food that is twenty minutes from existing, and for a
 *     scheduled order, hours.
 *   - The courier can move the customer's status forward and never back. The
 *     two clocks do not agree — a provider that has not yet reported pickup
 *     must not drag a customer who has been told "on the way" back to "ready".
 *   - A provider failure is not an order failure. If the courier network is
 *     unreachable the order keeps the status the kitchen gave it; a delivery
 *     that cannot be tracked is still a delivery, and an exception here would
 *     take out the tracking screen for an order that is perfectly fine.
 */
async function attachDelivery(order: Order, idempotencyKey?: string): Promise<Order> {
  if (order.fulfilmentType !== 'delivery') return order;
  /**
   * A finished order has nothing left to arrange, and this guard is the whole
   * reason the function checks anything before calling out.
   *
   * Without it, every delivery order in the history qualified — `completed` is
   * past `ready`, so the "kitchen has something to collect" test passed — and
   * opening the Orders tab dispatched a courier for an order delivered last
   * week. Once per order, per list fetch, against a real network that bills
   * for it. The seeded history alone did it to BBQ-4821 every time.
   *
   * The job itself is kept: it is part of the record of how that order got
   * there. It is simply never asked about again.
   */
  if (order.status === 'completed' || order.status === 'cancelled') return order;

  const sequence = statusSequence(order.fulfilmentType);
  const kitchenReachedReady = sequence.indexOf(order.status) >= sequence.indexOf('ready');
  if (!order.delivery && !kitchenReachedReady) return order;

  const provider = deliveryProvider();
  try {
    const job = order.delivery
      ? await provider.getStatus(order.delivery.externalJobId)
      : await provider.create({
          orderId: order.id,
          orderReference: order.reference,
          storeId: order.storeId,
          dropoffSummary: order.addressSummary ?? '',
          ...(order.deliveryLatitude !== undefined
            ? { dropoffLatitude: order.deliveryLatitude }
            : {}),
          ...(order.deliveryLongitude !== undefined
            ? { dropoffLongitude: order.deliveryLongitude }
            : {}),
          // The order's own key, so one order cannot become two courier jobs.
          idempotencyKey: idempotencyKey ?? order.reference,
          readyAt: readyAt(order).toISOString(),
        });

    const courierStatus = deliveryStatusToOrderStatus(job.status);
    // Forward only. `indexOf` returns -1 for a status outside the sequence —
    // 'cancelled' is the one — and -1 can never win a Math.max against an
    // index, which is the behaviour wanted: a cancelled courier job does not
    // silently cancel the customer's order. `cancelOrder` is the only thing
    // that cancels an order.
    const furthest = Math.max(sequence.indexOf(order.status), sequence.indexOf(courierStatus));
    const status = sequence[furthest] ?? order.status;

    return {
      ...order,
      status,
      delivery: job,
      // The driver's name comes from the job, so it exists only once somebody
      // is actually assigned to this order.
      ...(job.courierName ? { driverName: job.courierName } : {}),
      timeline: buildTimeline(
        order.fulfilmentType,
        status,
        new Date(order.placedAt),
        order.etaMinutes,
        workStartsAt(order),
      ),
    };
  } catch {
    // The courier network is not the order. See the third rule above.
    return order;
  }
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (!config.useMockApi) {
    return request<Order>('/v1/orders', { method: 'POST', body: input, parse: checkedOrder });
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
      ? {
          addressId: address.id,
          addressSummary: `${address.line1}, ${address.suburb}`,
          ...(address.latitude !== undefined ? { deliveryLatitude: address.latitude } : {}),
          ...(address.longitude !== undefined ? { deliveryLongitude: address.longitude } : {}),
        }
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
    // No `driverName` here. There is no driver at placement — one is assigned
    // by the courier network later, and `attachDelivery` copies the name off
    // the job when there is one. Naming a stranger on a customer's screen
    // before anybody has been dispatched is the same class of invention as a
    // coordinate that defaults to the Johannesburg CBD.
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
  if (!config.useMockApi) return request<Order[]>('/v1/orders', { parse: checkedOrders });

  seedHistory();
  // The kitchen first, then the courier — `attachDelivery` reads the status
  // `advance` produced and may only move it further along.
  const advanced = await Promise.all(ledger.map((order) => attachDelivery(advance(order))));
  // Keep the ledger in step so a later fetch of one order agrees with the list.
  advanced.forEach((order, index) => {
    ledger[index] = order;
  });
  return delay(advanced);
}

export async function fetchOrder(orderId: string): Promise<Order> {
  if (!config.useMockApi) {
    return request<Order>(`/v1/orders/${encodeURIComponent(orderId)}`, { parse: checkedOrder });
  }

  seedHistory();
  const index = ledger.findIndex((order) => order.id === orderId || order.reference === orderId);
  const existing = ledger[index];
  if (!existing) throw new Error('Order not found');

  const advanced = await attachDelivery(advance(existing));
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
    return request<Order>(`/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      parse: checkedOrder,
    });
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
  // The courier as well as the kitchen. Advancing one without the other was
  // the same defect this comment warns about, one layer down: whether an order
  // could be cancelled would depend on which code path had last looked at it.
  const current = await attachDelivery(advance(existing));
  ledger[index] = current;

  if (current.status !== 'received') {
    throw new Error(cannotCancelBecause(current.status));
  }

  const cancelled: Order = { ...current, status: 'cancelled' };
  ledger[index] = cancelled;

  /**
   * Release the courier, if one was ever requested.
   *
   * Unreachable in the mock as it stands — cancellation is refused past
   * 'received' and a courier is not requested until 'ready', so the two
   * windows do not overlap. It is here because those are two independent
   * decisions that a real cancellation policy will not necessarily keep apart,
   * and the failure it prevents is a driver dispatched to collect an order
   * nobody is going to hand over. Failure to cancel is swallowed: the customer's
   * order is cancelled either way, and a stranded courier job is the courier
   * network's to reconcile, not a reason to refuse the cancellation.
   */
  if (cancelled.delivery) {
    await deliveryProvider()
      .cancel(cancelled.delivery.externalJobId)
      .catch(() => undefined);
  }

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
    case 'courier_assigned':
      return 'A driver is already on the way to collect this — call the store if something is wrong.';
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

/** The scale the star picker offers, and the only one worth storing. */
export const RATING_RANGE = { min: 1, max: 5 } as const;

/**
 * Rate an order that was actually delivered, out of five.
 *
 * Three things were missing, and the first is the same bug `cancelOrder` had:
 * this read the stored status, and every other read in this file advances the
 * order first — so an order that had finished but that nobody had looked at
 * since would still read as "received". `cancelOrder` was fixed and its
 * sibling was not.
 *
 * The rest came out of driving it:
 *
 *     cancelled order rating: cancelled → 5 Lovely
 *     out-of-range rating: 99
 *
 * Five stars for food that was never cooked, and ninety-nine stars on a
 * five-star scale. Neither is reachable from the star picker, which offers one
 * to five on a completed order only — but a screen is not a rule, and this is
 * where the rule belongs. The same reasoning as the closed-kitchen check:
 * the screens showed "Closed" and the service took the order anyway.
 */
export async function rateOrder(orderId: string, rating: number, comment?: string): Promise<Order> {
  if (!Number.isInteger(rating) || rating < RATING_RANGE.min || rating > RATING_RANGE.max) {
    throw new Error(`A rating is ${RATING_RANGE.min} to ${RATING_RANGE.max} stars.`);
  }

  if (!config.useMockApi) {
    return request<Order>(`/v1/orders/${encodeURIComponent(orderId)}/rating`, {
      method: 'POST',
      body: { rating, comment },
    });
  }

  const index = ledger.findIndex((order) => order.id === orderId);
  const existing = ledger[index];
  if (!existing) throw new Error('Order not found');

  const current = await attachDelivery(advance(existing));
  ledger[index] = current;

  if (current.status === 'cancelled') {
    throw new Error('That order was cancelled, so there is nothing to rate.');
  }
  if (current.status !== 'completed') {
    throw new Error('You can rate this once it has arrived.');
  }

  const rated: Order = {
    ...current,
    rating,
    ...(comment && comment.trim().length > 0 ? { ratingComment: comment.trim() } : {}),
  };
  ledger[index] = rated;
  return delay(rated, 400);
}
