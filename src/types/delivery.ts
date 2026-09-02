/**
 * The courier leg of an order (brief §5, §6).
 *
 * This is the boundary the brief calls "Uber-ready", and the phrase is worth
 * being precise about, because it does not mean what it sounds like. §5:
 *
 *   > 'Uber-ready' means the bb.q Chicken app is architected so that an
 *   > approved delivery integration can be connected without rebuilding the
 *   > customer experience. It does not mean the app may privately reproduce or
 *   > embed Uber's proprietary consumer platform.
 *
 * So nothing here names a vendor. A provider is a module satisfying
 * `DeliveryProvider`, chosen at runtime by a feature flag, and the app talks
 * only to the interface. Adding an authorised courier is a new file and a flag;
 * it is not a change to the order service, the tracking screen or this type.
 *
 * §12 is equally explicit that credentials, contracts and technical approval
 * are prerequisites this repository does not have — so the only provider that
 * ships is the mock.
 */

/**
 * The courier's own view of the job, exactly as the brief specifies it.
 *
 * Deliberately not merged with `OrderStatus`. They answer different questions
 * and are owned by different systems: the kitchen decides when food is ready,
 * the courier network decides when a driver is assigned, and the two run in
 * parallel once an order is placed. Modelling them as one enum was the shape
 * that produced the original defect — an order sitting boxed on a counter
 * showing "Ready", the same word a collection customer sees when the food is
 * waiting for *them*.
 *
 * `deliveryStatusToOrderStatus` maps one onto the other in a single place, so
 * the customer-facing status is derived from the courier's rather than kept
 * beside it.
 */
export type DeliveryStatus =
  | 'CONFIRMED'
  | 'COURIER_ASSIGNED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

/** Where a courier is, when the provider is authorised to say. */
export interface CourierPosition {
  latitude: number;
  longitude: number;
  /** When this fix was taken. A stale position is worse than none. */
  reportedAt: string;
}

export interface DeliveryQuoteRequest {
  storeId: string;
  /** Dropoff. Absent coordinates mean the address has never been geocoded. */
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  /** Order value in rand, for providers that price on basket size. */
  orderValue: number;
}

export interface DeliveryQuote {
  /** Quoted courier fee in rand. What the customer is charged is a separate,
   *  commercial decision — see `businessRules.deliveryFee`. */
  feeRand: number;
  etaMinutes: number;
  /** Whether this provider will serve the dropoff at all. */
  serviceable: boolean;
  /** Why not, when it will not. Shown to nobody; logged. */
  reason?: string;
  /** How long this quote stands. */
  expiresAt: string;
}

export interface DeliveryCreateRequest {
  orderId: string;
  orderReference: string;
  storeId: string;
  dropoffSummary: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  /**
   * The order's own idempotency key, reused deliberately.
   *
   * One order must never become two courier jobs, and the retry that would do
   * it is the same retry that would create the second order.
   */
  idempotencyKey: string;
  /**
   * When the food reached the counter, if it already has.
   *
   * A courier's clock starts when there is something to collect, not when the
   * request happens to be made — and those differ whenever a job is created
   * lazily, which is exactly what a client-side mock has to do. Optional: a
   * provider asked to collect food that is not ready yet has no such moment to
   * be given.
   */
  readyAt?: string;
}

/**
 * A courier job, as the app holds it.
 *
 * `trackingAvailable` is a fact about the provider's authorisation, not about
 * the app's UI: a provider may run the delivery and still not be permitted to
 * expose a live position. The tracking map is gated on it, so an unauthorised
 * provider produces an honest screen rather than an empty map.
 */
export interface DeliveryJob {
  externalJobId: string;
  provider: string;
  status: DeliveryStatus;
  etaMinutes?: number;
  courierName?: string;
  trackingAvailable: boolean;
  courierPosition?: CourierPosition;
  updatedAt: string;
}

/**
 * The provider contract, at the brief's exact signature (§5).
 *
 * Four methods and nothing else. Anything a provider needs beyond this — keys,
 * hosts, webhook secrets — is its own business and comes from the environment,
 * never from a caller and never from this file.
 */
export interface DeliveryProvider {
  /** Stable identifier, recorded on the order so a job can be traced later. */
  readonly name: string;
  quote(input: DeliveryQuoteRequest): Promise<DeliveryQuote>;
  create(input: DeliveryCreateRequest): Promise<DeliveryJob>;
  getStatus(externalJobId: string): Promise<DeliveryJob>;
  cancel(externalJobId: string): Promise<void>;
}
