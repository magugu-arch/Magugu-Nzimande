import { useEffect, useState } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { AdapterError, toAdapterError } from '@/core/adapters/errors';
import type { AdapterDomain } from '@/core/config';
import { offlinePolicyFor } from '@/core/offline/policy';
import { offlineCache, type CacheEntry } from './offlineCache';

/**
 * Every screen reads data through this, so every screen gets the same
 * states (brief §29): loading, success, error — and, for cacheable data,
 * "offline, showing the copy from 08:42" rather than a blank page.
 */
export interface DomainQuery<T> {
  status: 'loading' | 'success' | 'error';
  data: T | undefined;
  error: AdapterError | null;
  /** Set when `data` is the offline copy, not a fresh response. */
  fromCache: { savedAt: string } | null;
  isRefreshing: boolean;
  refetch: () => void;
}

export function useDomainQuery<T>(
  domain: AdapterDomain,
  key: QueryKey,
  fn: () => Promise<T>,
  opts: {
    enabled?: boolean;
    /** A number, or a function of the latest data — return false to stop polling. */
    refetchInterval?: number | false | ((data: T | undefined) => number | false);
  } = {},
): DomainQuery<T> {
  const policy = offlinePolicyFor(key);
  const q = useQuery<T, AdapterError>({
    queryKey: key,
    queryFn: async () => {
      try {
        const data = await fn();
        if (policy === 'cache') void offlineCache.write(key, data);
        return data;
      } catch (e) {
        throw toAdapterError(e, domain);
      }
    },
    enabled: opts.enabled ?? true,
    refetchInterval:
      typeof opts.refetchInterval === 'function'
        ? (query) =>
            (opts.refetchInterval as (d: T | undefined) => number | false)(query.state.data)
        : (opts.refetchInterval ?? false),
  });

  const offline = q.error?.kind === 'offline';
  const [cached, setCached] = useState<CacheEntry<T> | null>(null);
  const keyHash = JSON.stringify(key);

  useEffect(() => {
    if (!offline || policy !== 'cache') return;
    let live = true;
    void offlineCache.read<T>(key).then((entry) => {
      if (live) setCached(entry);
    });
    return () => {
      live = false;
    };
    // keyHash stands in for `key`, which is a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, policy, keyHash]);

  const refetch = () => void q.refetch();

  // Sensitive data is never shown once a refresh has failed offline — not
  // even this session's in-memory copy (brief §25).
  if (q.error && offline && policy === 'never') {
    return {
      status: 'error',
      data: undefined,
      error: q.error,
      fromCache: null,
      isRefreshing: q.isFetching,
      refetch,
    };
  }
  if (q.data !== undefined) {
    return {
      status: 'success',
      data: q.data,
      error: q.error,
      fromCache:
        offline && q.dataUpdatedAt ? { savedAt: new Date(q.dataUpdatedAt).toISOString() } : null,
      isRefreshing: q.isFetching,
      refetch,
    };
  }
  if (offline && cached) {
    return {
      status: 'success',
      data: cached.data,
      error: q.error,
      fromCache: { savedAt: cached.savedAt },
      isRefreshing: q.isFetching,
      refetch,
    };
  }
  if (q.error) {
    return {
      status: 'error',
      data: undefined,
      error: q.error,
      fromCache: null,
      isRefreshing: q.isFetching,
      refetch,
    };
  }
  return {
    status: 'loading',
    data: undefined,
    error: null,
    fromCache: null,
    isRefreshing: q.isFetching,
    refetch,
  };
}
