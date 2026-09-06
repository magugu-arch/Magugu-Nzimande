import { config } from '@/constants/config';
import type { DeliveryProvider, DeliveryStatus } from '@/types/delivery';
import type { OrderStatus } from '@/types/order';
import { mockDeliveryProvider } from './mockDeliveryProvider';

/**
 * Which courier network runs a delivery, chosen at runtime (brief §7: "use
 * feature flags for provider integrations").
 *
 * The registry is the whole point. An authorised integration is a new entry
 * here and a value in `EXPO_PUBLIC_DELIVERY_PROVIDER` — not a change to the
 * order service, the tracking screen, or any type. Per §12, none ships:
 * credentials, contracts and technical approval are prerequisites this
 * repository does not have and must not invent.
 *
 * An unknown name falls back to the mock rather than throwing. A courier
 * provider that cannot be resolved is a misconfiguration, and taking the whole
 * app down at import time over one is the wrong trade — orders can still be
 * collected. `deliveryProviderIsConfigured` reports the truth for the launch
 * audit, which is where an unresolvable name should be loud.
 */
const REGISTRY: Record<string, DeliveryProvider> = {
  mock: mockDeliveryProvider,
};

export function deliveryProvider(): DeliveryProvider {
  return REGISTRY[config.delivery.provider] ?? mockDeliveryProvider;
}

/** Whether the configured provider name actually resolves to something. */
export function deliveryProviderIsConfigured(): boolean {
  return config.delivery.provider in REGISTRY;
}

/** Every provider the build knows how to talk to. */
export function knownDeliveryProviders(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * The courier's status, translated into what the customer reads.
 *
 * One function, in one place, because these are two vocabularies for one
 * journey and the app has already been burned by holding a fact in two forms
 * that could disagree — the tier ladder, the delivery fee in prose, the
 * advertised earn rate. The rule here is the same: the customer-facing status
 * is *derived* from the courier's, never stored beside it.
 *
 * `CONFIRMED` deliberately maps to `preparing` rather than to a status of its
 * own. A courier job being confirmed is a fact about the courier network, and
 * the customer's food is still in the kitchen — telling them anything else
 * would be describing somebody else's progress as their own.
 *
 * `FAILED` maps to `ready`, not to `cancelled`. A courier who cannot deliver
 * has not cancelled the order: the food exists, it is paid for, and the store
 * needs to reach the customer. Calling that "cancelled" would tell somebody
 * their money is coming back when nobody has decided that.
 */
export function deliveryStatusToOrderStatus(status: DeliveryStatus): OrderStatus {
  switch (status) {
    case 'CONFIRMED':
      return 'preparing';
    case 'COURIER_ASSIGNED':
      return 'courier_assigned';
    case 'PICKED_UP':
    case 'ON_THE_WAY':
      return 'out_for_delivery';
    case 'DELIVERED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'FAILED':
      return 'ready';
  }
}

export {
  mockDeliveryProvider,
  resetMockDeliveryJobs,
  seedFailedDeliveryJob,
  seedTrackedDeliveryJob,
} from './mockDeliveryProvider';
