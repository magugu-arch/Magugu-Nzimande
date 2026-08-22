import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Order, PlaceOrderInput } from '@/types';
import { queryKeys } from '@/services/queryKeys';
import {
  cancelOrder,
  fetchActiveOrder,
  fetchOrder,
  fetchOrders,
  placeOrder,
  rateOrder,
} from '@/services/orderService';

export function useOrders() {
  return useQuery({ queryKey: queryKeys.orders, queryFn: fetchOrders, staleTime: 30 * 1000 });
}

export function useOrder(orderId: string | undefined, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ''),
    queryFn: () => fetchOrder(orderId as string),
    enabled: Boolean(orderId),
    // Live tracking polls; a completed order stops polling on its own below.
    refetchInterval: options?.poll
      ? (query) => {
          const order = query.state.data as Order | undefined;
          if (!order) return 15_000;
          return order.status === 'completed' || order.status === 'cancelled' ? false : 15_000;
        }
      : false,
  });
}

export function useActiveOrder() {
  return useQuery({
    queryKey: queryKeys.activeOrder,
    queryFn: fetchActiveOrder,
    staleTime: 20 * 1000,
    refetchInterval: 30_000,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeOrder(input),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeOrder });
      void queryClient.invalidateQueries({ queryKey: queryKeys.loyalty });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeOrder });
    },
  });
}

export function useRateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      rating,
      comment,
    }: {
      orderId: string;
      rating: number;
      comment?: string;
    }) => rateOrder(orderId, rating, comment),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}
