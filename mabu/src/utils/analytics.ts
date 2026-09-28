import type { AnalyticsProps, MabuEvent } from '@/domain/analytics';
import { config } from '@/services/config';
import { trackOnMock } from '@/services/mockServer';

/**
 * Client-side analytics. Fire-and-forget by construction: nothing awaits it
 * and nothing it does can throw into a guest's journey (§48).
 *
 * In mock mode events land in the in-process back end, which is what the
 * admin conversion tiles read. Against a live server, wire a sink here
 * (Segment, PostHog, Firebase …) — only ids and counts, never contact details.
 */
export function track(event: MabuEvent, props?: AnalyticsProps): void {
  try {
    if (config.useMockApi) void trackOnMock(event, props).catch(() => undefined);
  } catch {
    // never propagate
  }
}
