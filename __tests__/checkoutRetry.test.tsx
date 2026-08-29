import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { SubmitFailure } from '@/features/checkout/submitOrder';
import { stores } from '@/services/data/storeData';
import { useCartStore } from '@/store/cartStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { buildCartLine } from '@/utils/cart';
import { products } from '@/services/data/menuData';

/**
 * What checkout offers after a payment that may already have been taken.
 *
 * `submitOrder` tells four failures apart because two of them mean the card is
 * — or may be — held, and a second attempt is how one order becomes two holds.
 * That is the entire reason the sequence was lifted out of this screen. The
 * screen then discarded it: every non-placed outcome went to one
 * `setSubmitError(outcome.message)`, and the Place order button's `disabled`
 * looked only at pre-flight validation.
 *
 * So the `uncertain` message — "we cannot tell whether your card was
 * authorised … call the store rather than paying twice" — rendered directly
 * above a working Place order button. The words said stop and the affordance
 * said go, and the affordance is the one people obey.
 *
 * This is the first render test of the checkout screen, which is why the defect
 * survived: `submitOrder` and `checkoutDefaults` were both extracted to be
 * testable without a renderer, and nothing ever rendered what used them.
 */

const mockSubmit = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/features/checkout/submitOrder', () => ({
  // The retry rule itself is the thing under test, so it stays real.
  ...jest.requireActual('@/features/checkout/submitOrder'),
  submitOrder: (...args: unknown[]) => mockSubmit(...args),
}));

jest.mock('@/features/account/hooks', () => ({
  useAddresses: () => ({ data: [], isLoading: false, isSuccess: true }),
  usePaymentMethods: () => ({
    data: [
      {
        id: 'payment-visa',
        type: 'card',
        brand: 'visa',
        last4: '4242',
        isDefault: true,
        expiryMonth: 12,
        expiryYear: 2030,
      },
    ],
    isLoading: false,
    isSuccess: true,
  }),
}));

jest.mock('@/features/orders/hooks', () => ({
  usePlaceOrder: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/features/stores/hooks', () => ({
  useStoresForFulfilment: () => ({ data: [], isLoading: false, isSuccess: true }),
}));

jest.mock('@/features/cart/useCartReconciliation', () => ({
  useCartReconciliation: () => ({ notice: null, dismiss: jest.fn() }),
}));

jest.mock('@/features/system/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false }),
}));

jest.mock('@/features/system/useNow', () => ({
  // Built from local parts, not an ISO string with an offset: the runner's
  // timezone is not South Africa's, and `2026-08-29T12:00+02:00` lands at
  // 10:00 UTC — an hour before every branch opens, which read as "closed".
  useNow: () => new Date(2026, 7, 29, 14, 0, 0),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CheckoutScreen = require('@/app/checkout/index').default;

function Wrapped({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
}

/** A collection order at an open branch: everything pre-flight already valid. */
function seedReadyBasket() {
  const product = products[0]!;
  const line = buildCartLine(product, [], 1);
  const openStore = stores.find((candidate) => candidate.supportsCollection)!;

  useCartStore.setState({
    lines: [line],
    fulfilmentType: 'collection',
    voucher: null,
    reward: null,
    reconciliationNotice: null,
  });
  useFulfilmentStore.setState({
    fulfilmentType: 'collection',
    store: openStore,
    address: null,
    tableNumber: '',
    scheduledFor: null,
    deliveryInstructions: '',
  });
  return openStore;
}

const placeOrderButton = () => screen.getByTestId('checkout-place-order');

describe('checkout after a payment that may already have been taken', () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockReplace.mockClear();
    seedReadyBasket();
  });

  it('offers the order in the first place', () => {
    // The guard below is only meaningful if the button starts enabled — a test
    // that passes because checkout was broken anyway proves nothing.
    render(
      <Wrapped>
        <CheckoutScreen />
      </Wrapped>,
    );
    expect(placeOrderButton().props.accessibilityState?.disabled).toBeFalsy();
  });

  it.each([
    [
      'uncertain',
      'We could not reach the payment provider, and we cannot tell whether your card was authorised. Check your banking app before trying again — if a hold is showing, call the store rather than paying twice.',
    ],
    [
      'stranded',
      'Your order did not go through, but your card was authorised. The hold should clear shortly — call the store if it does not.',
    ],
  ] as const)('takes the button away after %s', async (status, message) => {
    mockSubmit.mockResolvedValue({ status, message } as SubmitFailure);

    render(
      <Wrapped>
        <CheckoutScreen />
      </Wrapped>,
    );
    fireEvent.press(placeOrderButton());

    await waitFor(() => expect(screen.getByTestId('checkout-submit-error')).toBeTruthy());
    expect(screen.getByText(message)).toBeTruthy();

    // The whole point: the message says do not pay twice, so the control that
    // would pay twice must not be live.
    await waitFor(() => expect(placeOrderButton().props.accessibilityState?.disabled).toBe(true));
  });

  it.each([
    ['declined', 'That payment did not go through.'],
    ['reversed', 'Kitchen offline. Your card was not charged.'],
  ] as const)(
    'leaves the button alone after %s, where retrying is free',
    async (status, message) => {
      mockSubmit.mockResolvedValue({ status, message } as SubmitFailure);

      render(
        <Wrapped>
          <CheckoutScreen />
        </Wrapped>,
      );
      fireEvent.press(placeOrderButton());

      await waitFor(() => expect(screen.getByTestId('checkout-submit-error')).toBeTruthy());
      // Nothing was taken, so refusing a retry would strand a customer who can
      // simply pay with something else.
      expect(placeOrderButton().props.accessibilityState?.disabled).toBeFalsy();
    },
  );

  it('offers the branch’s own number, because "call the store" needs one', async () => {
    const store = seedReadyBasket();
    mockSubmit.mockResolvedValue({ status: 'uncertain', message: 'Cannot tell.' } as SubmitFailure);

    render(
      <Wrapped>
        <CheckoutScreen />
      </Wrapped>,
    );
    fireEvent.press(placeOrderButton());

    await waitFor(() => expect(screen.getByTestId('checkout-call-store')).toBeTruthy());
    // Read off the accessible name rather than the rendered text: §22 sets
    // button labels in caps, so the glyphs on screen are not the words here.
    expect(screen.getByTestId('checkout-call-store').props.accessibilityLabel).toBe(
      `Call ${store.name}`,
    );
  });
});
