import { z } from 'zod';
import { localizedText, type LocalizedText } from './i18n';

/**
 * The update state every data-driven screen must show.
 *
 * current      fresh from the provider
 * delayed      the provider is answering but behind
 * stale        last known copy, older than the screen can vouch for
 * unavailable  the provider is down or not yet contracted; nothing to show
 * offline      the device has no connection; a labelled cache is shown
 */
export const freshness = z.enum(['current', 'delayed', 'stale', 'unavailable', 'offline']);
export type Freshness = z.infer<typeof freshness>;

export const sourceMeta = z.object({
  status: freshness,
  /** When the provider last confirmed this data, ISO 8601 UTC. Null when never. */
  updatedAt: z.string().nullable(),
  /** Plain name of the system of record, shown to supporters. */
  source: z.string(),
  /** True for seeded demo data. A demo flag is always rendered. */
  demo: z.boolean(),
  notice: localizedText.optional(),
});
export type SourceMeta = z.infer<typeof sourceMeta>;

export interface Sourced<T> {
  data: T | null;
  meta: SourceMeta;
}

export const sourced = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema.nullable(), meta: sourceMeta });

export function withSource<T>(data: T, meta: SourceMeta): Sourced<T> {
  return { data, meta };
}

export function unavailable<T>(source: string, demo: boolean, notice?: LocalizedText): Sourced<T> {
  return { data: null, meta: { status: 'unavailable', updatedAt: null, source, demo, notice } };
}

export interface FreshnessThresholds {
  delayedAfterMs: number;
  staleAfterMs: number;
}

/** Live match data goes stale in minutes; a fixture list in hours. */
export const LIVE_THRESHOLDS: FreshnessThresholds = {
  delayedAfterMs: 90_000,
  staleAfterMs: 300_000,
};
export const REFERENCE_THRESHOLDS: FreshnessThresholds = {
  delayedAfterMs: 6 * 3_600_000,
  staleAfterMs: 24 * 3_600_000,
};

export function freshnessByAge(
  updatedAt: string | null,
  now: Date,
  thresholds: FreshnessThresholds,
): Freshness {
  if (!updatedAt) return 'unavailable';
  const age = now.getTime() - new Date(updatedAt).getTime();
  if (age >= thresholds.staleAfterMs) return 'stale';
  if (age >= thresholds.delayedAfterMs) return 'delayed';
  return 'current';
}

/** Actions that must not run on data the app cannot vouch for. */
export function canTransact(meta: SourceMeta): boolean {
  return meta.status === 'current' || meta.status === 'delayed';
}
