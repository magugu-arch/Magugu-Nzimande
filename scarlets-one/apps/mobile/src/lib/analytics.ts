import { buildEvent, type AnalyticsEvent, type AnalyticsRecord } from '@scarlets/domain';
import { create } from 'zustand';

/**
 * Analytics in this build never leave the device: events go to an in-memory
 * log that the Demo controls screen can show. A real sink plugs in here.
 *
 * Every event passes through buildEvent, which strips personal and sensitive
 * properties. In development a dropped property is a warning, so the mistake
 * is fixed where it was made.
 */
interface AnalyticsState {
  events: (AnalyticsRecord & { at: number })[];
}

export const useAnalyticsLog = create<AnalyticsState>(() => ({ events: [] }));

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  const { record, dropped } = buildEvent(event, props);
  if (dropped.length && __DEV__) {
    console.warn(`[analytics] dropped from ${event}: ${dropped.join(', ')}`);
  }
  useAnalyticsLog.setState((state) => ({
    events: [{ ...record, at: Date.now() }, ...state.events].slice(0, 50),
  }));
}
