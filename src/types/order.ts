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
  latitude: number;
  longitude: number;
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
  /** Straight-line distance in km, resolved against the customer location. */
  distanceKm: number;
  openingHours: OpeningHours[];
  supportsDelivery: boolean;
  supportsCollection: boolean;
  supportsDineIn: boolean;
  preparationMinutes: number;
  isOpenNow: boolean;
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
  addressId?: string;
  addressSummary?: string;
  tableNumber?: string;
  scheduledFor?: string;
  paymentMethodLabel: string;
  /** Minutes until ready/delivered, from `placedAt`. */
  etaMinutes: number;
  driverName?: string;
  rating?: number;
  ratingComment?: string;
}

export interface PlaceOrderInput {
  lines: CartLine[];
  totals: CartTotals;
  fulfilmentType: FulfilmentType;
  storeId: string;
  addressId?: string;
  tableNumber?: string;
  scheduledFor?: string;
  paymentMethodId: string;
  voucherCode?: string;
  redeemedRewardId?: string;
}
