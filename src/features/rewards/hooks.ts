import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import { useIsSignedOut } from '@/features/system/AccountRequired';
import { useAuthStore } from '@/store/authStore';
import { birthdayMonthOf } from '@/features/rewards/birthday';
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
import { seedOrderLedger } from '@/services/orderService';
import { config } from '@/constants/config';

export function useLoyaltyAccount() {
  const signedOut = useIsSignedOut();
  return useQuery({
    queryKey: queryKeys.loyalty,
    /*
      The orders first, in mock mode.

      Two rows of the points history describe orders and are written from them,
      so the order ledger has to exist before the loyalty ledger is read.
      Opening Rewards without having opened Orders showed a history missing the
      two entries that account for most of the balance — seen in the browser.

      Composed here rather than inside `rewardsService`, which cannot import
      `orderService` without a cycle. A real backend serves one ledger and this
      does nothing.
    */
    queryFn: async () => {
      if (config.useMockApi) seedOrderLedger();
      return fetchLoyaltyAccount();
    },
    staleTime: 60 * 1000,
    enabled: !signedOut,
  });
}

/**
 * The signed-in customer's date of birth, which the birthday reward turns on.
 *
 * Read here rather than in the service: `rewardsService` has no business
 * reaching into a Zustand store, and against a real API the token identifies
 * the customer anyway. The hooks are the seam where client state meets a
 * query, so this is where it belongs.
 */
function useDateOfBirth(): string | undefined {
  return useAuthStore((state) => state.user?.dateOfBirth);
}

export function useRewards() {
  const signedOut = useIsSignedOut();
  const dateOfBirth = useDateOfBirth();

  return useQuery({
    queryKey: queryKeys.rewards(birthdayMonthOf(dateOfBirth)),
    queryFn: () => fetchRewards(dateOfBirth),
    staleTime: 60 * 1000,
    enabled: !signedOut,
  });
}

export function useReward(rewardId: string | undefined) {
  const dateOfBirth = useDateOfBirth();

  return useQuery({
    queryKey: queryKeys.reward(rewardId ?? '', birthdayMonthOf(dateOfBirth)),
    queryFn: () => fetchReward(rewardId as string, dateOfBirth),
    enabled: Boolean(rewardId),
  });
}

export function useTiers() {
  return useQuery({ queryKey: queryKeys.tiers, queryFn: fetchTiers, staleTime: 10 * 60 * 1000 });
}

export function useVouchers() {
  const signedOut = useIsSignedOut();
  return useQuery({
    queryKey: queryKeys.vouchers,
    queryFn: fetchVouchers,
    staleTime: 60 * 1000,
    enabled: !signedOut,
  });
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
  const dateOfBirth = useDateOfBirth();

  return useMutation({
    mutationFn: (rewardId: string) => redeemReward(rewardId, dateOfBirth),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.loyalty });
      // Prefix-matched, so every birthday-month variant of the list is dropped.
      void queryClient.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
  });
}
