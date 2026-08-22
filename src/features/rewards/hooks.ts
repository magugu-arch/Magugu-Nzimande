import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import {
  fetchLoyaltyAccount,
  fetchPromotion,
  fetchPromotions,
  fetchReward,
  fetchRewards,
  fetchTiers,
  fetchVouchers,
  redeemReward,
  validateVoucherCode,
} from '@/services/rewardsService';

export function useLoyaltyAccount() {
  return useQuery({
    queryKey: queryKeys.loyalty,
    queryFn: fetchLoyaltyAccount,
    staleTime: 60 * 1000,
  });
}

export function useRewards() {
  return useQuery({ queryKey: queryKeys.rewards, queryFn: fetchRewards, staleTime: 60 * 1000 });
}

export function useReward(rewardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reward(rewardId ?? ''),
    queryFn: () => fetchReward(rewardId as string),
    enabled: Boolean(rewardId),
  });
}

export function useTiers() {
  return useQuery({ queryKey: queryKeys.tiers, queryFn: fetchTiers, staleTime: 10 * 60 * 1000 });
}

export function useVouchers() {
  return useQuery({ queryKey: queryKeys.vouchers, queryFn: fetchVouchers, staleTime: 60 * 1000 });
}

export function usePromotions() {
  return useQuery({
    queryKey: queryKeys.promotions,
    queryFn: fetchPromotions,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePromotion(promotionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.promotion(promotionId ?? ''),
    queryFn: () => fetchPromotion(promotionId as string),
    enabled: Boolean(promotionId),
  });
}

export function useValidateVoucher() {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) =>
      validateVoucherCode(code, subtotal),
  });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: string) => redeemReward(rewardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.loyalty });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards });
    },
  });
}
