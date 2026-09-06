import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { revokePushToken } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';

/**
 * Signing out, meaning all of it.
 *
 * `authStore.signOut` cleared three fields and left everything else standing.
 * Measured at the store level, this survived a sign-out and — because both
 * stores persist to AsyncStorage — an app restart after it:
 *
 *     fulfilment.addr   = 14 Acacia Road
 *     fulfilment.instr  = "Buzzer 3 at the gate. Please call on arrival."
 *     fulfilment.coords = { latitude: -26.14, longitude: 28.04 }
 *     cart.lines        = 1 [ 'Golden Original Chicken' ]
 *
 * Plus the whole query cache: order history, loyalty balance, saved addresses,
 * card last-four. A home address and a gate instruction is enough to turn up
 * at someone's house, and phones get shared, handed down and sold.
 *
 * The session-expiry path already cleared the query cache and carried a
 * comment about exactly this risk. The path people actually use did not — and
 * neither of them forgot the address. Both go through here now, so they cannot
 * drift apart again.
 *
 * Not cleared: `hasCompletedOnboarding`, and whether the location permission
 * sheet has been shown. Those are facts about the handset rather than about
 * whoever was holding it.
 */
export function useSignOut(): {
  signOut: () => Promise<void>;
  forgetLocally: (options?: { redirect?: boolean }) => void;
} {
  const router = useRouter();
  const queryClient = useQueryClient();

  const signOutRemote = useAuthStore((state) => state.signOut);
  const signOutLocally = useAuthStore((state) => state.signOutLocally);
  const clearCart = useCartStore((state) => state.clear);
  const forgetFulfilment = useFulfilmentStore((state) => state.forgetPerson);

  /**
   * Everything except telling the server, which the two paths differ on.
   *
   * `redirect` is false for exactly one caller: a session that expired while a
   * payment was in flight. Everything is still forgotten — the basket, the
   * address, the query cache — because none of that depends on where the
   * customer is standing. What must not happen is replacing the route, because
   * the screen underneath is holding "your order did not go through, but your
   * card was authorised — call the store", and navigating away from that
   * leaves somebody with a hold on their card and no idea it exists.
   */
  const forget = useCallback(
    ({ redirect = true }: { redirect?: boolean } = {}) => {
      clearCart();
      forgetFulfilment();
      queryClient.clear();
      if (redirect) router.replace('/(auth)/sign-in');
    },
    [clearCart, forgetFulfilment, queryClient, router],
  );

  const signOut = useCallback(async () => {
    // Unbind the handset first, while the request can still authenticate.
    // `syncPushToken` registers this device against whoever is signed in and
    // nothing undid it, so the server kept pushing one person's order updates
    // to a phone somebody else is now holding. Best-effort: a failed revoke
    // must not keep anyone signed in.
    await revokePushToken().catch(() => false);

    // The local clear happens whether or not the server call succeeds. A
    // failed sign-out that leaves someone's address on a handed-over phone is
    // the worse of the two outcomes by a distance.
    try {
      await signOutRemote();
    } finally {
      forget();
    }
  }, [signOutRemote, forget]);

  const forgetLocally = useCallback(
    ({ redirect = true }: { redirect?: boolean } = {}) => {
      // An expired session cannot authenticate a revoke, so this only drops the
      // app's own memory of the token. The server will stop trusting the session
      // anyway; the binding is cleaned up on the next deliberate sign-out or the
      // next sign-in, whichever comes first.
      void revokePushToken().catch(() => false);
      signOutLocally();
      forget({ redirect });
    },
    [signOutLocally, forget],
  );

  return { signOut, forgetLocally };
}
