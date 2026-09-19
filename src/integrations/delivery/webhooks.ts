/**
 * Webhook normalisation and duplicate rejection — extension §6.
 *
 * Two jobs, and they are separate on purpose.
 *
 * **Normalise.** Each provider names its own events. Nothing above this file
 * should ever see one of those names: order history, the tracking card, push
 * copy and analytics all read `CanonicalOrderStatus`, so a second provider
 * signing a contract changes one mapping table and no screens.
 *
 * **Deduplicate.** Providers retry webhooks. That is correct behaviour on
 * their side — a delivery they are unsure of is a delivery they resend — and
 * it means the same event arrives two or five times. Extension §1 lists
 * "webhook duplication" among the failures that must be handled gracefully,
 * §6 says to "persist eventId and reject duplicate events", and §11 makes
 * duplicate webhooks a required test. Without it, a re-sent `delivered`
 * event fires a second "your order has arrived" push at midnight.
 *
 * The brief's §6 sketch returns a hard-coded `status: "submitted"` with the
 * mapping marked as belonging here. This is that mapping, written out.
 *
 * On trust: a webhook body is data from outside. The status is taken only
 * from a closed mapping table — an unrecognised provider event yields null
 * and is logged, never coerced into a state — and the ETA and tracking URL
 * are passed through only when present and well-formed. Nothing in a payload
 * can introduce a state the machine does not already have.
 */

import type {
  CanonicalOrderStatus,
  NormalizedOrderEvent,
  ProviderId,
  ProviderWebhook,
} from './types';

/**
 * Provider event name → canonical status.
 *
 * Only Pappas Direct's own vocabulary is filled in, because it is the only
 * one whose event names are known. The external tables are deliberately
 * empty: extension §10.12 — "If official provider API contracts or
 * credentials are unavailable, DO NOT invent them." An empty table is not an
 * oversight, it is the accurate statement that nobody has yet told us what
 * Uber Eats calls the moment a courier collects an order.
 *
 * The consequence is designed for rather than papered over: an unmapped
 * event returns null from `mapProviderStatus`, `normalizeOrderEvent` reports
 * it as unmapped, and the order's state is left alone. A missing mapping
 * shows up as a metric, not as a wrong status in front of a customer.
 */
const STATUS_MAP: Record<ProviderId, Readonly<Record<string, CanonicalOrderStatus>>> = {
  'pappas-direct': {
    'order.submitted': 'submitted',
    'order.accepted': 'accepted',
    'order.preparing': 'preparing',
    'order.ready': 'ready',
    'order.collected': 'delivered',
    'order.delivered': 'delivered',
    'order.cancelled': 'cancelled',
    'order.failed': 'failed',
  },
  // Awaiting the Uber Eats merchant integration contract. See
  // docs/DELIVERY_INTEGRATION.md — "Outstanding blockers".
  'uber-eats': {},
  // Awaiting the Mr D partner API contract. Same document.
  'mr-d': {},
};

/**
 * Translate a provider event name into a canonical status.
 *
 * Returns null when the provider is unknown to us or the event is one we
 * have no mapping for. Null is a legitimate answer and callers must handle
 * it; the alternative — defaulting to some status — is how an order silently
 * moves to "submitted" because a provider sent a receipt-emailed event.
 */
export function mapProviderStatus(
  provider: ProviderId,
  eventType: string,
): CanonicalOrderStatus | null {
  return STATUS_MAP[provider]?.[eventType] ?? null;
}

export type NormalizeResult =
  | { ok: true; event: NormalizedOrderEvent }
  | { ok: false; kind: 'duplicate'; eventId: string }
  | { ok: false; kind: 'unmapped'; eventId: string; providerEventType: string }
  | { ok: false; kind: 'malformed'; detail: string };

/**
 * Remembers which events have already been handled.
 *
 * In the app this is a bounded in-memory set — the client processes webhook
 * relays only while it is in the foreground, and an unbounded set in a
 * long-lived session is a leak. The authoritative ledger is the server's:
 * extension §6 says to persist `eventId`, and a device that was asleep never
 * saw the first delivery, so client-side memory alone cannot be the guard.
 * This is the second line, not the only one.
 */
export class SeenEventLedger {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly limit = 500) {}

  /** True if this is the first time we have seen the id. */
  admit(eventId: string): boolean {
    if (this.seen.has(eventId)) return false;
    this.seen.add(eventId);
    this.order.push(eventId);
    if (this.order.length > this.limit) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.seen.delete(evicted);
    }
    return true;
  }

  has(eventId: string): boolean {
    return this.seen.has(eventId);
  }

  clear(): void {
    this.seen.clear();
    this.order.length = 0;
  }
}

/** The process-wide ledger. Injectable in tests via the parameter below. */
export const defaultLedger = new SeenEventLedger();

/**
 * Brief §6's `normalizeOrderEvent`, with the mapping and the duplicate
 * rejection the sketch leaves as comments.
 */
export function normalizeOrderEvent(
  event: ProviderWebhook,
  ledger: SeenEventLedger = defaultLedger,
): NormalizeResult {
  if (!event.eventId || !event.externalOrderId) {
    return { ok: false, kind: 'malformed', detail: 'Missing eventId or externalOrderId' };
  }
  if (!Number.isFinite(Date.parse(event.occurredAt))) {
    return { ok: false, kind: 'malformed', detail: `Unparseable occurredAt: ${event.occurredAt}` };
  }

  // Deduplicate before mapping. An event we have already applied should not
  // even be considered, and checking first means a duplicate of an unmapped
  // event is reported as a duplicate rather than as a second mapping gap.
  if (!ledger.admit(event.eventId)) {
    return { ok: false, kind: 'duplicate', eventId: event.eventId };
  }

  const status = mapProviderStatus(event.provider, event.type);
  if (!status) {
    return {
      ok: false,
      kind: 'unmapped',
      eventId: event.eventId,
      providerEventType: event.type,
    };
  }

  return {
    ok: true,
    event: {
      provider: event.provider,
      externalOrderId: event.externalOrderId,
      eventId: event.eventId,
      status,
      occurredAt: event.occurredAt,
      providerEventType: event.type,
      // Only forwarded when the provider actually supplied them. Extension
      // §11: "Tracking displays real provider data only when supplied."
      ...readEta(event.payload),
      ...readTrackingUrl(event.payload),
    },
  };
}

/** Pull an ETA out of a payload, if it is there and sane. */
function readEta(payload: unknown): { etaMinutes?: number } {
  if (typeof payload !== 'object' || payload === null) return {};
  const value = (payload as Record<string, unknown>).etaMinutes;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return {};
  // A four-hour ETA from a restaurant is a provider bug, not a wait. Cap the
  // credible range rather than render an absurd promise.
  if (value > 240) return {};
  return { etaMinutes: Math.round(value) };
}

/**
 * Pull a tracking URL out of a payload, if it is there and safe to open.
 *
 * Only https. A webhook is untrusted input and this value ends up in
 * `Linking.openURL`, where a `javascript:` or custom-scheme URL is an open
 * redirect into whatever else is installed on the phone.
 */
function readTrackingUrl(payload: unknown): { trackingUrl?: string } {
  if (typeof payload !== 'object' || payload === null) return {};
  const value = (payload as Record<string, unknown>).trackingUrl;
  if (typeof value !== 'string') return {};
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return {};
    return { trackingUrl: value };
  } catch {
    return {};
  }
}
