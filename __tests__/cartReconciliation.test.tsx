import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { MenuSnapshot, Product } from '@/types';
import { useCartReconciliation } from '@/features/cart/useCartReconciliation';
import { useCartStore } from '@/store/cartStore';
import * as menuService from '@/services/menuService';
import { buildCartLine } from '@/utils/cart';

jest.mock('@/services/menuService', () => ({
  ...jest.requireActual('@/services/menuService'),
  fetchMenu: jest.fn(),
}));

const fetchMenu = menuService.fetchMenu as jest.MockedFunction<typeof menuService.fetchMenu>;

const product: Product = {
  id: 'golden-original',
  slug: 'golden-original-chicken',
  name: 'Golden Original Chicken',
  shortDescription: 'Crispy',
  description: 'Crispy chicken',
  basePrice: 149,
  categoryId: 'chicken',
  assetKey: 'goldenOriginal',
  spiceLevel: 0,
  tags: [],
  optionGroups: [],
  recommendedProductIds: [],
  available: true,
  preparationMinutes: 18,
  serves: 'Serves 2 – 3',
  allergens: [],
};

const menuOf = (products: Product[]): MenuSnapshot => ({
  categories: [],
  products,
  updatedAt: '2026-08-23T00:00:00.000Z',
});

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fetchMenu.mockReset();
  // No retries: an errored query must settle immediately so the assertion is
  // about the hook's behaviour rather than about retry timing.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  act(() => {
    useCartStore.setState({ lines: [], voucher: null, reward: null, reconciliationNotice: null });
  });
});

afterEach(() => {
  // A query left in flight notifies its observers after the test has finished,
  // which React reports as an unwrapped act() update. Cancelling here keeps
  // that noise out of the log, where it would hide a real warning.
  client.cancelQueries();
  client.clear();
});

const seedCart = () => {
  const line = buildCartLine(product, [], 2);
  act(() => {
    useCartStore.setState({ lines: [line] });
  });
  return line;
};

describe('useCartReconciliation', () => {
  it('reprices the saved basket once the menu arrives', async () => {
    seedCart();
    fetchMenu.mockResolvedValue(menuOf([{ ...product, basePrice: 169 }]));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(result.current.notice).not.toBeNull());
    expect(useCartStore.getState().lines[0]?.unitPrice).toBe(169);
    expect(result.current.notice).toContain('R 169.00');
  });

  /**
   * The rule this exists to hold. Reconciling against a menu that failed to
   * load would read as "every item is off the menu" and silently empty a
   * basket the customer spent five minutes filling — on nothing worse than a
   * lift with no signal.
   */
  it('leaves the basket untouched when the menu fails to load', async () => {
    const line = seedCart();
    fetchMenu.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(fetchMenu).toHaveBeenCalled());
    // Give the effect every chance to run and do the wrong thing.
    await act(async () => {
      await Promise.resolve();
    });

    expect(useCartStore.getState().lines).toEqual([line]);
    expect(result.current.notice).toBeNull();
  });

  it('leaves the basket untouched while the menu is still loading', async () => {
    const line = seedCart();
    fetchMenu.mockImplementation(() => new Promise(() => {})); // never settles

    renderHook(() => useCartReconciliation(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(useCartStore.getState().lines).toEqual([line]);
  });

  /**
   * A menu that comes back with no products at all is far more likely to be a
   * broken response than a restaurant with nothing to sell.
   */
  it('treats an empty menu as suspect rather than as a closed kitchen', async () => {
    const line = seedCart();
    fetchMenu.mockResolvedValue(menuOf([]));

    renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(fetchMenu).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });

    expect(useCartStore.getState().lines).toEqual([line]);
  });

  it('says nothing when the basket already agrees with the menu', async () => {
    seedCart();
    fetchMenu.mockResolvedValue(menuOf([product]));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(fetchMenu).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.notice).toBeNull();
  });

  /**
   * This asserted the opposite until the reasoning under it was checked: "the
   * code was validated against a subtotal that no longer exists". True of the
   * cart that froze a voucher's discount when it was entered, and untrue since
   * `priceBasket` began recomputing `voucherDiscount` — minimum spend and
   * expiry included — against the basket as it stands.
   *
   * What the old rule cost is easiest to see through the reward, which is why
   * it is applied here too: `rewards/[id]` spends the loyalty points before
   * applying it, and `RewardTerms` has no minimum spend to fall below. There
   * was no subtotal at which it stopped qualifying — only 400 points gone.
   */
  it('leaves an applied voucher and reward alone through a reprice', async () => {
    seedCart();
    const voucher = {
      code: 'BBQ50',
      discountType: 'fixed' as const,
      discountValue: 50,
      minimumSpend: 0,
    };
    const reward = {
      rewardId: 'free-wings',
      name: 'Free Wings',
      discount: 79,
      pointsCost: 400,
      category: 'food' as const,
    };
    act(() => {
      useCartStore.setState({ voucher, reward });
    });
    fetchMenu.mockResolvedValue(menuOf([{ ...product, basePrice: 169 }]));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(result.current.notice).not.toBeNull());
    expect(useCartStore.getState().voucher).toEqual(voucher);
    expect(useCartStore.getState().reward).toEqual(reward);
  });

  /**
   * A rename is the case that made the old rule expensive rather than merely
   * wrong: the line has to be written back, so reconciliation ran, but the
   * notice is correctly null because nothing a customer cares about moved. The
   * discount vanished with nothing on screen to account for it.
   */
  it('leaves them alone through a rename, which says nothing to anybody', async () => {
    seedCart();
    const voucher = {
      code: 'BBQ50',
      discountType: 'fixed' as const,
      discountValue: 50,
      minimumSpend: 0,
    };
    act(() => {
      useCartStore.setState({ voucher });
    });
    fetchMenu.mockResolvedValue(menuOf([{ ...product, name: 'Golden Original Chicken (large)' }]));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    // Waited for rather than ticked once: the write-back is what proves
    // reconciliation ran at all, and a single microtask is not reliably enough
    // for the query to have settled first.
    await waitFor(() =>
      expect(useCartStore.getState().lines[0]?.name).toBe('Golden Original Chicken (large)'),
    );

    expect(result.current.notice).toBeNull();
    expect(useCartStore.getState().voucher).toEqual(voucher);
  });

  it('drops them when reconciliation empties the basket', async () => {
    seedCart();
    act(() => {
      useCartStore.setState({
        voucher: { code: 'BBQ50', discountType: 'fixed', discountValue: 50, minimumSpend: 0 },
      });
    });
    // The only thing in the basket, off the menu.
    fetchMenu.mockResolvedValue(menuOf([{ ...product, available: false }]));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(result.current.notice).not.toBeNull());
    expect(useCartStore.getState().lines).toHaveLength(0);
    // Nothing to apply it to — the same rule `removeLine` has always used.
    expect(useCartStore.getState().voucher).toBeNull();
  });

  it('settles instead of reconciling in a loop', async () => {
    seedCart();
    fetchMenu.mockResolvedValue(menuOf([{ ...product, basePrice: 169 }]));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(result.current.notice).not.toBeNull());
    const afterFirstPass = useCartStore.getState().lines;

    await act(async () => {
      await Promise.resolve();
    });

    // Writing back must not itself look like a change worth writing back.
    expect(useCartStore.getState().lines).toBe(afterFirstPass);
  });
});
