import { businessRules, config } from '@/constants/config';
import type { CartLine, Order, OrderStatus, OrderStatusEvent, PlaceOrderInput } from '@/types';
import { addMinutes } from '@/utils/datetime';
import { delay, request } from './apiClient';
import { stores } from './data/storeData';
import { currentAddresses, currentPaymentMethods } from './accountService';
import { describePaymentMethod } from './paymentService';
import { fetchReward, markVoucherUsed, recordPoints, restoreVoucher } from './rewardsService';
import {
  deliveryProvider,
  deliveryStatusToOrderStatus,
  seedFailedDeliveryJob,
} from '@/providers/delivery';
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
  /** When the order was called off, for a cancelled one. */
  cancelledAt?: Date,
): OrderStatusEvent[] {
  /**
   * A cancelled order did not go on a journey, so it is not shown one.
   *
   * `cancelled` is not a member of `statusSequence` — it is not a step —
   * which meant `indexOf` returned -1, nothing was marked reached, and the
   * screen rendered every remaining step anyway. A customer opening a
   * cancelled order was shown "Driver assigned", "Out for delivery" and,
   * at the bottom, "Completed — Enjoy. Thanks for ordering with bb.q."
   *
   * Nobody saw it because the seeded history had no cancelled order to
   * render, in the app or in the browser sweep. It has one now.
   *
   * What is shown instead is what actually happened: the order was received,
   * and then it was called off. Cancellation is only permitted at 'received',
   * so those two are the whole story.
   */
  if (currentStatus === 'cancelled') {
    return [
      {
        status: 'received',
        label: STATUS_COPY.received.label,
        description: STATUS_COPY.received.description,
        occurredAt: placedAt.toISOString(),
      },
      {
        status: 'cancelled',
        label: STATUS_COPY.cancelled.label,
        description: STATUS_COPY.cancelled.description,
        occurredAt: cancelledAt ? cancelledAt.toISOString() : null,
      },
    ];
  }

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

/**
 * Nine lines, which is more than the whole seeded history put together.
 *
 * Every price here is the menu's: `basePrice` plus the `priceDelta` on the
 * option chosen, taken from `menuData` rather than typed beside it. A basket
 * whose arithmetic drifts from the menu is a fixture that tests nothing.
 *
 *   Golden Original  149 + 115 (Large)               = 264
 *   Hot Spicy        169 + 115 (Large)               = 284
 *   Cheesling        175 +  60 (Medium)              = 235
 *   Boneless         169 +  55 (Medium)              = 224
 *   GO Wings         155 +  65 (10 wings)            = 220
 *   French Fries      45 +  22 (Large) × 2           = 134
 *   Cheesling Fries   62 +   0 (Regular)             =  62
 *   Ddeok-Bokki       72 +  22 (Melted cheese)       =  94
 *   Chicken Burger   109 +   0 (Classic) + 45 (patty)= 154
 *                                             subtotal 1 671
 */
function familyBasket(): CartLine[] {
  return [
    {
      id: 'golden-original__golden-original-size:golden-original-size-large',
      productId: 'golden-original',
      name: 'Golden Original Chicken',
      assetKey: 'goldenOriginal',
      unitBasePrice: 149,
      quantity: 1,
      selectedOptions: [
        {
          groupId: 'golden-original-size',
          groupName: 'Choose your size',
          optionId: 'golden-original-size-large',
          optionName: 'Large · 12 pieces',
          priceDelta: 115,
        },
      ],
      unitPrice: 264,
      lineTotal: 264,
    },
    {
      id: 'hot-spicy__hot-spicy-size:hot-spicy-size-large',
      productId: 'hot-spicy',
      name: 'Hot Spicy Chicken',
      assetKey: 'hotSpicy',
      unitBasePrice: 169,
      quantity: 1,
      selectedOptions: [
        {
          groupId: 'hot-spicy-size',
          groupName: 'Choose your size',
          optionId: 'hot-spicy-size-large',
          optionName: 'Large · 12 pieces',
          priceDelta: 115,
        },
      ],
      unitPrice: 284,
      lineTotal: 284,
    },
    {
      id: 'cheesling__cheesling-size:cheesling-size-medium',
      productId: 'cheesling',
      name: 'Cheesling Chicken',
      assetKey: 'cheesling',
      unitBasePrice: 175,
      quantity: 1,
      selectedOptions: [
        {
          groupId: 'cheesling-size',
          groupName: 'Choose your size',
          optionId: 'cheesling-size-medium',
          optionName: 'Medium · 9 pieces',
          priceDelta: 60,
        },
      ],
      unitPrice: 235,
      lineTotal: 235,
    },
    {
      id: 'boneless__boneless-size:boneless-size-medium',
      productId: 'boneless',
      name: 'Boneless Chicken',
      assetKey: 'boneless',
      unitBasePrice: 169,
      quantity: 1,
      selectedOptions: [
        {
          groupId: 'boneless-size',
          groupName: 'Choose your size',
          optionId: 'boneless-size-medium',
          optionName: 'Medium · 9 pieces',
          priceDelta: 55,
        },
      ],
      unitPrice: 224,
      lineTotal: 224,
    },
    {
      id: 'golden-original-wings__wings-size:wings-size-10',
      productId: 'golden-original-wings',
      name: 'Golden Original Wings',
      assetKey: 'goldenOriginalWings',
      unitBasePrice: 155,
      quantity: 1,
      selectedOptions: [
        {
          groupId: 'wings-size',
          groupName: 'How many wings?',
          optionId: 'wings-size-10',
          optionName: '10 wings',
          priceDelta: 65,
        },
      ],
      unitPrice: 220,
      lineTotal: 220,
    },
    {
      id: 'french-fries__fries-size:fries-size-large',
      productId: 'french-fries',
      name: 'French Fries',
      assetKey: 'frenchFries',
      unitBasePrice: 45,
      quantity: 2,
      selectedOptions: [
        {
          groupId: 'fries-size',
          groupName: 'Size',
          optionId: 'fries-size-large',
          optionName: 'Large',
          priceDelta: 22,
        },
      ],
      unitPrice: 67,
      lineTotal: 134,
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
    {
      id: 'ddeok-bokki__ddeok-extras:ddeok-extra-cheese',
      productId: 'ddeok-bokki',
      name: 'Ddeok-Bokki',
      assetKey: 'ddeokBokki',
      unitBasePrice: 72,
      quantity: 1,
      selectedOptions: [
        {
          groupId: 'ddeok-extras',
          groupName: 'Add to it',
          optionId: 'ddeok-extra-cheese',
          optionName: 'Melted cheese',
          priceDelta: 22,
        },
      ],
      unitPrice: 94,
      lineTotal: 94,
    },
    {
      id: 'chicken-burger__burger-heat:burger-heat-classic|burger-extras:burger-extra-patty',
      productId: 'chicken-burger',
      name: 'Chicken Burger',
      assetKey: 'chickenBurger',
      unitBasePrice: 109,
      quantity: 1,
      selectedOptions: [
        {
          groupId: 'burger-heat',
          groupName: 'Heat level',
          optionId: 'burger-heat-classic',
          optionName: 'Classic',
          priceDelta: 0,
        },
        {
          groupId: 'burger-extras',
          groupName: 'Make it more',
          optionId: 'burger-extra-patty',
          optionName: 'Double the fillet',
          priceDelta: 45,
        },
      ],
      unitPrice: 154,
      lineTotal: 154,
    },
  ];
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
        // And one on a finished order, because "Order again" copies the note
        // forward (`useReorder`) and that copy had never run against a stored
        // one either.
        specialInstructions: 'Extra crispy please.',
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

  /**
   * ── The orders the seed never had ─────────────────────────────────────────
   *
   * Until now the history was two orders, both completed, both delivery or
   * collection, both already rated, neither carrying a discount. That is a
   * tidier customer than anyone has, and it left whole states of the app with
   * no example to render:
   *
   *   cancelled          the tracking screen draws a grey card, a warning
   *                      badge and a struck timeline for it, and nothing in
   *                      the seed had ever put those on a screen
   *   unrated            "Rate this order" only appears on a completed order
   *                      with no rating — so the entry point to the rating
   *                      flow was unreachable without placing an order and
   *                      waiting for it to finish
   *   dine-in            a table number on a receipt
   *   scheduled          a past order that was placed for later, where
   *                      "ordered at" and "was due at" are different facts
   *   voucher and reward the discount lines on a receipt, and the two fields
   *                      that explain them
   *
   * Every one of those is code that ships. A seed that never produces them is
   * a demo that looks finished and a browser sweep that cannot see them.
   */

  // Cancelled, with the voucher it was paid with — the refund path leaves the
  // code on the order so the history can explain itself.
  const cancelledPlacedAt = new Date(Date.now() - 5 * 86_400_000);
  ledger.push({
    id: 'order-4788',
    reference: 'BBQ-4788',
    placedAt: cancelledPlacedAt.toISOString(),
    fulfilmentType: 'delivery',
    status: 'cancelled',
    timeline: buildTimeline(
      'delivery',
      'cancelled',
      cancelledPlacedAt,
      38,
      cancelledPlacedAt,
      new Date(cancelledPlacedAt.getTime() + 4 * 60_000),
    ),
    lines: [
      {
        id: 'golden-original__golden-original-size:golden-original-size-small',
        productId: 'golden-original',
        name: 'Golden Original Chicken',
        assetKey: 'goldenOriginal',
        unitBasePrice: 149,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'golden-original-size',
            groupName: 'Choose your size',
            optionId: 'golden-original-size-small',
            optionName: 'Small · 6 pieces',
            priceDelta: 0,
          },
        ],
        unitPrice: 149,
        lineTotal: 149,
      },
    ],
    totals: {
      subtotal: 149,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 50,
      rewardsDiscount: 0,
      total: 136,
      pointsEarned: 149,
    },
    ...storeSnapshot('store-sandton'),
    addressId: 'address-home',
    addressSummary: '14 Acacia Road, Melrose Arch',
    voucherCode: 'WELCOME50',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 38,
  });

  // Dine-in, completed and **unrated** — the only order in the seed that can
  // reach the rating flow.
  const dineInPlacedAt = new Date(Date.now() - 2 * 86_400_000);
  ledger.push({
    id: 'order-4802',
    reference: 'BBQ-4802',
    placedAt: dineInPlacedAt.toISOString(),
    fulfilmentType: 'dinein',
    status: 'completed',
    timeline: buildTimeline('dinein', 'completed', dineInPlacedAt, 18),
    lines: [
      {
        id: 'hot-spicy__hot-spicy-size:hot-spicy-size-medium',
        productId: 'hot-spicy',
        name: 'Hot Spicy Chicken',
        assetKey: 'hotSpicy',
        unitBasePrice: 159,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'hot-spicy-size',
            groupName: 'Choose your size',
            optionId: 'hot-spicy-size-medium',
            optionName: 'Medium · 9 pieces',
            priceDelta: 60,
          },
        ],
        unitPrice: 219,
        lineTotal: 219,
      },
    ],
    totals: {
      subtotal: 219,
      deliveryFee: 0,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 224,
      pointsEarned: 219,
    },
    ...storeSnapshot('store-rosebank'),
    tableNumber: '12',
    paymentMethodLabel: 'SnapScan',
    etaMinutes: 18,
  });

  /**
   * Scheduled, and collected. Placed at lunchtime for a slot that evening, so
   * `placedAt` and `scheduledFor` are genuinely different — which is the whole
   * point of carrying both, and something no seeded order demonstrated.
   *
   * Also the only order carrying a redeemed reward, so the rewards line on a
   * receipt has an example.
   */
  const scheduledPlacedAt = new Date(Date.now() - 8 * 86_400_000);
  const scheduledFor = new Date(scheduledPlacedAt.getTime() + 6 * 3_600_000);
  ledger.push({
    id: 'order-4655',
    reference: 'BBQ-4655',
    placedAt: scheduledPlacedAt.toISOString(),
    fulfilmentType: 'collection',
    status: 'completed',
    timeline: buildTimeline('collection', 'completed', scheduledPlacedAt, 25, scheduledFor),
    lines: [
      {
        id: 'soy-garlic__soy-garlic-size:soy-garlic-size-large',
        productId: 'soy-garlic',
        name: 'Soy Garlic Chicken',
        assetKey: 'soyGarlic',
        unitBasePrice: 169,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'soy-garlic-size',
            groupName: 'Choose your size',
            optionId: 'soy-garlic-size-large',
            optionName: 'Large · 12 pieces',
            priceDelta: 110,
          },
        ],
        unitPrice: 279,
        lineTotal: 279,
      },
      /**
       * A dish that has since left the menu.
       *
       * Menus change, so an old receipt naturally names things you can no
       * longer buy — and `planReorder` has always handled it: an item that is
       * off the menu or withdrawn goes into `unavailable` and the customer is
       * told by name rather than left to compare a basket against a receipt.
       * Nothing had ever triggered it, because every line in the seeded
       * history pointed at a product still on sale. Tapping "Order again" on
       * this order is the first time that notice can appear.
       */
      {
        id: 'winter-pumpkin-soup',
        productId: 'winter-pumpkin-soup',
        name: 'Winter Pumpkin Soup',
        assetKey: 'frenchFries',
        unitBasePrice: 45,
        quantity: 1,
        selectedOptions: [],
        unitPrice: 45,
        lineTotal: 45,
      },
    ],
    totals: {
      subtotal: 324,
      deliveryFee: 0,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 20,
      total: 309,
      pointsEarned: 324,
    },
    ...storeSnapshot('store-menlyn'),
    scheduledFor: scheduledFor.toISOString(),
    redeemedRewardId: 'reward-fries',
    rewardName: 'Free French Fries',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 25,
    rating: 3,
    ratingComment: 'Good food, but the collection queue was long.',
  });

  /**
   * An order that used a voucher *and* a reward, which no seeded order had.
   *
   * Five orders carried one or the other and never both — `discount` and
   * `rewardsDiscount` are separate fields, separate business decisions and
   * separate lines on a receipt, and the pair had never been rendered
   * anywhere. Somebody who has a welcome code and enough points to spend is
   * not an exotic customer; they are a customer in their first month.
   *
   * It is also the fixture that asks a question nobody has answered.
   * `reward-fries` states "Cannot be combined with another voucher" in its own
   * terms, on a screen a customer reads, and seven other rewards say nothing
   * either way. Nothing in the app enforces any of it — `applyVoucher` and
   * `applyReward` are independent setters and `calculateTotals` subtracts
   * both. Whether rewards stack with vouchers is a commercial decision, so it
   * is written up in `audit:launch` rather than decided here; this order is
   * what the answer will apply to.
   *
   * The arithmetic is spelled out because it is money: R209 for a medium
   * Golden Original plus R45 of fries is R254; the welcome code takes R50 and
   * the fries reward R20 (400 points at the seeded R0.05 a point); R32 of
   * delivery and R5 of service bring it to R221. Points accrue on food value
   * after discounts, so 254 − 50 − 20 = 184.
   */
  const bothPlacedAt = new Date(Date.now() - 8 * 86_400_000);
  ledger.push({
    id: 'order-4795',
    reference: 'BBQ-4795',
    placedAt: bothPlacedAt.toISOString(),
    fulfilmentType: 'delivery',
    status: 'completed',
    timeline: buildTimeline('delivery', 'completed', bothPlacedAt, 40),
    lines: [
      {
        id: 'golden-original__golden-original-size:golden-original-size-medium',
        productId: 'golden-original',
        name: 'Golden Original Chicken',
        assetKey: 'goldenOriginal',
        unitBasePrice: 149,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'golden-original-size',
            groupName: 'Choose your size',
            optionId: 'golden-original-size-medium',
            optionName: 'Medium · 9 pieces',
            priceDelta: 60,
          },
        ],
        unitPrice: 209,
        lineTotal: 209,
      },
      {
        id: 'french-fries__fries-size:fries-size-regular',
        productId: 'french-fries',
        name: 'French Fries',
        assetKey: 'frenchFries',
        unitBasePrice: 45,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'fries-size',
            groupName: 'Size',
            optionId: 'fries-size-regular',
            optionName: 'Regular',
            priceDelta: 0,
          },
        ],
        unitPrice: 45,
        lineTotal: 45,
      },
    ],
    totals: {
      subtotal: 254,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 50,
      rewardsDiscount: 20,
      total: 221,
      pointsEarned: 184,
    },
    ...storeSnapshot('store-fourways'),
    addressId: 'address-home',
    addressSummary: '14 Acacia Road, Melrose Arch',
    voucherCode: 'WELCOME50',
    redeemedRewardId: 'reward-fries',
    rewardName: 'Free French Fries',
    paymentMethodLabel: 'Mastercard ending 7702',
    etaMinutes: 40,
    rating: 4,
  });

  /**
   * An order that is actually happening, which the seed has never had.
   *
   * Four completed and one cancelled: every seeded order was over. So the
   * Orders tab opened on an Active list that was empty by construction — the
   * screen sweep's own notes say as much — and every screen that renders a
   * live order was reachable only by placing one in the session and watching
   * the mock advance it. Nothing cold ever showed a driver, a moving progress
   * bar, or a "cancel this order" refusal.
   *
   * Thirty-four minutes into a forty-two minute delivery, which is chosen
   * rather than picked: it puts the order eight minutes from due — late
   * enough that an estimate fixed at checkout is visibly stale, early enough
   * that it is not overdue — and it puts the courier leg twelve minutes into
   * its own twenty-four, so the mock provider reports a driver actually on the
   * road rather than a job it has only just confirmed. Both clocks have to
   * land inside their windows for the fixture to be one coherent order instead
   * of two systems disagreeing on one screen. `placedAt` is relative, so it
   * stays there whenever anyone opens the app.
   *
   * Seeded at `out_for_delivery` rather than left to the clock, because
   * `advance` deliberately stops the kitchen at "ready" — the road belongs to
   * the courier network, and there is no provider connected here to hand it
   * over. The status is never walked backwards, so this survives the fetch.
   */
  const inFlightPlacedAt = new Date(Date.now() - 34 * 60_000);
  ledger.push({
    id: 'order-4830',
    reference: 'BBQ-4830',
    placedAt: inFlightPlacedAt.toISOString(),
    fulfilmentType: 'delivery',
    status: 'out_for_delivery',
    timeline: buildTimeline('delivery', 'out_for_delivery', inFlightPlacedAt, 42),
    lines: [
      {
        id: 'hot-spicy__hot-spicy-size:hot-spicy-size-medium',
        productId: 'hot-spicy',
        name: 'Hot Spicy Chicken',
        assetKey: 'hotSpicy',
        unitBasePrice: 169,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'hot-spicy-size',
            groupName: 'Choose your size',
            optionId: 'hot-spicy-size-medium',
            optionName: 'Medium · 9 pieces',
            priceDelta: 60,
          },
        ],
        unitPrice: 229,
        lineTotal: 229,
        /**
         * A note to the kitchen, which no seeded order had ever carried.
         *
         * `specialInstructions` is offered on every product screen (200
         * characters, `product/[id]`), survives into the cart, and is drawn on
         * the cart row and again in the checkout review — and then no order in
         * the seed had one, so nothing downstream of payment had ever been
         * asked to render it. Put on the order that is actually happening,
         * because that is where a note matters: somebody watching a courier
         * approach wants to check what they asked for before it arrives.
         */
        specialInstructions: 'Easy on the chilli please — one portion is for a child.',
      },
      {
        id: 'french-fries__fries-size:fries-size-regular',
        productId: 'french-fries',
        name: 'French Fries',
        assetKey: 'frenchFries',
        unitBasePrice: 45,
        quantity: 2,
        selectedOptions: [
          {
            groupId: 'fries-size',
            groupName: 'Size',
            optionId: 'fries-size-regular',
            optionName: 'Regular',
            priceDelta: 0,
          },
        ],
        unitPrice: 45,
        lineTotal: 90,
      },
    ],
    totals: {
      subtotal: 319,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 356,
      pointsEarned: 319,
    },
    ...storeSnapshot('store-rosebank'),
    addressId: 'address-home',
    addressSummary: '14 Acacia Road, Melrose Arch',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 42,
    // No `driverName`: the courier job is what names a driver, and stating it
    // here too would be the same fact in two places with one of them
    // authoritative. `attachDelivery` fills it in on the first fetch.
  });

  /**
   * A delivery that failed, which nothing in the app had ever produced.
   *
   * `FAILED` is a member of `DeliveryStatus` — nobody home, the gate locked,
   * an address that turned out not to exist — and the mock's `PROGRESSION`
   * walks from `ON_THE_WAY` straight to `DELIVERED`, so it had never once
   * been reported. Two things were waiting behind it:
   *
   *   - `deliveryStatusToOrderStatus` maps `FAILED` to `'ready'`, and
   *     `attachDelivery` is forward-only, so an order already at
   *     `out_for_delivery` keeps that status. The screen goes on reading
   *     "Out for delivery · Your driver has collected the order and is on the
   *     way" with an ETA counting down, about food that is going back to the
   *     store.
   *   - `CourierTracking` counts only `DELIVERED` and `CANCELLED` as settled,
   *     so it prints "The progress below is updated as your order moves"
   *     under a journey that has stopped.
   *
   * Fifty-one minutes ago, so the estimate it was quoting is visibly spent.
   * What bb.q does next — refund, redeliver, or hold it at the store — is an
   * operations decision nobody has given, so it goes to `audit:launch` rather
   * than being invented here. The app's job is to stop claiming the driver is
   * still coming.
   */
  const failedPlacedAt = new Date(Date.now() - 51 * 60_000);
  ledger.push({
    id: 'order-4840',
    reference: 'BBQ-4840',
    placedAt: failedPlacedAt.toISOString(),
    fulfilmentType: 'delivery',
    status: 'out_for_delivery',
    timeline: buildTimeline('delivery', 'out_for_delivery', failedPlacedAt, 42),
    lines: [
      {
        id: 'soy-garlic__soy-garlic-size:soy-garlic-size-medium',
        productId: 'soy-garlic',
        name: 'Soy Garlic Chicken',
        assetKey: 'soyGarlic',
        unitBasePrice: 165,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'soy-garlic-size',
            groupName: 'Choose your size',
            optionId: 'soy-garlic-size-medium',
            optionName: 'Medium · 9 pieces',
            priceDelta: 60,
          },
        ],
        unitPrice: 225,
        lineTotal: 225,
      },
    ],
    totals: {
      subtotal: 225,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 262,
      pointsEarned: 225,
    },
    ...storeSnapshot('store-fourways'),
    addressId: 'address-mum',
    addressSummary: '27 Protea Avenue, Northcliff',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 42,
    // Registered with the mock provider under this id, so `getStatus` keeps
    // answering FAILED rather than walking the wall clock on to DELIVERED.
    delivery: seedFailedDeliveryJob('mock-job-failed-4840', failedPlacedAt.getTime()),
  });

  /**
   * A collection order sitting at the counter, and the biggest basket the seed
   * has ever held. Two states in one order because they are one order in life:
   * a family orders a lot at once and one person drives over to fetch it.
   *
   *   - `ready` had never been a seeded status. The ledger held `received`,
   *     `out_for_delivery`, `completed` and `cancelled`; the three middle
   *     rungs — `preparing`, `ready`, `courier_assigned` — were reachable only
   *     by placing an order in the session and waiting for the mock to advance
   *     it. So "Ready for collection", the screen whose whole job is to tell
   *     somebody to go to the counter, had never been rendered cold.
   *   - Nine lines. The largest seeded order had two, and every list in the
   *     app is short by construction: three addresses, three cards, seven
   *     orders. Nothing had ever been asked to lay out a receipt, an order
   *     card or a checkout review at 320pt with a basket this size.
   *
   * Eleven minutes ago against a twenty-five minute collection estimate, so
   * the kitchen is genuinely done early rather than the clock having run out.
   */
  const readyPlacedAt = new Date(Date.now() - 11 * 60_000);
  ledger.push({
    id: 'order-4842',
    reference: 'BBQ-4842',
    placedAt: readyPlacedAt.toISOString(),
    fulfilmentType: 'collection',
    status: 'ready',
    timeline: buildTimeline('collection', 'ready', readyPlacedAt, 25),
    lines: familyBasket(),
    totals: {
      subtotal: 1_671,
      deliveryFee: 0,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 1_676,
      pointsEarned: 1_671,
    },
    ...storeSnapshot('store-sandton'),
    paymentMethodLabel: 'Mastercard ending 7702',
    etaMinutes: 25,
  });

  /**
   * A dine-in order that is actually happening.
   *
   * The seed's one dine-in order was `completed`, so two things had never
   * rendered. `readyLabelFor('dinein')` — "Ready at your table" — has been
   * written since the timeline was, and no seeded order ever reached `ready`
   * on a dine-in journey to print it. And `tableNumber`, which the customer
   * types at checkout and the order carries, is drawn on exactly one screen:
   * the confirmation, seen once, immediately after paying. Come back to the
   * order a minute later and the number is gone — from the tracking screen, the
   * Orders card and the receipt alike — which is the one fact somebody sitting
   * in the restaurant wants to check.
   *
   * Nine minutes into an eighteen-minute kitchen, so it is genuinely mid-cook
   * rather than sitting at a rung chosen for the screenshot.
   */
  const dineInLivePlacedAt = new Date(Date.now() - 9 * 60_000);
  ledger.push({
    id: 'order-4844',
    reference: 'BBQ-4844',
    placedAt: dineInLivePlacedAt.toISOString(),
    fulfilmentType: 'dinein',
    status: 'preparing',
    timeline: buildTimeline('dinein', 'preparing', dineInLivePlacedAt, 18),
    lines: [
      {
        id: 'chicken-burger__burger-heat:burger-heat-spicy',
        productId: 'chicken-burger',
        name: 'Chicken Burger',
        assetKey: 'chickenBurger',
        unitBasePrice: 109,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'burger-heat',
            groupName: 'Heat level',
            optionId: 'burger-heat-spicy',
            optionName: 'Hot Spicy',
            priceDelta: 8,
          },
        ],
        unitPrice: 117,
        lineTotal: 117,
      },
    ],
    totals: {
      subtotal: 117,
      deliveryFee: 0,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 122,
      pointsEarned: 117,
    },
    ...storeSnapshot('store-rosebank'),
    tableNumber: '14',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 18,
  });

  /**
   * The last rung of the status sequence nothing had reached cold, and the
   * longest note anybody can type.
   *
   * `courier_assigned` sits between the counter and the road: the food is
   * boxed, a driver has been given the job and has not collected it yet. The
   * ledger held `received`, `preparing` (above), `ready`, `out_for_delivery`,
   * `completed` and `cancelled`, and this one was reachable only by placing an
   * order in the session and catching a two-minute window.
   *
   * The note is 200 characters, which is exactly what `product/[id]` allows and
   * a length nothing had ever been asked to lay out. Every screen that draws a
   * note clamps it — two lines on the cart row, two in the checkout review,
   * three on the receipt — and the seeded notes are one short sentence, so the
   * clamp had never truncated anything. A customer who spends their whole
   * allowance on access details and gets forty characters of it back cannot
   * check what they asked for.
   *
   * Twenty-five minutes is chosen rather than picked, the same way BBQ-4830's
   * thirty-four is. A 42-minute delivery estimate is 22 minutes of kitchen plus
   * the 20-minute road buffer, so `readyAt` is three minutes ago and the mock's
   * courier leg is three minutes in — past `COURIER_ASSIGNED` at two and short
   * of `PICKED_UP` at six. Both clocks have to land inside that window or the
   * fixture is an order and a courier job disagreeing on one screen.
   */
  const assignedPlacedAt = new Date(Date.now() - 25 * 60_000);
  ledger.push({
    id: 'order-4846',
    reference: 'BBQ-4846',
    placedAt: assignedPlacedAt.toISOString(),
    fulfilmentType: 'delivery',
    status: 'courier_assigned',
    timeline: buildTimeline('delivery', 'courier_assigned', assignedPlacedAt, 42),
    lines: [
      {
        id: 'secret-sauce__secret-sauce-size:secret-sauce-size-medium',
        productId: 'secret-sauce',
        name: 'Secret Sauce Chicken',
        assetKey: 'secretSauce',
        unitBasePrice: 175,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'secret-sauce-size',
            groupName: 'Choose your size',
            optionId: 'secret-sauce-size-medium',
            optionName: 'Medium · 9 pieces',
            priceDelta: 60,
          },
        ],
        unitPrice: 235,
        lineTotal: 235,
        // 200 characters, the maximum the note box accepts.
        specialInstructions:
          'The gate code is 4417 but it sticks, so press it twice and wait. If nobody answers the intercom please ring my mobile rather than leaving it with the guard — the last order sat in the hut all evening.',
      },
    ],
    totals: {
      subtotal: 235,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 272,
      pointsEarned: 235,
    },
    ...storeSnapshot('store-sandton'),
    addressId: 'address-home',
    addressSummary: '14 Acacia Road, Melrose Arch',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 42,
  });

  /**
   * A finished order nobody can place again.
   *
   * Rose Ddeok-Bokki is the product the previous round withdrew, and no order
   * contained it — so `planReorder`'s "nothing came back" branch, and the
   * dialogue `useReorder` shows instead of navigating, had never run against
   * anything in the seed. Every seeded order reorders cleanly, which is exactly
   * the shape a real history does not have.
   *
   * One line, deliberately: a mixed order would exercise the *partial* branch,
   * which already has a seeded path through it. This is the empty one.
   */
  const gonePlacedAt = new Date(Date.now() - 19 * 86_400_000);
  ledger.push({
    id: 'order-4838',
    reference: 'BBQ-4838',
    placedAt: gonePlacedAt.toISOString(),
    fulfilmentType: 'collection',
    status: 'completed',
    timeline: buildTimeline('collection', 'completed', gonePlacedAt, 25),
    lines: [
      {
        id: 'rose-ddeok-bokki__rose-extras:rose-extra-cheese',
        productId: 'rose-ddeok-bokki',
        name: 'Rose Ddeok-Bokki',
        assetKey: 'roseDdeokBokki',
        unitBasePrice: 82,
        quantity: 1,
        selectedOptions: [
          {
            groupId: 'rose-extras',
            groupName: 'Add to it',
            optionId: 'rose-extra-cheese',
            optionName: 'Extra melted cheese',
            priceDelta: 22,
          },
        ],
        unitPrice: 104,
        lineTotal: 104,
      },
    ],
    totals: {
      subtotal: 104,
      deliveryFee: 0,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 109,
      pointsEarned: 104,
    },
    ...storeSnapshot('store-vanda'),
    paymentMethodLabel: 'Mastercard ending 7702',
    etaMinutes: 25,
    rating: 5,
  });

  /**
   * An order that is late, which nothing in the seed had ever been.
   *
   * Every live fixture sits inside its estimate on purpose — BBQ-4830 eight
   * minutes from due, BBQ-4842 finished early — so `minutesUntilDue` had never
   * gone negative on a screen. It is a common state: the kitchen is backed up,
   * the driver is stuck, and the customer is looking at the app precisely
   * because the food has not come.
   *
   * The countdown is dropped once the estimate is spent, which is right — "a
   * time nobody believes any more is worse than no time at all", as the
   * tracking screen's own note puts it. What the fixture asks is what stands
   * in its place.
   *
   * Twenty-three minutes past a forty-one minute delivery estimate, so it is
   * unambiguously late rather than a rounding away from due. Held at
   * `preparing`, which also keeps `attachDelivery` out of it: the kitchen has
   * not reached the counter, so no courier job is created and the fixture stays
   * a kitchen running late rather than a courier leg doing something else.
   *
   * Placed at the Bryanston kitchen on purpose, which carries the other half of
   * this fixture. That branch is delivery-only and publishes no phone number —
   * there is no front desk to answer one — so this is the receipt where "Call
   * the store" correctly does not appear, on the order where somebody most
   * wants to ask. `isDiallable` had only ever been given a real number.
   * "Need help with this order?" is still there, which is why the absence is
   * a gap in the data rather than a dead end.
   */
  const latePlacedAt = new Date(Date.now() - 64 * 60_000);
  ledger.push({
    id: 'order-4848',
    reference: 'BBQ-4848',
    placedAt: latePlacedAt.toISOString(),
    fulfilmentType: 'delivery',
    status: 'preparing',
    timeline: buildTimeline('delivery', 'preparing', latePlacedAt, 41),
    lines: [
      {
        id: 'half-and-half__half-and-half-size:half-and-half-size-medium',
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
            optionId: 'half-flavour-cheesling',
            optionName: 'Cheesling',
            priceDelta: 0,
          },
          {
            groupId: 'half-and-half-size',
            groupName: 'Choose your size',
            optionId: 'half-and-half-size-medium',
            optionName: 'Medium · 9 pieces',
            priceDelta: 60,
          },
        ],
        unitPrice: 249,
        lineTotal: 249,
      },
    ],
    totals: {
      subtotal: 249,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 286,
      pointsEarned: 249,
    },
    ...storeSnapshot('store-bryanston'),
    addressId: 'address-home',
    addressSummary: '14 Acacia Road, Melrose Arch',
    paymentMethodLabel: 'Visa ending 4821',
    etaMinutes: 41,
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

/**
 * Orders the mock kitchen is behind on, so the clock does not move them.
 *
 * `advance` is a pure function of elapsed time: every order marches through
 * its sequence on schedule and arrives exactly when the estimate said it
 * would. A real kitchen does not. It gets backed up, and the customer opens
 * the app precisely because the food has not come — so "late" is one of the
 * commonest states a live order is in, and this mock could not produce it at
 * all. Seeding an order and backdating it does not work: the clock simply
 * walks it to `completed` before anybody looks.
 *
 * A mock kinder than the world hides the defects it was built to catch, and
 * this one had a kitchen that was never late. Mock-only, and by id rather than
 * by a field on `Order`, because being behind is a fact about the kitchen
 * rather than a property of the order the wire would carry.
 */
const RUNNING_LATE = new Set(['order-4848']);

function advance(order: Order): Order {
  if (order.status === 'completed' || order.status === 'cancelled') return order;
  if (RUNNING_LATE.has(order.id)) return order;

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

  /**
   * The redeemed reward, read once and used twice: its name goes onto the
   * order so the receipt can attribute the discount, and its points cost is
   * what gets deducted below. It was fetched only for the second, after the
   * order had already been built, so the first was not possible.
   */
  const redeemed = input.redeemedRewardId
    ? await fetchReward(input.redeemedRewardId).catch(() => null)
    : null;

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
    // The name as well as the id, so the receipt can say which reward took the
    // money rather than "Rewards discount". Read once, here, and kept.
    ...(redeemed ? { rewardName: redeemed.name } : {}),
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
  if (redeemed) {
    recordPoints({
      description: `${redeemed.name} · order ${order.reference}`,
      points: -redeemed.pointsCost,
      orderReference: order.reference,
    });
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

  const cancelledAt = new Date();
  const cancelled: Order = {
    ...current,
    status: 'cancelled',
    // Rebuilt, not kept. The timeline it was carrying describes a journey that
    // has just stopped happening, and leaving it in place is how a cancelled
    // order came to show "Out for delivery" and a thank-you.
    timeline: buildTimeline(
      current.fulfilmentType,
      'cancelled',
      new Date(current.placedAt),
      current.etaMinutes,
      workStartsAt(current),
      cancelledAt,
    ),
  };
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
