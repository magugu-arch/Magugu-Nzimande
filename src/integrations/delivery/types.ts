/**
 * Delivery-channel domain contracts.
 *
 * These are the types from the Uber Eats + Mr D extension brief, §3, adopted
 * verbatim where the brief names a shape and extended only where the existing
 * app forces a decision the brief left open. The brief is the authority on
 * names: `FulfilmentMode`, `CanonicalOrderStatus`, `ProviderCapability`,
 * `DeliveryProvider` and the request/result pair are spelled exactly as
 * written there so that a reader holding the document can find them.
 *
 * Three deliberate extensions, each recorded where it is made:
 *
 *   1. `FulfilmentMode` is the brief's two-value union, but this app has
 *      shipped a three-value `FulfilmentType` ('delivery' | 'collection' |
 *      'dinein') since before the extension existed. They are not the same
 *      vocabulary and collapsing one into the other silently would lose
 *      dine-in. See `fulfilment.ts` for the bridge, which is explicit and
 *      tested rather than implied by a cast.
 *
 *   2. `ProviderQuote` and `AddressCheck` are named result types. The brief
 *      writes them inline inside the method signatures; naming them lets a
 *      screen, a test and an adapter all refer to the same thing.
 *
 *   3. `ProviderUnavailableReason` makes the failure vocabulary a closed set.
 *      The brief's own skeleton returns string reasons like
 *      "UBER_EATS_NOT_CONFIGURED"; leaving them as free strings means the UI
 *      ends up pattern-matching on prose to decide between "Coming soon" and
 *      "Currently unavailable", which is exactly the distinction §5 asks the
 *      interface to draw.
 *
 * Money is integer cents throughout, per the brief's `*Cents` fields. The
 * rest of this app carries rands as floats (`businessRules.deliveryFee` is
 * 32, not 3200). Conversion happens once, at the boundary, in `money.ts` —
 * not scattered through adapters where a factor of 100 can hide.
 */

/** Brief §3. The three channels Pappas can take an order through. */
export type ProviderId = 'pappas-direct' | 'uber-eats' | 'mr-d';

/** Every provider id, in the order the UI should offer them. */
export const PROVIDER_IDS: readonly ProviderId[] = ['pappas-direct', 'uber-eats', 'mr-d'] as const;

/**
 * Brief §3. The provider-facing fulfilment vocabulary.
 *
 * Note this is the *provider's* vocabulary, not the app's. Uber Eats calls
 * collection "Pickup" and has no concept of a Pappas dine-in booking, so a
 * dine-in visit never becomes a `FulfilmentMode` at all — it is a reservation,
 * and it never reaches this layer.
 */
export type FulfilmentMode = 'delivery' | 'pickup';

/**
 * Brief §3. The canonical Pappas order state machine.
 *
 * Every provider event normalises into one of these, so order history,
 * tracking UI, analytics and push copy have a single vocabulary to read. The
 * legal transitions between them live in `statusMachine.ts`; this type only
 * says which states exist.
 */
export type CanonicalOrderStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'driver-assigned'
  | 'picked-up'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled'
  | 'failed';

/**
 * Brief §3. What a provider can actually do.
 *
 * Discovered at runtime via `getCapabilities()` rather than hard-coded in a
 * screen, because the honest answer differs per provider and changes when a
 * contract is signed. The UI asks the provider; it never assumes. A provider
 * that cannot do `live-tracking` must not be given a tracking screen that
 * invents a driver, per §5's rule against fake data.
 */
export type ProviderCapability =
  | 'delivery'
  | 'pickup'
  | 'scheduled-order'
  | 'eta'
  | 'live-tracking'
  | 'driver-messaging'
  | 'cancellation'
  | 'refund'
  | 'webhooks'
  | 'menu-sync';

/**
 * Why a provider cannot take this order.
 *
 * A closed set, because the interface has to distinguish three quite
 * different situations and §5 names two of them as different words on screen:
 *
 *   NOT_CONFIGURED   — no credentials, no contract. "Coming soon."
 *   DISABLED         — configured but switched off by flag. "Coming soon."
 *   OUT_OF_AREA      — works, but not to this address. A real, useful answer.
 *   OUTSIDE_TRADING  — works, but the restaurant is shut.
 *   PROVIDER_ERROR   — it should have worked and did not. "Currently
 *                      unavailable", and worth retrying.
 *   UNSUPPORTED_MODE — e.g. pickup asked of a delivery-only provider.
 *
 * Collapsing these into one string was the temptation; the cost is that a
 * customer four kilometres outside a delivery zone reads "coming soon" and
 * concludes Pappas does not deliver at all.
 */
export type ProviderUnavailableReason =
  | 'NOT_CONFIGURED'
  | 'DISABLED'
  | 'OUT_OF_AREA'
  | 'OUTSIDE_TRADING'
  | 'PROVIDER_ERROR'
  | 'UNSUPPORTED_MODE'
  | 'MINIMUM_NOT_MET';

/** Brief §3. */
export interface DeliveryAddress {
  line1: string;
  line2?: string;
  suburb?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  accessInstructions?: string;
}

/** Brief §3. One configured line on a provider order. */
export interface ProviderOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers?: { id: string; name: string; priceCents: number }[];
  notes?: string;
}

/** Brief §3. */
export interface ProviderOrderRequest {
  provider: ProviderId;
  fulfilment: FulfilmentMode;
  /** ISO 8601. Only meaningful where the provider reports `scheduled-order`. */
  scheduledFor?: string;
  storeId: string;
  customerId?: string;
  address?: DeliveryAddress;
  items: ProviderOrderItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  currency: 'ZAR';
  /**
   * Brief §3, and the reason `createOrder` is safe to retry.
   *
   * Generated once when the customer commits, not per attempt — see
   * `idempotency.ts`. A key that changes on retry is not an idempotency key,
   * it is a duplicate-order generator with extra steps.
   */
  idempotencyKey: string;
}

/** Brief §3. */
export interface ProviderOrderResult {
  provider: ProviderId;
  externalOrderId: string;
  status: CanonicalOrderStatus;
  etaMinutes?: number;
  trackingUrl?: string;
}

/** Named form of the brief's inline `validateAddress` return. */
export interface AddressCheck {
  serviceable: boolean;
  reason?: ProviderUnavailableReason;
  /** Free-text detail for logs and support. Never rendered as UI copy. */
  detail?: string;
}

/** Named form of the brief's inline `quote` return. */
export interface ProviderQuote {
  available: boolean;
  deliveryFeeCents?: number;
  etaMinutes?: number;
  reason?: ProviderUnavailableReason;
  detail?: string;
  /**
   * When the quote stops being honourable, ISO 8601.
   *
   * Absent means the adapter makes no promise about how long its numbers
   * hold. Present, and checkout must re-quote past it rather than charging a
   * fee that expired while the customer was choosing a card.
   */
  expiresAt?: string;
}

/**
 * Brief §3. The contract every channel implements.
 *
 * `pappas-direct` implements it over this app's own order service; the two
 * external adapters implement it over provider APIs that do not exist in this
 * repository yet and therefore fail honestly. See `providers/`.
 *
 * Note what is *not* here: no `getMenu`, no `syncCatalogue`, no credential
 * handling. Menu mapping is a server concern (`catalogueMapping.ts` holds only
 * the client-side shape), and no adapter in the mobile bundle is ever given a
 * provider secret — brief §1, "Never expose provider secrets in the mobile
 * app", and §11's acceptance criterion on the same point.
 */
export interface DeliveryProvider {
  id: ProviderId;
  /** Human name for UI. Never a provider logo or brand lockup — §10.11. */
  displayName: string;
  getCapabilities(): Promise<readonly ProviderCapability[]>;
  validateAddress(address: DeliveryAddress): Promise<AddressCheck>;
  quote(request: ProviderOrderRequest): Promise<ProviderQuote>;
  createOrder(request: ProviderOrderRequest): Promise<ProviderOrderResult>;
  cancelOrder(externalOrderId: string, reason: string): Promise<void>;
}

/** Brief §6. A provider event as it arrives at our webhook endpoint. */
export interface ProviderWebhook {
  provider: ProviderId;
  eventId: string;
  externalOrderId: string;
  type: string;
  /** ISO 8601. */
  occurredAt: string;
  payload: unknown;
}

/** A webhook after normalisation into Pappas vocabulary. */
export interface NormalizedOrderEvent {
  provider: ProviderId;
  externalOrderId: string;
  eventId: string;
  status: CanonicalOrderStatus;
  occurredAt: string;
  /** Present only when the provider actually supplied one. Never invented. */
  etaMinutes?: number;
  trackingUrl?: string;
  /** Provider's own event name, kept for support and for unmapped types. */
  providerEventType: string;
}

/**
 * How a provider is offered to the customer right now.
 *
 * `available` providers can be selected. `comingSoon` render as a named,
 * non-interactive row — Pappas has decided these channels are part of the
 * product, and saying so is marketing, not a defect. `unavailable` is a
 * temporary failure and says so.
 */
export type ProviderAvailabilityState = 'available' | 'coming-soon' | 'unavailable';

export interface ProviderAvailability {
  provider: ProviderId;
  displayName: string;
  state: ProviderAvailabilityState;
  reason?: ProviderUnavailableReason;
  capabilities: readonly ProviderCapability[];
}

/** Brief §9. The commerce analytics vocabulary, as a closed set. */
export type CommerceEvent =
  | 'provider_viewed'
  | 'provider_selected'
  | 'delivery_quote_requested'
  | 'delivery_quote_received'
  | 'external_checkout_started'
  | 'external_order_created'
  | 'external_order_failed'
  | 'order_status_changed'
  | 'tracking_opened'
  | 'pickup_selected'
  | 'scheduled_order_selected'
  | 'promotion_viewed'
  | 'promotion_redeemed'
  | 'reorder_started';
