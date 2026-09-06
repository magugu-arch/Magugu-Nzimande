/**
 * The state that falls through every screen's render logic.
 *
 * Screens were written to the usual pattern, and the usual pattern has a hole:
 *
 *     if (query.isLoading) return <LoadingState />;
 *     if (query.isError) return <ErrorState />;
 *     const list = query.data ?? [];
 *     if (list.length === 0) return <EmptyState … />;
 *
 * Measured directly against a real QueryClient with `networkMode:
 * 'offlineFirst'`, a query on a phone with no signal reports:
 *
 *     isLoading=false  isError=false  fetchStatus=paused  data=undefined
 *
 * `isLoading` false, `isError` false, no data — so `data ?? []` becomes an
 * empty list and the screen renders an empty state. The app then says "No
 * offers right now", "No orders on the go", "No payment methods saved". Not
 * for a moment: for as long as the signal is gone, because a paused query
 * never errors and never retries.
 *
 * Swept against a dead API host, eleven of fourteen screens claimed something
 * false rather than admitting they could not reach the server.
 *
 * The distinction the pattern misses is the whole point: **an empty state is a
 * claim about the world; an error state is a claim about the app.** When the
 * fetch has not succeeded the app does not know the world, and "you have no
 * vouchers" is not a thing it is entitled to say. Telling someone whose dinner
 * is being cooked that they have no orders on the go is worse than telling
 * them nothing.
 */
export interface PhasedQuery {
  isSuccess: boolean;
  isError: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

/**
 * Nothing to show, nothing being fetched, and no error to report — because
 * there is no network to fetch over.
 *
 * Checked rather than `queryPhase`-style branching so that adding this to a
 * screen cannot change what loading or error already do. It only catches what
 * was falling past both.
 *
 * `isSuccess` is excluded deliberately: a query that already has data and is
 * merely paused mid-refetch should keep showing what it has, not drop the
 * customer back to a message.
 */
export function isOfflinePending(query: PhasedQuery): boolean {
  return !query.isSuccess && !query.isError && query.fetchStatus === 'paused';
}

/**
 * The same question asked by a screen that has no room to stop and answer it.
 *
 * `isOfflinePending` is for a screen that can hand the whole viewport over to a
 * message: it catches only the paused case, so adding it cannot change what an
 * existing loading or error branch already does.
 *
 * Checkout has no such branch and cannot grow one. It renders from the cart,
 * and the three queries behind it — saved cards, saved addresses, branches —
 * are supporting cast. Losing any one of them must not blank the screen a
 * customer is trying to pay from, so each one is read where it is used and the
 * question there is simply: **did this arrive?**
 *
 * Not "is it paused", because a 500 from the account endpoint leaves the
 * customer just as cardless and `isOfflinePending` false. Not "is it errored",
 * because offline is the commonest case and never errors. What both have in
 * common, and what a first load does not, is that nothing is on its way.
 *
 * Quiet while `fetching`, so the first paint says "loading" by saying nothing
 * rather than accusing a server that has had no chance to answer.
 */
export function didNotArrive(query: PhasedQuery): boolean {
  return !query.isSuccess && query.fetchStatus !== 'fetching';
}
