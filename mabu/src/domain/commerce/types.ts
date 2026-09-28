/**
 * Optional commerce layer — brief §13 and §14, verbatim contracts.
 *
 * Mábu is reservation-first; ordering is structurally supported so it can be
 * switched on later, and until then every adapter says NOT_CONFIGURED rather
 * than pretending (§49).
 */
export type ProviderId = 'mabu-direct' | 'uber-eats' | 'mr-d';
export type FulfilmentMode = 'delivery' | 'pickup';

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

export interface CommerceOrderRequest {
  provider: ProviderId;
  fulfilment: FulfilmentMode;
  scheduledFor?: string;
  storeId: string;
  customerId?: string;
  address?: DeliveryAddress;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    modifiers?: { id: string; name: string; priceCents: number }[];
    notes?: string;
  }[];
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  currency: 'ZAR';
  idempotencyKey: string;
}

export interface CommerceOrderResult {
  provider: ProviderId;
  externalOrderId: string;
  status: CanonicalOrderStatus;
  etaMinutes?: number;
  trackingUrl?: string;
}

export interface CommerceQuote {
  available: boolean;
  deliveryFeeCents?: number;
  etaMinutes?: number;
  reason?: string;
}

export interface CommerceProvider {
  id: ProviderId;
  quote(request: CommerceOrderRequest): Promise<CommerceQuote>;
  createOrder(request: CommerceOrderRequest): Promise<CommerceOrderResult>;
  cancelOrder(externalOrderId: string, reason: string): Promise<void>;
}

/** §46 ProviderOrder — persisted when ordering is enabled. */
export interface ProviderOrder {
  id: string;
  provider: ProviderId;
  externalOrderId: string;
  status: CanonicalOrderStatus;
  request: CommerceOrderRequest;
  createdAt: string;
  updatedAt: string;
}
