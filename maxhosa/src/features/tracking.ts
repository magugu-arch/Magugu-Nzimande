import { useEffect, useState } from 'react';
import { providers } from '@/providers';
import type { DeliveryTracking } from '@/domain/types';

/**
 * Current tracking for an order, kept fresh by provider pushes rather than
 * polling. If the provider fails, the last known state stays on screen with
 * its timestamp instead of the whole page failing.
 */
export function useTracking(orderId: string | undefined) {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!orderId) return;
    let live = true;
    providers.delivery.getTracking(orderId).then(
      (t) => live && setTracking(t),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    const unsubscribe = providers.delivery.subscribe(orderId, (t) => live && setTracking(t));
    return () => {
      live = false;
      unsubscribe();
    };
  }, [orderId]);
  return { tracking, error };
}
