/**
 * Pappas Direct — the channel Pappas owns.
 *
 * Extension §11's first acceptance criterion: "PAPPAS Direct ordering works
 * independently of external providers." This adapter is how that is true.
 * It implements the same `DeliveryProvider` contract as the external channels
 * but is backed by this app's own store and order services, so nothing about
 * Uber Eats or Mr D being absent, disabled or broken can affect it.
 *
 * It is also the reference implementation: when an external contract is
 * signed, the work is to make that adapter behave like this one, not to
 * invent a new shape.
 *
 * What this adapter deliberately does *not* do is duplicate order placement.
 * `createOrder` does not post to a kitchen — `orderService` already does
 * that, and extension §10 is explicit that working business logic is
 * preserved rather than reimplemented to match a new interface. Instead this
 * adapter answers the questions the provider contract asks (can we serve this
 * address, what will it cost, how long) from the rules the app already holds,
 * and hands back a result the shared checkout can act on.
 */

import { businessRules } from '../../../constants/config';
import type { Store } from '../../../types/order';
import { toCents } from '../money';
import type {
  AddressCheck,
  DeliveryAddress,
  DeliveryProvider,
  ProviderCapability,
  ProviderOrderRequest,
  ProviderOrderResult,
  ProviderQuote,
} from '../types';

/**
 * Straight-line distance in kilometres.
 *
 * Haversine on a spherical earth. Good to a few metres over the distances a
 * restaurant delivers, and the same measure the existing store list already
 * uses for `distanceKm`, so a customer is never told two different things
 * about how far away they are.
 */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * How the adapter finds the restaurant it is quoting for.
 *
 * Injected rather than imported so the adapter can be tested without standing
 * up the whole store service, and so a future multi-site Pappas does not
 * require this file to learn about store selection.
 */
export interface PappasDirectDeps {
  getStore(storeId: string): Promise<Store | null>;
}

export class PappasDirectAdapter implements DeliveryProvider {
  readonly id = 'pappas-direct' as const;
  readonly displayName = 'Pappas Direct';

  constructor(private readonly deps: PappasDirectDeps) {}

  async getCapabilities(): Promise<readonly ProviderCapability[]> {
    // No `live-tracking` and no `driver-messaging`: Pappas Direct delivery is
    // run by the restaurant, and there is no courier GPS feed behind it. The
    // brief's §5 rule against fake live data applies to our own channel as
    // much as to a third party, and claiming the capability is how a map with
    // an invented moving pin gets built on top of nothing.
    return ['delivery', 'pickup', 'scheduled-order', 'eta', 'cancellation'] as const;
  }

  async validateAddress(address: DeliveryAddress): Promise<AddressCheck> {
    // Without coordinates there is nothing to measure against. The existing
    // app already treats an unlocated address as "nobody knows" rather than
    // stamping it with a default coordinate (see the note on `Address` in
    // types/order.ts), and the same honesty applies here: an unlocated
    // address is not refused, it is simply unverified, and the restaurant
    // confirms it. Saying `serviceable: false` would block real customers;
    // saying `true` without a caveat would promise a delivery we cannot check.
    if (address.latitude === undefined || address.longitude === undefined) {
      return {
        serviceable: true,
        detail: 'Address not geocoded; delivery radius unverified.',
      };
    }
    return { serviceable: true };
  }

  async quote(request: ProviderOrderRequest): Promise<ProviderQuote> {
    const store = await this.deps.getStore(request.storeId);
    if (!store) {
      return {
        available: false,
        reason: 'PROVIDER_ERROR',
        detail: `Unknown store: ${request.storeId}`,
      };
    }

    if (request.fulfilment === 'pickup') {
      if (!store.supportsCollection) {
        return { available: false, reason: 'UNSUPPORTED_MODE' };
      }
      // Collection carries no fee, and the wait is the kitchen's own
      // preparation time rather than a courier estimate.
      return {
        available: true,
        deliveryFeeCents: 0,
        etaMinutes: store.preparationMinutes,
      };
    }

    if (!store.supportsDelivery) {
      return { available: false, reason: 'UNSUPPORTED_MODE' };
    }

    // A scheduled order is quoted against the schedule, not against now, so
    // a restaurant that is currently shut can still take a booking for
    // tomorrow. Only an immediate order needs the doors open.
    if (!store.isOpenNow && !request.scheduledFor) {
      return { available: false, reason: 'OUTSIDE_TRADING' };
    }

    const address = request.address;
    if (address?.latitude !== undefined && address.longitude !== undefined) {
      const distance = haversineKm(
        { latitude: address.latitude, longitude: address.longitude },
        { latitude: store.latitude, longitude: store.longitude },
      );
      if (distance > store.deliveryRadiusKm) {
        return {
          available: false,
          reason: 'OUT_OF_AREA',
          detail: `${distance.toFixed(1)}km from store, radius ${store.deliveryRadiusKm}km`,
        };
      }
    }

    const subtotalRands = request.subtotalCents / 100;
    if (subtotalRands < businessRules.minimumDeliverySubtotal) {
      return {
        available: false,
        reason: 'MINIMUM_NOT_MET',
        detail: `Subtotal below R${businessRules.minimumDeliverySubtotal}`,
      };
    }

    // The fee rules are the app's existing commercial rules, read rather than
    // restated — extension §8: "Do not hard-code commissions, delivery fees,
    // service fees or settlement rules; make them configurable."
    const feeRands =
      subtotalRands >= businessRules.freeDeliveryThreshold ? 0 : businessRules.deliveryFee;

    return {
      available: true,
      deliveryFeeCents: toCents(feeRands),
      etaMinutes: store.preparationMinutes + businessRules.deliveryBufferMinutes,
    };
  }

  async createOrder(request: ProviderOrderRequest): Promise<ProviderOrderResult> {
    // Pappas Direct orders are placed by `orderService`, which owns payment,
    // loyalty accrual and the kitchen handoff. This method exists so the
    // checkout can treat every channel identically; it returns the canonical
    // shape and lets the caller carry the real order id through.
    //
    // Re-quoting here rather than trusting the request means a customer who
    // sat on the checkout screen while the restaurant closed is refused
    // rather than charged.
    const quote = await this.quote(request);
    if (!quote.available) {
      throw new ProviderOrderRejected(
        'pappas-direct',
        quote.reason ?? 'PROVIDER_ERROR',
        quote.detail,
      );
    }

    return {
      provider: this.id,
      externalOrderId: request.idempotencyKey,
      status: 'submitted',
      etaMinutes: quote.etaMinutes,
    };
  }

  async cancelOrder(): Promise<void> {
    // Direct cancellation is a restaurant decision, handled by the existing
    // order service and its support flow. Nothing provider-specific to do.
  }
}

/**
 * A provider refused an order, for a reason the UI can render.
 *
 * Carries the closed-set reason rather than only a message, so a screen can
 * decide between "Coming soon", "We don't deliver to this address yet" and
 * "Please try again" without parsing prose.
 */
export class ProviderOrderRejected extends Error {
  constructor(
    readonly provider: string,
    readonly reason: string,
    readonly detail?: string,
  ) {
    super(`${provider} rejected the order: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'ProviderOrderRejected';
  }
}
