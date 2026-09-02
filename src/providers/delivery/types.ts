/**
 * The seam an authorised delivery partner connects through.
 *
 * The brief's §5 is careful about what "delivery-ready" means, and so is this:
 * the app owns the customer experience, and a provider is something that
 * quotes, dispatches and reports — never something that supplies screens. The
 * interface exists so that connecting one is a new file in this directory and a
 * flag, not a rewrite of checkout and tracking.
 *
 * §12 is equally clear that this brief grants no access to any third party.
 * There is therefore exactly one implementation here, and it is a mock. A real
 * one waits on an account, credentials, published API documentation and
 * whatever contract the two businesses sign.
 */

/** Where a job is, in the provider's terms rather than the kitchen's. */
export type DeliveryStatus =
  | 'CONFIRMED'
  | 'COURIER_ASSIGNED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export interface DeliveryPoint {
  addressLine: string;
  suburb: string;
  /**
   * Optional, and absent means nobody has worked it out — the same rule the
   * app already applies to `Address` and `Store`. A provider that needs a
   * coordinate should be told there is not one, rather than handed a default
   * that puts the pickup in the Gulf of Guinea.
   */
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  instructions?: string;
}

export interface DeliveryQuoteRequest {
  pickup: DeliveryPoint;
  dropoff: DeliveryPoint;
  /** Integer minor units — cents. New money paths use them natively. */
  orderValueMinor: number;
  /** ISO 8601, when the customer has asked for a later slot. */
  scheduledFor?: string;
}

export interface DeliveryQuote {
  /** Quoted to the customer, in cents. */
  feeMinor: number;
  currency: 'ZAR';
  etaMinutes: number;
  /**
   * How long this price is good for. A quote without an expiry is a price the
   * app will still be showing an hour later.
   */
  expiresAt: string;
  /** Passed back to `create` so the provider knows which quote was accepted. */
  quoteId: string;
  /** Providers refuse addresses; the reason belongs to the customer, not a log. */
  serviceable: boolean;
  unserviceableReason?: string;
}

export interface DeliveryCreateRequest {
  quoteId: string;
  /** Ours, so a job can be traced back to an order in support. */
  orderReference: string;
  pickup: DeliveryPoint;
  dropoff: DeliveryPoint;
  /**
   * The order's key, carried through so a retried dispatch does not put two
   * couriers on one order — the same rule the order and the payment follow.
   */
  idempotencyKey: string;
}

export interface DeliveryJob {
  externalJobId: string;
  status: DeliveryStatus;
  etaMinutes: number;
  courierName?: string;
  /**
   * Whether this provider will show a live courier position for this job.
   *
   * False is the normal answer and has to stay a separate question from "is
   * there a job": the tracking screen offers a map on the strength of it, and
   * offering one that cannot be drawn is worse than not offering it.
   */
  trackingAvailable: boolean;
  trackingUrl?: string;
}

export interface DeliveryProvider {
  /** Names the provider in logs and in the audit trail. */
  readonly id: string;
  quote(input: DeliveryQuoteRequest): Promise<DeliveryQuote>;
  create(input: DeliveryCreateRequest): Promise<DeliveryJob>;
  getStatus(externalJobId: string): Promise<DeliveryJob>;
  cancel(externalJobId: string): Promise<void>;
}
