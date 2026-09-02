import type { Product } from './menu';

/** Brief §4 — Delivery / Collection / Dine-in. */
export type FulfilmentType = 'delivery' | 'collection' | 'dinein';

export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartLine {
  /** Stable id for this configured line (product + option fingerprint). */
  id: string;
  productId: string;
  name: string;
  assetKey: Product['assetKey'];
  unitBasePrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  specialInstructions?: string;
  /** unitBasePrice + option deltas, before quantity. */
  unitPrice: number;
  /** unitPrice * quantity. */
  lineTotal: number;
}

export interface CartTotals {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  rewardsDiscount: number;
  total: number;
  /** Loyalty points this order will earn. */
  pointsEarned: number;
}

export type OrderStatus =
  'received' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';

export interface OrderStatusEvent {
  status: OrderStatus;
  label: string;
  description: string;
  occurredAt: string | null;
}

export interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  /**
   * Where this address actually is, when anybody has worked that out.
   *
   * Optional, and absent is the ordinary case: the add-address form is six
   * text fields and there is no geocoder behind it, so an address a customer
   * types has never been located. It used to be stamped with
   * `DEFAULT_COORDINATES` — the Johannesburg CBD — which was harmless until the
   * delivery-radius rule started reading the field and began deciding where
   * customers live from a constant. Six of the seven seeded branches then
   * refused every typed-in address wherever it was, and the seventh accepted
   * every typed-in address wherever it was.
   *
   * Absent means "nobody knows", which is a different answer from a
   * coordinate and has to stay distinguishable from one. See `deliveryRange`.
   */
  latitude?: number;
  longitude?: number;
  instructions?: string;
  isDefault: boolean;
}

export interface Store {
  id: string;
  name: string;
  addressLine: string;
  suburb: string;
  city: string;
  province: string;
  phone: string;
  latitude: number;
  longitude: number;
  /**
   * Straight-line distance in km from the customer, when the app knows where
   * they are.
   *
   * Optional, and absent whenever it does not. This used to fall back to
   * `DEFAULT_COORDINATES` — the Johannesburg CBD — so a customer who declined
   * the location prompt was shown a distance from a place they had never been
   * to, on a badge that reads as "how far you are from this branch", and a list
   * sorted "nearest first" by the same measurement. In Durban that is a lie
   * with a number attached, which is a harder kind to spot than a lie without
   * one.
   */
  distanceKm?: number;
  openingHours: OpeningHours[];
  supportsDelivery: boolean;
  supportsCollection: boolean;
  supportsDineIn: boolean;
  /**
   * How far this branch will deliver, in kilometres.
   *
   * There was no such limit, which was invisible while the seeded store list
   * spanned four cities — almost anyone was plausibly near one. With a real
   * network of two branches, most of the country is nowhere near either, and
   * without this a customer four hundred kilometres away is shown the
   * "nearest" store and allowed to order delivery from it.
   */
  deliveryRadiusKm: number;
  preparationMinutes: number;
  isOpenNow: boolean;
  /**
   * ISO date this branch starts trading, when that is still in the future.
   *
   * A second store opening a month after the first is a state the app has to
   * hold: listed, findable, obviously coming — and not taking orders. Absent
   * on a branch that is already trading.
   */
  opensOn?: string;
}

export interface OpeningHours {
  /** 0 = Sunday. */
  day: number;
  opensAt: string;
  closesAt: string;
}

export type PaymentMethodType = 'card' | 'eft' | 'snapscan' | 'cash' | 'applepay' | 'googlepay';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  /** Last four digits for cards; undefined for other rails. */
  last4?: string;
  expiry?: string;
  brand?: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  reference: string;
  placedAt: string;
  fulfilmentType: FulfilmentType;
  status: OrderStatus;
  timeline: OrderStatusEvent[];
  lines: CartLine[];
  totals: CartTotals;
  storeId: string;
  storeName: string;
  /**
   * A snapshot of how to reach and find the store, taken when the order was
   * placed. Carried on the order rather than looked up from the store list,
   * because tracking must still work for a store that has since closed or
   * moved — and because the tracking screen has no reason to fetch the whole
   * network to render one phone number.
   */
  storePhone: string;
  storeAddress: string;
  /**
   * Where the branch is, when the order was recorded with that on it.
   *
   * Optional, and absent means nobody knows — same rule as an `Address`. These
   * were `store?.latitude ?? 0`, and `0, 0` is a real place: a point in the
   * Gulf of Guinea about 6 500 km from Johannesburg. The tracking screen offers
   * "Get directions" on the strength of the address *string* being non-empty,
   * so a record without coordinates would have opened a maps app and routed
   * somebody there. Absent is the honest value, and the button asks for it.
   */
  storeLatitude?: number;
  storeLongitude?: number;
  addressId?: string;
  addressSummary?: string;
  tableNumber?: string;
  scheduledFor?: string;
  paymentMethodLabel: string;
  /**
   * The reward spent on this order, if any.
   *
   * `totals.rewardsDiscount` records that a reward came off the price without
   * recording which one, so nothing downstream could explain the line — or put
   * the points back if the order was called off.
   */
  redeemedRewardId?: string;
  /** The promo code spent on this order, for the same reasons. */
  voucherCode?: string;
  /** Minutes until ready/delivered, from `placedAt`. */
  etaMinutes: number;
  driverName?: string;
  rating?: number;
  ratingComment?: string;
}

export interface PlaceOrderInput {
  lines: CartLine[];
  /**
   * What the client believes the order costs — to be checked, never trusted.
   *
   * Everything needed to work the total out independently is already in this
   * payload: the lines carry product ids, chosen options and quantities, and
   * `voucherCode`, `redeemedRewardId`, `fulfilmentType` and `storeId` supply
   * the rest. The server should recompute from those and reject the order if
   * this disagrees, rather than charging what it was told to charge.
   *
   * Anything a customer's device can edit, a customer's device can lie about.
   * The endpoint does not exist yet, which is the reason to write this down
   * now rather than after it is built.
   */
  totals: CartTotals;
  fulfilmentType: FulfilmentType;
  storeId: string;
  addressId?: string;
  tableNumber?: string;
  scheduledFor?: string;
  paymentMethodId: string;
  /**
   * Sent alongside the id, the same way `AuthorisePaymentInput` already does.
   *
   * Not every id here is one the server issued. Cash, SnapScan and instant EFT
   * are rails bb.q accepts rather than things a customer saves, so they are
   * named on the client and their ids mean nothing to a backend looking up a
   * stored payment method — it finds nothing, and records the order against
   * whatever it falls back to. The mock did exactly that, and a first order
   * paid by SnapScan came back reading "Paid with: Card".
   *
   * The type is the part that is always true, so it travels with the id.
   */
  paymentMethodType: PaymentMethodType;
  voucherCode?: string;
  redeemedRewardId?: string;
  /**
   * Names the attempt, so a retry of it is not a second order.
   *
   * Held by the checkout screen across failures and cleared only once an order
   * exists — see `features/checkout/idempotency.ts`. The server is expected to
   * store it against the order it created and return that same order, rather
   * than creating another, when it sees the key again.
   *
   * Required, not optional: a caller that forgets it is a caller that can
   * charge somebody twice, and that should not typecheck.
   */
  idempotencyKey: string;
}
