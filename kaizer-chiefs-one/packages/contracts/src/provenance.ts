import { z } from 'zod';

export const isoDateTime = z.iso.datetime({ offset: true });

/**
 * Where a value on screen came from. The interface must let a supporter tell
 * these apart wherever they could otherwise mistake one for another.
 *
 * - live:        fresh from an authorised provider
 * - cached:      from an authorised provider, held locally, within its max age
 * - stale:       from an authorised provider, older than its max age
 * - demo:        sample content from a demo adapter; never club data
 * - unavailable: no provider connected or reachable
 */
export const DATA_STATES = ['live', 'cached', 'stale', 'demo', 'unavailable'] as const;
export const dataStateSchema = z.enum(DATA_STATES);
export type DataState = z.infer<typeof dataStateSchema>;

export const provenanceSchema = z.object({
  /** Stable provider identifier, e.g. "demo", "club-cms", "match-feed". */
  source: z.string().min(1),
  /** The provider's own id for the record, if any. */
  providerRef: z.string().nullable(),
  /** When this app fetched it. */
  fetchedAt: isoDateTime,
  /** When the provider says it last changed. */
  updatedAt: isoDateTime.nullable(),
  state: dataStateSchema,
});
export type Provenance = z.infer<typeof provenanceSchema>;

export const DEMO_SOURCE = 'demo';

export function isDemo(p: Pick<Provenance, 'state'>): boolean {
  return p.state === 'demo';
}

/**
 * Downgrade live/cached data to stale once it is older than `maxAgeMs`.
 * Demo and unavailable states are returned unchanged.
 */
export function effectiveState(p: Provenance, now: Date, maxAgeMs: number): DataState {
  if (p.state !== 'live' && p.state !== 'cached') return p.state;
  const age = now.getTime() - new Date(p.fetchedAt).getTime();
  return age > maxAgeMs ? 'stale' : p.state;
}

/** Maximum ages before data is shown with a stale indicator. */
export const MAX_AGE_MS = {
  liveMatch: 60_000,
  fixtures: 6 * 60 * 60_000,
  squad: 24 * 60 * 60_000,
  content: 6 * 60 * 60_000,
  membership: 24 * 60 * 60_000,
  tickets: 10 * 60_000,
  rewards: 10 * 60_000,
} as const;
