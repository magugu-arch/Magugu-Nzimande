'use client';

import type { Gateway } from '@hao/api-gateway';
import { TOPICS, type NetworkMode } from '@hao/local-platform';
import { GatewayError, isGatewayError } from '@hao/shared-types';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getGateway } from './gateway';

/** Normalises anything thrown into a `GatewayError` so screens can rely on `safeMessage`. */
export function asGatewayError(error: unknown): GatewayError {
  return isGatewayError(error) ? error : new GatewayError('UNKNOWN');
}

/**
 * Read from a mock service through the gateway.
 *
 *   const cases = useGatewayQuery(['cases', token], (g) => g.workflow.listCases(token), { enabled: !!token });
 *
 * Start every key with the domain noun (`'cases'`, `'inbox'`, `'drafts'` …). Any
 * change in storage refreshes all queries automatically, so mutations do not
 * need to invalidate by hand.
 */
export function useGatewayQuery<T>(
  key: QueryKey,
  read: (gateway: Gateway) => Promise<T>,
  options: { enabled?: boolean } = {},
): UseQueryResult<T, GatewayError> {
  return useQuery<T, GatewayError>({
    queryKey: key,
    queryFn: async () => {
      try {
        return await read(getGateway());
      } catch (error) {
        throw asGatewayError(error);
      }
    },
    enabled: options.enabled ?? true,
  });
}

/**
 * Change something through the gateway.
 *
 *   const book = useGatewayMutation((g, input: BookInput) => g.appointments.book(input, { idempotencyKey }));
 *   book.mutate(input, { onSuccess: … });
 *
 * `error` is always a `GatewayError`; show `error.safeMessage`.
 */
export function useGatewayMutation<TInput, TResult>(
  change: (gateway: Gateway, input: TInput) => Promise<TResult>,
): UseMutationResult<TResult, GatewayError, TInput> {
  const queryClient = useQueryClient();
  return useMutation<TResult, GatewayError, TInput>({
    mutationFn: async (input) => {
      try {
        return await change(getGateway(), input);
      } catch (error) {
        throw asGatewayError(error);
      }
    },
    onSettled: () => void queryClient.invalidateQueries(),
  });
}

const subscribeToNetwork = (listener: () => void) =>
  getGateway().platform.bus.subscribe(TOPICS.storeChanged, listener);
const readNetwork = () => getGateway().platform.settings.get().network;
const serverNetwork = (): NetworkMode => 'normal';

/** The simulated network condition (Profile → Prototype controls), kept in step with storage. */
export function useNetworkMode(): [NetworkMode, (mode: NetworkMode) => void] {
  const mode = useSyncExternalStore(subscribeToNetwork, readNetwork, serverNetwork);
  return [mode, (next) => getGateway().platform.settings.set({ network: next })];
}
