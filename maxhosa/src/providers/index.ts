import type { BookingProvider } from './booking/BookingProvider';
import { MockBookingProvider } from './booking/MockBookingProvider';
import type { CommerceProvider } from './commerce/CommerceProvider';
import { MockCommerceProvider } from './commerce/MockCommerceProvider';
import type { DeliveryProvider, DemoDeliveryControls } from './delivery/DeliveryProvider';
import { MockDeliveryProvider } from './delivery/MockDeliveryProvider';

/**
 * Which adapter backs each domain. Only mocks exist until the discovery audit
 * confirms the platforms (docs/INTEGRATION_STATUS.md). Asking for anything
 * else fails loudly at start-up rather than quietly running on sample data
 * while looking live.
 */
function choose<T>(domain: string, value: string | undefined, mock: () => T): T {
  const wanted = value ?? 'mock';
  if (wanted !== 'mock') {
    throw new Error(
      `${domain} provider "${wanted}" is not implemented yet. Set EXPO_PUBLIC_${domain.toUpperCase()}_PROVIDER=mock.`,
    );
  }
  return mock();
}

const delivery = choose(
  'delivery',
  process.env.EXPO_PUBLIC_DELIVERY_PROVIDER,
  () => new MockDeliveryProvider(),
);

export const providers: {
  commerce: CommerceProvider;
  delivery: DeliveryProvider;
  booking: BookingProvider;
  /** Present only when the delivery provider is the simulator. */
  demoDelivery: DemoDeliveryControls | null;
} = {
  commerce: choose(
    'commerce',
    process.env.EXPO_PUBLIC_COMMERCE_PROVIDER,
    () => new MockCommerceProvider(),
  ),
  delivery,
  booking: choose(
    'booking',
    process.env.EXPO_PUBLIC_BOOKING_PROVIDER,
    () => new MockBookingProvider(),
  ),
  demoDelivery: delivery instanceof MockDeliveryProvider ? delivery : null,
};

/** True while any domain runs on sample data — drives the demo labels. */
export const isDemo =
  providers.commerce.isMock || providers.delivery.isMock || providers.booking.isMock;
