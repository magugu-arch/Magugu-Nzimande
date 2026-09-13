import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useFavouritesStore } from '@/store/favouritesStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';

/**
 * The same customer, in two tabs.
 *
 * Every store in this app persists into `localStorage`, and until this existed
 * nothing read it twice. A tab loaded, rehydrated once, and then believed what
 * it had read for as long as it stayed open — which on a phone is correct,
 * because a phone has one of them, and on the web build is not, because opening
 * a second tab costs one keystroke and the web build is what every preview,
 * every demo and every desktop customer uses.
 *
 * `npm run audit:tabs` opens two pages of one browser profile and measures the
 * second while the first acts on it. Both cases failed:
 *
 *   tab A places the order   B still showed six basket lines and a live Pay
 *                            button, for food that had just been ordered and
 *                            paid for. The obvious way to buy dinner twice.
 *
 *   tab A signs out          B still showed the customer's order history, on
 *                            a screen that requires an account. Which is the
 *                            situation the sign-out button exists for: a
 *                            shared laptop, and somebody else's turn.
 *
 * The second is the one that matters more. A duplicate order is money and can
 * be refunded; a signed-out session that is still on screen is somebody else's
 * name, address and order history, and no refund covers that.
 *
 * ── How ──
 *
 * The browser already reports this. A `storage` event fires in every *other*
 * tab of the same origin whenever one of them writes, carrying the key and the
 * new value. Zustand's persist middleware can be told to re-read on demand, so
 * the whole mechanism is: hear the event, rehydrate that store.
 *
 * Web only, and not because native could not do it — because on native there
 * is no second tab. `Platform.OS` decides rather than a feature check, so the
 * native bundles do not carry a listener that can never fire.
 */

/** Every key a store persists under, and the store that owns it. */
const OWNERS: { key: string; rehydrate: () => void }[] = [
  { key: 'bbq.auth', rehydrate: () => void useAuthStore.persist.rehydrate() },
  { key: 'bbq.cart', rehydrate: () => void useCartStore.persist.rehydrate() },
  { key: 'bbq.fulfilment', rehydrate: () => void useFulfilmentStore.persist.rehydrate() },
  { key: 'bbq.favourites', rehydrate: () => void useFavouritesStore.persist.rehydrate() },
];

export function useCrossTabSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    /**
     * The last value this tab acted on, per key, and why it is needed.
     *
     * Rehydrating sets state, and setting state makes the persist middleware
     * write it straight back — which fires a `storage` event in the *other*
     * tab, which rehydrates, which writes back, and so on. The value is
     * identical every time round, so remembering it and ignoring a repeat ends
     * the exchange after one lap.
     *
     * A flag would not do: two tabs each holding "I am currently applying"
     * still hand the ball back and forth, because each one's write arrives
     * after the other has finished applying.
     */
    const lastSeen = new Map<string, string | null>();

    const onStorage = (event: StorageEvent) => {
      // `key: null` is `localStorage.clear()` — the browser says "all of it",
      // so every store re-reads.
      const changed = event.key === null ? OWNERS : OWNERS.filter((o) => o.key === event.key);
      if (changed.length === 0) return;

      if (event.key !== null) {
        if (lastSeen.get(event.key) === event.newValue) return;
        lastSeen.set(event.key, event.newValue);
      }

      const wasSignedIn = useAuthStore.getState().isAuthenticated;
      for (const owner of changed) owner.rehydrate();

      /*
        A session that ended in another tab takes the cached answers with it.

        Rehydrating makes the *screens* correct — every gated screen reads
        `useIsSignedOut` and puts up its wall. It does nothing about the query
        cache, which is still holding the orders, addresses and loyalty balance
        fetched as the customer who has just signed out. Leaving those would
        mean the next person to sign in on this tab could see the previous
        one's data in the instant before a refetch lands, which is the whole
        problem this is here to prevent, one layer down.

        Only in that direction. Somebody signing *in* on the other tab has
        nothing cached worth dropping, and clearing then would throw away a
        warm menu for no reason.
      */
      if (wasSignedIn && !useAuthStore.getState().isAuthenticated) {
        queryClient.clear();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);
}
