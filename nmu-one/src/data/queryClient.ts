import { QueryClient } from '@tanstack/react-query';
import { isAdapterError } from '@/core/adapters/errors';

/**
 * Query defaults for a campus app on metered data:
 *   - retry once, and only errors that a retry can fix (`unavailable`) —
 *     offline, forbidden and not-configured fail straight to their state;
 *   - keep data warm across screens; no refetch on every focus;
 *   - `networkMode: 'always'` so a request made offline reaches the adapter
 *     and fails *as offline*, which is what lets a screen show its cached copy.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => isAdapterError(error) && error.kind === 'unavailable' && count < 1,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
    mutations: { retry: 0, networkMode: 'always' },
  },
});
