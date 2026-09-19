import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import { useIsSignedOut } from '@/features/system/AccountRequired';
import { useAuthStore } from '@/store/authStore';
import { hasMarketingConsent } from '@/features/marketing/specials';
import {
  createAddress,
  deleteAddress,
  deletePaymentMethod,
  fetchAddresses,
  fetchNotifications,
  fetchPaymentMethods,
  fetchSupportTopics,
  markAllNotificationsRead,
  markNotificationRead,
  sendContactMessage,
  setDefaultAddress,
  setDefaultPaymentMethod,
  type AddressInput,
  type ContactMessage,
} from '@/services/accountService';

/**
 * Account data is not fetched for somebody who has no account.
 *
 * Not only a rendering matter: the app offers "Continue as guest" and these
 * queries fired anyway, so a guest's device made an unauthenticated request
 * for somebody's saved addresses and card records. Against a real API that is
 * a 401 per screen; against the mock — which is what a demo build runs on —
 * it came back with the seeded customer's home address and card last-fours.
 *
 * `enabled` here and `AccountRequired` on the screens are the two halves: this
 * one stops the asking, that one gives them something better than an error to
 * look at.
 */
export function useAddresses() {
  const signedOut = useIsSignedOut();
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: fetchAddresses,
    enabled: !signedOut,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => createAddress(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.addresses }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => deleteAddress(addressId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.addresses }),
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => setDefaultAddress(addressId),
    onSuccess: (addresses) => queryClient.setQueryData(queryKeys.addresses, addresses),
  });
}

export function usePaymentMethods() {
  const signedOut = useIsSignedOut();
  return useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: fetchPaymentMethods,
    enabled: !signedOut,
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (methodId: string) => deletePaymentMethod(methodId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods }),
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (methodId: string) => setDefaultPaymentMethod(methodId),
    onSuccess: (methods) => queryClient.setQueryData(queryKeys.paymentMethods, methods),
  });
}

/**
 * The inbox, with marketing withheld from anybody who said no to it.
 *
 * The consent gate has to be *here* rather than only on the surfaces that
 * show a special, and that was a real inconsistency for a while: Home ran
 * the four gates and showed nothing, while this inbox happily listed the
 * same campaigns two taps away. A customer who switches "Promotions" off
 * and then finds promotions in their notifications has been ignored, and it
 * is the kind of thing that gets an app reported rather than uninstalled.
 *
 * `select` rather than a filter in the service: the service models what the
 * endpoint returns, and a real backend would send what it has. Who is
 * allowed to see it is a client-side reading of a consent record the client
 * already holds.
 */
export function useNotifications() {
  const signedOut = useIsSignedOut();
  const preferences = useAuthStore((state) => state.preferences);
  const notificationPreferences = useAuthStore((state) => state.notificationPreferences);
  const marketingAllowed = hasMarketingConsent(preferences, notificationPreferences);

  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: fetchNotifications,
    enabled: !signedOut,
    select: (entries) =>
      marketingAllowed ? entries : entries.filter((entry) => entry.category !== 'promotion'),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: (list) => queryClient.setQueryData(queryKeys.notifications, list),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: (list) => queryClient.setQueryData(queryKeys.notifications, list),
  });
}

export function useSupportTopics() {
  return useQuery({
    queryKey: queryKeys.supportTopics,
    queryFn: fetchSupportTopics,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSendContactMessage() {
  return useMutation({ mutationFn: (input: ContactMessage) => sendContactMessage(input) });
}
