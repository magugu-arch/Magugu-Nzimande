import { config } from '@/constants/config';
import { mockDeliveryProvider } from './mockProvider';
import type { DeliveryProvider } from './types';

export * from './types';
export { mockDeliveryProvider, resetMockDeliveryProvider } from './mockProvider';

/**
 * Which provider is connected, behind a flag, as §7 asks.
 *
 * There is one, and it is the mock. When an authorised integration exists it
 * is registered here and selected by `EXPO_PUBLIC_DELIVERY_PROVIDER`; nothing
 * that calls `deliveryProvider()` changes.
 *
 * The unknown case returns the mock rather than throwing. A misconfigured
 * environment variable should not take the app down at launch, and the mock
 * refuses honestly — a customer sees "we could not locate that address", which
 * is true, rather than a crash.
 */
const registry: Record<string, DeliveryProvider> = {
  mock: mockDeliveryProvider,
};

export function deliveryProvider(): DeliveryProvider {
  return registry[config.deliveryProvider] ?? mockDeliveryProvider;
}

/** Whether a real integration is connected, for copy that should not over-promise. */
export function hasAuthorisedDeliveryProvider(): boolean {
  return deliveryProvider().id !== 'mock';
}
