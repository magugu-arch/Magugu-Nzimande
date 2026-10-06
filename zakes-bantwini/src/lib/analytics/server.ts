import 'server-only';
import type { AnalyticsEvent, AnalyticsProps } from './events';

/**
 * Server-side events — the conversions that happen off the page (a payment
 * webhook, a contract signature). Sent to PostHog's capture API when
 * POSTHOG_API_KEY is set; otherwise logged. Never throws: analytics must not
 * fail a booking.
 */
export async function trackServer(event: AnalyticsEvent, distinctId: string, props: AnalyticsProps = {}): Promise<void> {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== 'test') console.info('[analytics:server]', event, props);
    return;
  }
  const host = (process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com').replace(/\/$/, '');
  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties: props }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.warn('[analytics:server] capture failed', event, error instanceof Error ? error.message : error);
  }
}
