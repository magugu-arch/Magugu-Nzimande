import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { setSessionExpiredHandler } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * What the app does when the API client gives up on the session.
 *
 * The client handles the mechanics — one refresh attempt, then clearing the
 * keychain. This is the part that has to happen in the app: forget who was
 * signed in, drop every cached answer that was fetched as them, and send them
 * to sign in rather than leaving them on a screen full of error states.
 *
 * Clearing the cache matters as much as the routing. Without it the next
 * person to sign in on this device sees the previous customer's order history
 * for as long as those queries stay fresh.
 */
export function useSessionExpiry(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOutLocally = useAuthStore((state) => state.signOutLocally);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      signOutLocally();
      queryClient.clear();
      router.replace('/(auth)/sign-in');
    });

    return () => setSessionExpiredHandler(null);
  }, [router, queryClient, signOutLocally]);
}
