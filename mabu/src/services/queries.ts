import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
  type QueryKey,
} from '@tanstack/react-query';
import type { RpcArgs, RpcName, RpcResult } from '@/domain/rpc';
import { useSession } from '@/store/session';
import { rpc } from './api';

/**
 * Query keys are the RPC name plus its args, and include the signed-in id so
 * one guest's cached bookings can never be shown to the next person to sign
 * in on the same phone.
 */
export function useRpc<K extends RpcName>(
  name: K,
  args?: RpcArgs<K>,
  options: {
    enabled?: boolean;
    refetchInterval?: number | false | ((query: Query<RpcResult<K>>) => number | false);
  } = {},
) {
  const who = useSession((s) => s.actor?.id ?? 'anon');
  return useQuery<RpcResult<K>>({
    queryKey: [name, who, args ?? null] as QueryKey,
    queryFn: () => (rpc as (n: K, a?: RpcArgs<K>) => Promise<RpcResult<K>>)(name, args),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval as never,
  });
}

/** A mutation that refreshes the named queries when it succeeds. */
export function useRpcMutation<K extends RpcName>(name: K, invalidates: RpcName[] = []) {
  const client = useQueryClient();
  return useMutation<RpcResult<K>, Error, RpcArgs<K>>({
    mutationFn: (args) => (rpc as (n: K, a: RpcArgs<K>) => Promise<RpcResult<K>>)(name, args),
    onSuccess: async () => {
      await Promise.all(invalidates.map((n) => client.invalidateQueries({ queryKey: [n] })));
    },
  });
}

/** Everything that depends on account state, for after sign-in, sign-out and bookings. */
export const ACCOUNT_QUERIES: RpcName[] = [
  'me.get',
  'booking.mine',
  'booking.get',
  'events.mine',
  'vouchers.mine',
  'rewards.wallet',
  'favourites.list',
  'notifications.inbox',
  'notifications.prefs',
  'waitlist.mine',
];
