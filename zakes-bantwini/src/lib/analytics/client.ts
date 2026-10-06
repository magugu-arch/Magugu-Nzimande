'use client';

import type { AnalyticsEvent, AnalyticsProps } from './events';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    plausible?: (event: string, options?: { props?: AnalyticsProps }) => void;
  }
}

/**
 * Record a product event. Pushes to `dataLayer` (for a tag manager, if one is
 * installed) and to Plausible when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set.
 * Props must never contain personal data — references and categories only.
 */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...props });
  window.plausible?.(event, { props });
  if (process.env.NODE_ENV !== 'production') console.info('[analytics]', event, props);
}
