import { Platform } from 'react-native';
import type { AnalyticsProps, MabuEvent } from '@/domain/analytics';
import { rpc } from '@/services/api';
import { config } from '@/services/config';
import { trackOnMock } from '@/services/mockServer';

/**
 * Client-side analytics. Fire-and-forget by construction: nothing awaits it
 * and nothing it does can throw into a guest's journey (§48).
 *
 * In mock mode events land in the in-process back end. Against a live server
 * they are batched and posted to `analytics.collect`, which keeps them in the
 * database the restaurant's conversion tiles read. Only ids and counts travel
 * — the property list has no field for a name, an email or a phone number.
 */

const FLUSH_AFTER_MS = 10_000;
const FLUSH_AT = 20;
const MAX_QUEUE = 200;

type Queued = { event: MabuEvent; props?: AnalyticsProps; at: string };

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

/** Sends what is queued and forgets it. A failed batch is dropped, never retried into a loop. */
export function flushAnalytics(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue;
  queue = [];
  try {
    void rpc('analytics.collect', { events, platform }).catch(() => undefined);
  } catch {
    // never propagate
  }
}

export function track(event: MabuEvent, props?: AnalyticsProps): void {
  try {
    if (config.useMockApi) {
      void trackOnMock(event, props).catch(() => undefined);
      return;
    }
    if (queue.length >= MAX_QUEUE) return;
    queue.push({ event, props, at: new Date().toISOString() });
    if (queue.length >= FLUSH_AT) flushAnalytics();
    else if (!timer) timer = setTimeout(flushAnalytics, FLUSH_AFTER_MS);
  } catch {
    // never propagate
  }
}
