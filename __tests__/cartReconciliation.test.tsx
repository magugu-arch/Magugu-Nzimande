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

  it('drops the voucher when the basket had to change underneath it', async () => {
    seedCart();
    act(() => {
      useCartStore.setState({
        voucher: { code: 'BBQ50', discount: 50, freeDelivery: false },
      });
    });
    fetchMenu.mockResolvedValue(menuOf([{ ...product, basePrice: 169 }]));

    const { result } = renderHook(() => useCartReconciliation(), { wrapper });

    await waitFor(() => expect(result.current.notice).not.toBeNull());
    // The code was validated against a subtotal that no longer exists.
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
