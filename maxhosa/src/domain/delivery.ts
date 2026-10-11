import { z } from 'zod';
import {
  STAGES,
  type DeliveryExceptionKind,
  type DeliveryStage,
  type DeliveryTracking,
  type TrackingEvent,
} from './types';

/**
 * Delivery tracking rules, kept pure so they can be tested without a screen.
 *
 * The rule throughout: show what a provider has confirmed, attribute every
 * estimate, and say plainly when something is unknown. Nothing here invents
 * an ETA, a position or a delivery.
 */

/* ------------------------------------------------- carrier normalisation */

/**
 * A raw carrier event as a webhook or tracking API might deliver it. Treated
 * as untrusted input and validated before anything reads it.
 */
export const RawCarrierEventSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1).max(32),
  occurredAt: z.iso.datetime({ offset: true }),
  location: z.string().max(120).optional(),
});
export type RawCarrierEvent = z.infer<typeof RawCarrierEventSchema>;

/**
 * Reviewed mapping from carrier codes to the normalised model. A code that is
 * not in this table becomes `unknown` — never a stage, and never delivered —
 * until someone reviews it and adds it here.
 */
const CARRIER_CODES: Record<
  string,
  { stage?: DeliveryStage; exception?: DeliveryExceptionKind; text: string }
> = {
  PU: { stage: 'handed_to_carrier', text: 'The courier has collected your parcel.' },
  IT: { stage: 'in_transit', text: 'In transit through the courier’s network.' },
  OFD: { stage: 'out_for_delivery', text: 'On the delivery route today.' },
  DL: { stage: 'delivered', text: 'Delivered.' },
  DE: { exception: 'delayed', text: 'The courier has reported a delay.' },
  AD: { exception: 'address_issue', text: 'The courier could not match the delivery address.' },
  NA: { exception: 'delivery_attempted', text: 'Delivery attempted — nobody was available.' },
  CH: { exception: 'customs_hold', text: 'Waiting for customs clearance.' },
  RT: { exception: 'returned_to_sender', text: 'Being returned to MAXHOSA AFRICA.' },
};

export function normaliseCarrierEvent(input: unknown): TrackingEvent | null {
  const parsed = RawCarrierEventSchema.safeParse(input);
  if (!parsed.success) return null;
  const raw = parsed.data;
  const known = CARRIER_CODES[raw.code.toUpperCase()];
  return {
    id: raw.id,
    stage: known?.stage ?? null,
    exception: known ? known.exception : 'unknown',
    source: 'carrier',
    at: new Date(raw.occurredAt).toISOString(),
    description: known?.text ?? 'An update from the courier that has not been reviewed yet.',
    location: raw.location,
  };
}

/** Events are applied once each, in time order, however often a webhook retries. */
export function mergeEvents(existing: TrackingEvent[], incoming: TrackingEvent[]): TrackingEvent[] {
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const e of incoming) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/* ------------------------------------------------------- what to show */

export function stageIndex(t: Pick<DeliveryTracking, 'events'>): number {
  let max = -1;
  for (const e of t.events) {
    if (e.stage) max = Math.max(max, STAGES.indexOf(e.stage));
  }
  return max;
}

/** The open exception, if the latest event raised one that no later stage has cleared. */
export function openException(
  t: Pick<DeliveryTracking, 'events' | 'exception'>,
): DeliveryExceptionKind | undefined {
  if (t.exception) return t.exception;
  const last = t.events[t.events.length - 1];
  return last?.exception;
}

export const STALE_AFTER_MS = 10 * 60 * 1000;

export type TrackingView = {
  stage: number;
  title: string;
  /** Always attributed ("Estimate from courier: …") or an honest absence. */
  estimate: { text: string; attributed: boolean };
  exception?: DeliveryExceptionKind;
  unreviewedUpdate: boolean;
  map: { show: false; note: string } | { show: true; stale: boolean };
  trackingReference: string;
  updatedAt: string;
};

export const STAGE_LABEL: Record<DeliveryStage, string> = {
  order_confirmed: 'Order confirmed',
  preparing: 'Preparing',
  packed: 'Packed',
  handed_to_carrier: 'With the courier',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

export const EXCEPTION_LABEL: Record<DeliveryExceptionKind, string> = {
  awaiting_carrier_scan: 'Waiting for the courier’s first scan',
  delayed: 'Delayed',
  address_issue: 'Address needs checking',
  delivery_attempted: 'Delivery attempted',
  customs_hold: 'Held at customs',
  returned_to_sender: 'Returning to MAXHOSA',
  cancelled: 'Cancelled',
  unknown: 'Update from the courier',
};

export function trackingView(
  t: DeliveryTracking,
  formatTime: (iso: string) => string,
  now: number = Date.now(),
): TrackingView {
  const stage = stageIndex(t);
  const exception = openException(t);
  // An unreviewed code is not a status: report it, keep the last confirmed stage.
  const unreviewedUpdate = exception === 'unknown';
  const blocking = exception && exception !== 'unknown' ? exception : undefined;
  const confirmedStage = stage >= 0 ? STAGES[stage] : undefined;

  const title = blocking
    ? EXCEPTION_LABEL[blocking]
    : confirmedStage
      ? STAGE_LABEL[confirmedStage]
      : 'Order received';

  const withCarrier = stage >= STAGES.indexOf('handed_to_carrier');
  let estimate: TrackingView['estimate'];
  if (stage === STAGES.indexOf('delivered')) {
    const at = t.events.filter((e) => e.stage === 'delivered').pop()?.at;
    estimate = { text: at ? `Delivered ${formatTime(at)}` : 'Delivered', attributed: true };
  } else if (blocking) {
    estimate = {
      text: 'Delivery estimate not available while this is resolved',
      attributed: false,
    };
  } else if (withCarrier && t.estimate) {
    const who = t.estimate.source === 'courier' ? 'courier' : 'carrier';
    estimate = {
      text: `Estimate from ${who}: ${formatTime(t.estimate.from)}–${formatTime(t.estimate.to)}`,
      attributed: true,
    };
  } else {
    estimate = { text: 'Delivery estimate not yet available', attributed: false };
  }

  let map: TrackingView['map'];
  const outForDelivery = stage === STAGES.indexOf('out_for_delivery');
  if (t.mode === 'local' && outForDelivery && t.courier && !blocking) {
    map = { show: true, stale: now - Date.parse(t.courier.updatedAt) > STALE_AFTER_MS };
  } else if (t.mode === 'local' && outForDelivery && blocking) {
    map = { show: false, note: 'Live location is hidden while this is sorted out.' };
  } else {
    map = { show: false, note: 'Location tracking isn’t available for this shipment.' };
  }

  const lastEvent = t.events[t.events.length - 1];
  return {
    stage,
    title,
    estimate,
    exception: blocking,
    unreviewedUpdate,
    map,
    trackingReference:
      withCarrier && t.trackingReference ? t.trackingReference : 'Not assigned yet',
    updatedAt: t.courier && map.show ? t.courier.updatedAt : (lastEvent?.at ?? t.lastCheckedAt),
  };
}

/** Delivery changes close once the courier is on the way. */
export function canChangeDelivery(t: DeliveryTracking): boolean {
  return stageIndex(t) < STAGES.indexOf('out_for_delivery');
}
