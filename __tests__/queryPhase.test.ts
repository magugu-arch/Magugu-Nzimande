import { QueryClient, QueryObserver, onlineManager } from '@tanstack/react-query';
import { isOfflinePending, type PhasedQuery } from '@/features/system/queryPhase';

const q = (over: Partial<PhasedQuery>): PhasedQuery => ({
  isSuccess: false,
  isError: false,
  fetchStatus: 'idle',
  ...over,
});

/**
 * The state that fell through every screen's render logic: not loading, not an
 * error, no data. Screens then read `data ?? []` and drew an empty state — so
 * a phone with no signal was told "No offers right now" and "No orders on the
 * go", for as long as the signal stayed gone.
 */
describe('isOfflinePending', () => {
  it('catches a query paused with nothing to show', () => {
    expect(isOfflinePending(q({ fetchStatus: 'paused' }))).toBe(true);
  });

  it('leaves a genuine first load alone', () => {
    expect(isOfflinePending(q({ fetchStatus: 'fetching' }))).toBe(false);
  });

  it('leaves a real error alone, which has its own screen', () => {
    expect(isOfflinePending(q({ isError: true, fetchStatus: 'paused' }))).toBe(false);
  });

  /**
   * A query that already has data and is only paused mid-refetch should keep
   * showing what it has. Dropping the customer to a message because a
   * background refresh could not run would be a worse app.
   */
  it('leaves cached data on screen when only the refetch is paused', () => {
    expect(isOfflinePending(q({ isSuccess: true, fetchStatus: 'paused' }))).toBe(false);
  });

  it('says nothing about an idle query, which is a disabled one', () => {
    expect(isOfflinePending(q({ fetchStatus: 'idle' }))).toBe(false);
  });
});

/**
 * The above is only right if TanStack Query really does report that shape. It
 * is the assumption the whole fix rests on, so it is measured here against a
 * real client rather than taken on trust.
 */
describe('what an offline query actually reports', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('pauses without loading and without erroring', async () => {
    onlineManager.setOnline(false);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: 2, networkMode: 'offlineFirst', gcTime: 0 } },
    });
    const observer = new QueryObserver(client, {
      queryKey: ['offers'],
      queryFn: () => Promise.reject(new Error('no network')),
    });

    const seen: PhasedQuery[] = [];
    const unsubscribe = observer.subscribe((result) => {
      seen.push({
        isSuccess: result.isSuccess,
        isError: result.isError,
        fetchStatus: result.fetchStatus,
      });
    });

    observer.refetch().catch(() => {});
    // The pause lands after the first attempt fails, not on the first tick.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    unsubscribe();
    client.clear();

    const paused = seen.find((state) => state.fetchStatus === 'paused');
    expect(paused).toBeDefined();
    // The exact shape the screens were falling through.
    expect(paused?.isSuccess).toBe(false);
    expect(paused?.isError).toBe(false);
    // And the gate catches it.
    expect(isOfflinePending(paused!)).toBe(true);
  });
});
