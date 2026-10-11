/**
 * The domain the screens are written against. Every provider — the mock
 * today, the verified commerce platform and courier later — returns these
 * shapes, so swapping an adapter never touches a screen.
 *
 * IDs are the source system's IDs, kept as opaque strings. Nothing here is a
 * second source of truth: price, stock and order state are always read from
 * the provider, never recalculated and stored on the device.
 */

/** Decimal string plus ISO 4217 code — never a float. */
export type Money = { amount: string; currencyCode: string };

export type MarketId = string;

export type Market = {
  id: MarketId;
  label: string;
  currencyCode: string;
  locale: string;
};

export type CategoryId = 'men' | 'women' | 'unisex' | 'accessories' | 'lifestyle';

export type Category = { id: CategoryId; label: string; assetId: string };

export type StockStatus = 'available' | 'preorder' | 'unavailable';

export type PreorderInfo = {
  /** Authoritative lead time text from the platform; never derived on device. */
  leadTime: string;
};

export type ProductVariant = {
  id: string;
  size: string;
  stock: StockStatus;
};

export type ProductMedia = { assetId: string; alt: string };

export type CareInstruction = { text: string };

export type Product = {
  id: string;
  code: string;
  name: string;
  category: CategoryId;
  colours: string[];
  media: ProductMedia[];
  price: Money;
  variants: ProductVariant[];
  preorder?: PreorderInfo;
  sizeGuideId?: string;
  releasedAt: string;
  /** Curated, explainable pairings only. */
  pairsWith: string[];
  /** Fields the platform has not confirmed stay undefined, and the UI says so. */
  material?: string;
  care?: CareInstruction[];
  origin?: string;
  /** True for every product in demo mode. */
  sample: boolean;
};

export type SizeGuide = {
  id: string;
  title: string;
  unit: 'cm';
  columns: string[];
  rows: string[][];
};

export type Story = {
  id: string;
  kind: string;
  title: string;
  heroAssetId: string;
  mediaAssetIds: string[];
  productIds: string[];
  /** Approved copy, or undefined while it awaits brand review. */
  body?: string;
};

export type ShippingOption = { id: string; label: string; price?: Money; estimate?: string };

/* ------------------------------------------------------------------- cart */

export type CartLine = { productId: string; variantId: string; size: string; quantity: number };

export type Cart = { lines: CartLine[] };

export type CheckoutOutcome = 'confirmed' | 'pending' | 'failed' | 'cancelled';

export type CheckoutSession = {
  /** One key per attempt: retries and double taps reuse it, so one order at most. */
  idempotencyKey: string;
  outcome?: CheckoutOutcome;
  orderId?: string;
};

/* --------------------------------------------------------------- customer */

export type Address = { id: string; label: string; masked: string };

export type SizePreference = { sizes: string[] };

export type CustomerProfile = { id: string; firstName?: string; sizes: SizePreference };

export type Wishlist = { productIds: string[] };

/* ---------------------------------------------------------------- delivery */

/** The normalised parcel lifecycle (brief §6K). Only provider-confirmed stages are shown as done. */
export const STAGES = [
  'order_confirmed',
  'preparing',
  'packed',
  'handed_to_carrier',
  'in_transit',
  'out_for_delivery',
  'delivered',
] as const;
export type DeliveryStage = (typeof STAGES)[number];

export type DeliveryExceptionKind =
  | 'awaiting_carrier_scan'
  | 'delayed'
  | 'address_issue'
  | 'delivery_attempted'
  | 'customs_hold'
  | 'returned_to_sender'
  | 'cancelled'
  | 'unknown';

/** Merchant fulfilment and carrier scans are kept apart, so "packed" never reads as "the courier has it". */
export type EventSource = 'merchant' | 'carrier';

export type TrackingEvent = {
  id: string;
  stage: DeliveryStage | null;
  exception?: DeliveryExceptionKind;
  source: EventSource;
  /** ISO 8601, UTC. Formatted in the customer's locale at display time. */
  at: string;
  /** Reviewed, customer-safe wording. Raw provider codes stay server-side. */
  description: string;
  location?: string;
};

export type DeliveryEstimate = {
  from: string;
  to: string;
  /** Who said so — always shown with the estimate. */
  source: 'carrier' | 'courier';
  updatedAt: string;
};

export type CourierPresence = {
  /** Normalised 0–1 map coordinates in the demo; lat/lng from a contracted provider. */
  x: number;
  y: number;
  updatedAt: string;
};

export type DeliveryPreference = {
  place: 'door' | 'reception' | 'neighbour' | 'safe-place';
  instructions?: string;
  /** Set only once the provider has acknowledged the change. */
  acknowledgedAt?: string;
};

export type DeliveryMode = 'parcel' | 'local';

export type DeliveryTracking = {
  orderId: string;
  mode: DeliveryMode;
  carrier: string;
  serviceLevel: string;
  trackingReference?: string;
  trackingUrl?: string;
  events: TrackingEvent[];
  estimate?: DeliveryEstimate;
  courier?: CourierPresence;
  exception?: DeliveryExceptionKind;
  preference?: DeliveryPreference;
  /** When the provider last answered, successful or not. */
  lastCheckedAt: string;
  /** Set when the last check failed; the screen keeps the last known state. */
  providerError?: string;
};

export type OrderSummary = {
  id: string;
  createdAt: string;
  marketId: MarketId;
  lines: CartLine[];
  total?: Money;
  sample: boolean;
};

/* ----------------------------------------------------------- appointments */

export type AppointmentType = {
  id: string;
  label: string;
  format: 'in-person' | 'virtual';
  minutes: number;
};

export type AppointmentLocation = {
  id: string;
  label: string;
  kind: 'boutique' | 'pop-up' | 'event' | 'virtual';
};

export type AvailableSlot = { id: string; startsAt: string; timeZone: string; available: boolean };

export type AppointmentStatus = 'requested' | 'confirmed' | 'cancelled';

export type Appointment = {
  reference: string;
  typeId: string;
  status: AppointmentStatus;
  slot: AvailableSlot;
  createdAt: string;
};

export type RescheduleRequest = { reference: string; slotId: string };

/* ---------------------------------------------------------- notifications */

export type NotificationKind = 'transactional' | 'requested' | 'marketing';

export type NotificationPreference = {
  key: 'orders' | 'restock' | 'collections';
  kind: NotificationKind;
  enabled: boolean;
  /** Recorded separately per key: marketing consent is never implied by order updates. */
  consentedAt?: string;
};
