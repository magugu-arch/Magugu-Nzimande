import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { useSignOut } from '@/features/system/useSignOut';
import { revokePushToken, syncPushToken, syncedPushToken } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';

// Prefixed `mock` so jest allows the factory to close over it.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

/**
 * Signing out used to clear three fields on the auth store and nothing else.
 * Measured at the store level, this survived it — and, because both stores
 * persist to AsyncStorage, survived an app restart after it too:
 *
 *     fulfilment.addr   = 14 Acacia Road
 *     fulfilment.instr  = "Buzzer 3 at the gate. Please call on arrival."
 *     fulfilment.coords = { latitude: -26.14, longitude: 28.04 }
 *     cart.lines        = 1 [ 'Golden Original Chicken' ]
 *
 * A home address and a gate instruction is enough to turn up at someone's
 * house, and phones get shared, handed down and sold.
 *
 * This could not be driven in the browser sweep: sign-out sits behind
 * `Alert.alert`, which React Native Web does not implement. It works on the
 * platforms the app actually ships to — but it does mean the screen audit and
 * the order smoke can never reach this path, so it is checked here instead.
 */
const ADDRESS = {
  id: 'a1',
  label: 'Home',
  line1: '14 Acacia Road',
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2196',
  latitude: -26.146,
  longitude: 28.041,
  instructions: 'Buzzer 3 at the gate.',
  isDefault: true,
};

function seedAPerson() {
  act(() => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'thabo@example.co.za', firstName: 'Thabo' } as never,
      isAuthenticated: true,
      preferences: {
        defaultFulfilment: 'collection',
        marketingConsent: true,
        preferMildFirst: true,
      },
      notificationPreferences: {
        orderUpdates: false,
        promotions: false,
        rewards: false,
        newProducts: true,
        channelPush: false,
        channelEmail: false,
        channelSms: true,
      },
    });
    useFulfilmentStore.setState({
      address: ADDRESS as never,
      deliveryInstructions: 'Buzzer 3 at the gate. Please call on arrival.',
      coordinates: { latitude: -26.14, longitude: 28.04 },
      store: { id: 's1', name: 'bb.q Chicken Rosebank' } as never,
      tableNumber: '12',
    });
    useCartStore.setState({
      lines: [{ id: 'l1', name: 'Golden Original Chicken', lineTotal: 209 }] as never,
    });
  });
}

function renderSignOut() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['orders'], [{ reference: 'BBQ-4821' }]);

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { ...renderHook(() => useSignOut(), { wrapper }), queryClient };
}

describe('signing out', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    act(() => {
      useAuthStore.getState().signOutLocally();
      useCartStore.getState().clear();
      useFulfilmentStore.getState().forgetPerson();
    });
  });

  it('forgets where the customer lives', async () => {
    seedAPerson();
    const { result } = renderSignOut();

    await act(async () => {
      await result.current.signOut();
    });

    const fulfilment = useFulfilmentStore.getState();
    expect(fulfilment.address).toBeNull();
    expect(fulfilment.deliveryInstructions).toBe('');
    expect(fulfilment.coordinates).toBeNull();
    expect(fulfilment.store).toBeNull();
    expect(fulfilment.tableNumber).toBe('');
  });

  it('empties the basket', async () => {
    seedAPerson();
    const { result } = renderSignOut();

    await act(async () => {
      await result.current.signOut();
    });

    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  /** Order history, loyalty balance, saved cards — all fetched as them. */
  it('drops everything fetched as that person', async () => {
    seedAPerson();
    const { result, queryClient } = renderSignOut();

    expect(queryClient.getQueryData(['orders'])).toBeDefined();

    await act(async () => {
      await result.current.signOut();
    });

    expect(queryClient.getQueryData(['orders'])).toBeUndefined();
  });

  /**
   * `marketingConsent` is a consent record. Under POPIA it belongs to the
   * person who gave it, and inheriting it is not a tidiness problem.
   */
  it('does not hand the next person the last one’s consent', async () => {
    seedAPerson();
    const { result } = renderSignOut();

    await act(async () => {
      await result.current.signOut();
    });

    const auth = useAuthStore.getState();
    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.preferences.marketingConsent).toBe(false);
    expect(auth.notificationPreferences.orderUpdates).toBe(true);
    expect(auth.notificationPreferences.channelSms).toBe(false);
  });

  /** Onboarding is a fact about the handset, not about who is holding it. */
  it('does not make the next person sit through onboarding again', async () => {
    seedAPerson();
    act(() => {
      useAuthStore.getState().completeOnboarding();
    });
    const { result } = renderSignOut();

    await act(async () => {
      await result.current.signOut();
    });

    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it('sends them to sign in', async () => {
    seedAPerson();
    const { result } = renderSignOut();

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  /**
   * The local clear must not depend on the server call working. A failed
   * sign-out that leaves an address on a handed-over phone is much the worse
   * of the two outcomes.
   */
  it('forgets them even when the server call fails', async () => {
    seedAPerson();
    const boom = jest
      .spyOn(useAuthStore.getState(), 'signOut')
      .mockRejectedValue(new Error('offline'));

    const { result } = renderSignOut();

    await act(async () => {
      await result.current.signOut().catch(() => {});
    });

    expect(useFulfilmentStore.getState().address).toBeNull();
    expect(useCartStore.getState().lines).toHaveLength(0);
    boom.mockRestore();
  });

  /** An expired session goes through exactly the same clearing. */
  it('forgets just as much when the session simply expires', () => {
    seedAPerson();
    const { result } = renderSignOut();

    act(() => {
      result.current.forgetLocally();
    });

    expect(useFulfilmentStore.getState().address).toBeNull();
    expect(useFulfilmentStore.getState().coordinates).toBeNull();
    expect(useCartStore.getState().lines).toHaveLength(0);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

/**
 * `syncPushToken` registers this handset against whoever is signed in, and
 * nothing undid it. Signing out cleared the app's own memory of a person and
 * left the server still pushing that person's order updates to this phone: on
 * a device that has been shared, handed down or sold, the next owner reads
 * "Your order BBQ-4823 is on its way" for an order that is not theirs.
 */
describe('the push token this handset is registered under', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    act(() => {
      useAuthStore.getState().signOutLocally();
      useCartStore.getState().clear();
      useFulfilmentStore.getState().forgetPerson();
    });
  });

  it('is remembered once the server has been told about it', async () => {
    await syncPushToken('ExponentPushToken[thabo-handset]');
    await expect(syncedPushToken()).resolves.toBe('ExponentPushToken[thabo-handset]');
  });

  it('is given up when the customer signs out', async () => {
    await syncPushToken('ExponentPushToken[thabo-handset]');
    seedAPerson();
    const { result } = renderSignOut();

    await act(async () => {
      await result.current.signOut();
    });

    await expect(syncedPushToken()).resolves.toBeNull();
  });

  it('is given up when the session expires too', async () => {
    await syncPushToken('ExponentPushToken[thabo-handset]');
    seedAPerson();
    const { result } = renderSignOut();

    // `forgetLocally` fires the revoke without awaiting it, which is right —
    // an expired session must not wait on a network call to let go of the
    // person. The clear now reaches disk as well as memory, so it lands a tick
    // later than it used to and this has to flush before asserting.
    await act(async () => {
      result.current.forgetLocally();
    });

    await expect(syncedPushToken()).resolves.toBeNull();
  });

  /** Nothing to revoke is not a failure — plenty of customers never opt in. */
  it('is happy when there was never a token', async () => {
    await expect(revokePushToken()).resolves.toBe(true);
  });
});
