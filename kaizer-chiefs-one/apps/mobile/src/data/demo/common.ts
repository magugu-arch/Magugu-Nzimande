import { DEMO_SOURCE, type Provenance } from '@kc-one/contracts';

/** Provenance stamp for everything a demo adapter returns. */
export function demoProvenance(providerRef: string | null = null): Provenance {
  return {
    source: DEMO_SOURCE,
    providerRef,
    fetchedAt: new Date().toISOString(),
    updatedAt: null,
    state: 'demo',
  };
}

/** A short, fixed delay so loading states are exercised, not hidden. */
export function latency<T>(value: T, ms = 140): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Every demo body ends with this, so no sample copy can pass as club writing. */
export const SAMPLE_NOTE =
  'This is sample copy written to review the layout. Approved club content replaces it before release.';
