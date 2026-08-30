import { fetchFavourites, saveFavourites } from '@/services/accountService';
import { useFavouritesStore } from '@/store/favouritesStore';

/**
 * Carrying hearted products between the handset and the account.
 *
 * The store stays local-first and knows nothing about a network: a favourite
 * has to survive a signed-out browse, an offline menu and a cold start, and
 * the quickest way to break all three is to make the heart wait on a request.
 * So local is authoritative, and this is the thin layer that tells the server
 * about it afterwards.
 *
 * Two directions, with different rules:
 *
 *   **Pull, on sign-in** — union of what is on the handset and what is on the
 *   account. Not "server wins": a guest hearts three things and then signs in,
 *   and taking those away is precisely the failure the store was written to
 *   avoid. Not "local wins" either, or a new handset would silently erase what
 *   the account already had. The union is the only merge that cannot lose a
 *   heart somebody deliberately gave.
 *
 *   **Push, on change** — the whole list, debounced. `saveFavourites` is a PUT
 *   of the entire array, so a push that fails costs nothing: the local copy is
 *   still the truth and the next push carries what the failed one was meant to.
 *   That is why there is no retry and no outbox here.
 *
 * Ordering note: `claimFor` runs first, synchronously, inside `setSession`. By
 * the time a pull lands, the list is either this person's own or empty — never
 * the previous account's — so the union below can never hand somebody a
 * stranger's favourites.
 */

/** How long to wait for the tapping to stop before telling the server. */
const PUSH_DEBOUNCE_MS = 800;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * Merge the account's list into the handset's.
 *
 * Local order is kept and the server's extras are appended, because local
 * order is "most recently hearted first" and is the order the Favourites tab
 * shows. Anything only the account knew about is older by definition.
 */
export function mergeFavourites(local: string[], remote: string[]): string[] {
  const seen = new Set(local);
  return [...local, ...remote.filter((id) => !seen.has(id))];
}

/**
 * Pull one account's favourites and merge them in. Never throws: a failed pull
 * leaves the handset's own list exactly as it was, which is a working app.
 *
 * `customerId` is not optional and is not read from the store, deliberately.
 * Whose list this is, is the whole safety property here — a pull that fetched
 * "the favourites" rather than "this person's favourites" handed one customer
 * another's hearted dishes, which is what `audit:handover` caught. Making the
 * caller name the account means the question cannot be skipped.
 */
export async function pullFavourites(customerId: string): Promise<void> {
  try {
    const remote = await fetchFavourites(customerId);

    // Re-read after the await: signing straight back out, or in as somebody
    // else, while the request was in flight would otherwise merge this reply
    // into whatever list is on screen by the time it lands.
    const { productIds, ownerId } = useFavouritesStore.getState();
    if (ownerId !== customerId) return;

    const merged = mergeFavourites(productIds, remote);

    // Only touch the store if the merge actually changed something, so a pull
    // that agrees with local does not re-render every hearted row.
    if (merged.length !== productIds.length) {
      useFavouritesStore.setState({ productIds: merged });
      void pushFavourites(customerId, merged);
    }
  } catch {
    // Offline, or no account service yet. Local stands.
  }
}

/** Tell the server one account's list. Never throws, for the reason above. */
export async function pushFavourites(customerId: string, productIds: string[]): Promise<void> {
  try {
    await saveFavourites(customerId, productIds);
  } catch {
    // The next push carries this one's contents too.
  }
}

/**
 * Start pushing local changes to the account.
 *
 * Returns a teardown, and is safe to call twice — the second call replaces the
 * first rather than leaving two subscriptions pushing the same list.
 */
export function startFavouritesSync(): () => void {
  stopFavouritesSync();

  unsubscribe = useFavouritesStore.subscribe((state, previous) => {
    // Only a change to the list itself is worth a request; `ownerId` moving is
    // sign-in bookkeeping, and the pull that follows it does its own push.
    if (state.productIds === previous.productIds) return;
    // Nobody is signed in, so there is no account to put this on.
    if (state.ownerId === null) return;

    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      // Re-read the owner as well as the list: the debounce window is long
      // enough to sign out in, and a push must never land on the account that
      // happens to be signed in when the timer fires.
      const { productIds, ownerId } = useFavouritesStore.getState();
      if (ownerId === null) return;
      void pushFavourites(ownerId, productIds);
    }, PUSH_DEBOUNCE_MS);
  });

  return stopFavouritesSync;
}

export function stopFavouritesSync(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  unsubscribe?.();
  unsubscribe = null;
}
