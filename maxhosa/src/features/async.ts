import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'ready'; data: T; error?: undefined };

type Settled<T> = { key: string; state: Exclude<AsyncState<T>, { status: 'loading' }> };

/**
 * Load something from a provider with explicit loading, error and ready
 * states, and a retry. While a newer request is in flight the previous data
 * stays on screen (stale-while-revalidate); a result for a superseded request
 * is dropped. `deps` must be primitives.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: (string | number | boolean | null | undefined)[],
) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const key = JSON.stringify([...deps, attempt]);

  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setSettled({ key, state: { status: 'ready', data } }),
      (error: unknown) =>
        live &&
        setSettled({
          key,
          state: {
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          },
        }),
    );
    return () => {
      live = false;
    };
    // `key` captures deps and attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  let state: AsyncState<T> = { status: 'loading' };
  if (settled && (settled.key === key || settled.state.status === 'ready')) state = settled.state;
  return { ...state, retry };
}
