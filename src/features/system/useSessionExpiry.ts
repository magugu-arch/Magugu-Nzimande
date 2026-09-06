import { useEffect } from 'react';
import { setSessionExpiredHandler } from '@/services/apiClient';
import { useSignOut } from './useSignOut';

/**
 * What the app does when the API client gives up on the session.
 *
 * The client handles the mechanics — one refresh attempt, then clearing the
 * keychain. This is the part that has to happen in the app: forget who was
 * signed in, drop every cached answer that was fetched as them, and send them
 * to sign in rather than leaving them on a screen full of error states.
 *
 * Forgetting goes through `useSignOut` so this path and the deliberate one
 * cannot drift apart. They already had: this one cleared the query cache and
 * carried a comment about the next person seeing the previous customer's
 * order history, while the sign-out button cleared neither the cache nor the
 * saved delivery address.
 */
export function useSessionExpiry(): void {
  const { forgetLocally } = useSignOut();

  useEffect(() => {
    /*
      One exception to "send them to sign in".

      An expiry that arrives while a payment is in flight is held by the API
      client until `submitOrder` has produced its outcome, then reported with
      `duringPayment`. By then the checkout screen is showing the sentence that
      says the card was authorised and there is no order. Replacing the route
      at that moment takes it away from the one customer who has to read it.
    */
    setSessionExpiredHandler(({ duringPayment }) => forgetLocally({ redirect: !duringPayment }));
    return () => setSessionExpiredHandler(null);
  }, [forgetLocally]);
}
