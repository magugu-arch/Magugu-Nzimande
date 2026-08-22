import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
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

export function useAddresses() {
  return useQuery({ queryKey: queryKeys.addresses, queryFn: fetchAddresses });
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
  return useQuery({ queryKey: queryKeys.paymentMethods, queryFn: fetchPaymentMethods });
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
  return useQuery({ queryKey: queryKeys.notifications, queryFn: fetchNotifications });
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
