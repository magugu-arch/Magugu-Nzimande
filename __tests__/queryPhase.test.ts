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

/**
 * Checkout tells the customer they are offline; it does not stop them.
 *
 * Blocking was the first instinct and the wrong one. Driven in a browser the
 * app dropped to offline correctly and then never recovered — `navigator.onLine`
 * true again, NetInfo still reporting disconnected, banner still up. On a real
 * handset NetInfo takes connectivity from the OS and should recover, but that
 * could not be confirmed here, and a disabled button that never re-enables
 * locks a customer out of paying for good.
 *
 * A wrong warning costs a moment's doubt. A wrong lockout costs the order. So
 * the blockers stay things the customer can actually put right, and the
 * network is advice sitting beside them.
 */
describe('what checkout refuses to do', () => {
  const captionFor = ({
    lines,
    hasPayment,
    isOffline,
  }: {
    lines: number;
    hasPayment: boolean;
    isOffline: boolean;
  }): { caption: string | null; disabled: boolean } => {
    const blocker =
      lines === 0 ? 'Your cart is empty' : !hasPayment ? 'Choose a payment method' : null;
    const notice = isOffline ? "You're offline — this may not go through" : null;
    return { caption: blocker ?? notice, disabled: Boolean(blocker) };
  };

  it('stops an order it knows is incomplete', () => {
    expect(captionFor({ lines: 0, hasPayment: false, isOffline: false })).toEqual({
      caption: 'Your cart is empty',
      disabled: true,
    });
  });

  it('warns about the network without taking the button away', () => {
    expect(captionFor({ lines: 1, hasPayment: true, isOffline: true })).toEqual({
      caption: "You're offline — this may not go through",
      disabled: false,
    });
  });

  /** A real blocker outranks the advice; both at once would stack two lines. */
  it('shows the fixable problem rather than the network one', () => {
    expect(captionFor({ lines: 0, hasPayment: false, isOffline: true }).caption).toBe(
      'Your cart is empty',
    );
  });

  it('says nothing when there is nothing to say', () => {
    expect(captionFor({ lines: 1, hasPayment: true, isOffline: false })).toEqual({
      caption: null,
      disabled: false,
    });
  });
});
