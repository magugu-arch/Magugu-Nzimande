import { QueryClient, QueryObserver, focusManager } from '@tanstack/react-query';
import { handleAppStateChange } from '@/features/system/useAppFocus';

/** Let the microtask queue drain between timer advances. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  // `undefined` puts the manager back on its own detection, which is the state
  // a fresh app starts in.
  focusManager.setFocused(undefined);
});

describe('handleAppStateChange', () => {
  it.each([
    ['active', true],
    ['background', false],
    // iOS reports this during an incoming call or in the app switcher. The app
    // is on screen but not in front of the customer.
    ['inactive', false],
  ] as const)('maps %s to focused=%s', (status, focused) => {
    handleAppStateChange(status);
    expect(focusManager.isFocused()).toBe(focused);
  });
});

/**
 * The state that made this necessary: React Native has no `document`, so
 * query-core's fallback — `globalThis.document?.visibilityState !== 'hidden'`
 * — evaluates `undefined !== 'hidden'`, which is true. Nothing ever told it
 * otherwise, so the app believed it was permanently in the foreground.
 */
describe('the default React Native focus state', () => {
  it('claims focus even though nothing has reported any', () => {
    focusManager.setFocused(undefined);
    expect(globalThis.document).toBeUndefined();
    expect(focusManager.isFocused()).toBe(true);
  });
});

/**
 * The behaviour that actually matters. Live order tracking polls every 15
 * seconds and the active order every 30. `refetchIntervalInBackground` is
 * false by default, but the observer decides "background" by asking the focus
 * manager — so with focus never reported, both polls ran while the app was
 * closed, on the customer's mobile data, until the process was killed.
 */
describe('polling while the app is away', () => {
  let client: QueryClient;

  beforeEach(() => {
    // setImmediate stays real: it is what `flush` uses to let the query's own
    // promises settle, and a faked one never fires without being advanced.
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    client.clear();
    jest.useRealTimers();
  });

  const startPolling = (queryFn: jest.Mock) => {
    const observer = new QueryObserver(client, {
      queryKey: ['order-tracking'],
      queryFn,
      refetchInterval: 15_000,
      staleTime: 0,
      // Mirrors the app's own default. Without it, coming back to the
      // foreground would refetch for that reason instead of the interval, and
      // this test would pass without proving anything about polling.
      refetchOnWindowFocus: false,
    });
    return observer.subscribe(() => {});
  };

  it('stops polling once the app goes to the background', async () => {
    const queryFn = jest.fn().mockResolvedValue({ status: 'preparing' });
    const unsubscribe = startPolling(queryFn);

    await flush();
    queryFn.mockClear();

    handleAppStateChange('background');
    jest.advanceTimersByTime(90_000); // six ticks' worth
    await flush();

    expect(queryFn).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('picks the polling back up when the customer returns', async () => {
    const queryFn = jest.fn().mockResolvedValue({ status: 'preparing' });
    const unsubscribe = startPolling(queryFn);

    await flush();
    handleAppStateChange('background');
    jest.advanceTimersByTime(90_000);
    await flush();
    queryFn.mockClear();

    handleAppStateChange('active');
    jest.advanceTimersByTime(30_000);
    await flush();

    // Tracking that never resumes is worse than tracking that never stopped.
    expect(queryFn).toHaveBeenCalled();
    unsubscribe();
  });

  it('polls normally while the app is in front', async () => {
    const queryFn = jest.fn().mockResolvedValue({ status: 'preparing' });
    handleAppStateChange('active');
    const unsubscribe = startPolling(queryFn);

    await flush();
    queryFn.mockClear();

    jest.advanceTimersByTime(16_000);
    await flush();

    expect(queryFn).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
