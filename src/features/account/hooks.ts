import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import { useIsSignedOut } from '@/features/system/AccountRequired';
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

export function useNotifications() {
  const signedOut = useIsSignedOut();
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: fetchNotifications,
    enabled: !signedOut,
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
