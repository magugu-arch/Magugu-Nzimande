import {
  mergeEvents,
  normaliseCarrierEvent,
  stageIndex,
  canChangeDelivery,
} from '@/domain/delivery';
import {
  STAGES,
  type DeliveryExceptionKind,
  type DeliveryMode,
  type DeliveryPreference,
  type DeliveryStage,
  type DeliveryTracking,
  type TrackingEvent,
} from '@/domain/types';
import type { DeliveryProvider, DemoDeliveryControls } from './DeliveryProvider';

/**
 * A simulated courier, for demos only. Carrier events go through the same
 * normaliser real webhooks would, so the pipeline is exercised end to end;
 * merchant fulfilment events are created directly, as the commerce platform
 * would report them. Positions are a fixed route on an illustration, never
 * coordinates, and every screen that shows one labels it "demo location".
 */

const CARRIER = 'Sample Courier (demo)';
const TRACKING_REF = 'SAMPLE-TRK-0001';

const MERCHANT_TEXT: Partial<Record<DeliveryStage, string>> = {
  order_confirmed: 'MAXHOSA AFRICA has your order.',
  preparing: 'Your pieces are being picked and quality-checked.',
  packed:
    'Packed and labelled. Waiting for the courier to collect — the courier does not have it yet.',
};

const CARRIER_CODE: Partial<Record<DeliveryStage, string>> = {
  handed_to_carrier: 'PU',
  in_transit: 'IT',
  out_for_delivery: 'OFD',
  delivered: 'DL',
};

const EXCEPTION_CODE: Partial<Record<DeliveryExceptionKind, string>> = {
  delayed: 'DE',
  address_issue: 'AD',
  delivery_attempted: 'NA',
  customs_hold: 'CH',
  returned_to_sender: 'RT',
};

/** The courier's route across the illustration, in 0–1 map space. */
export const DEMO_ROUTE = [
  { x: 0.12, y: 0.8 },
  { x: 0.22, y: 0.66 },
  { x: 0.3, y: 0.52 },
  { x: 0.42, y: 0.5 },
  { x: 0.52, y: 0.42 },
  { x: 0.62, y: 0.36 },
  { x: 0.7, y: 0.3 },
];

type Sim = { tracking: DeliveryTracking; seq: number; routeStep: number; stale: boolean };

export class MockDeliveryProvider implements DeliveryProvider, DemoDeliveryControls {
  readonly id = 'mock';
  readonly isMock = true;
  private sims = new Map<string, Sim>();
  private listeners = new Map<string, Set<(t: DeliveryTracking) => void>>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(private readonly ackDelayMs = 900) {}

  /** Start tracking a newly placed order at "order confirmed", or the sample one further along. */
  private sim(orderId: string): Sim {
    let s = this.sims.get(orderId);
    if (!s) {
      const created = Date.now() - (orderId.endsWith('0001') ? 2.5 * 3600_000 : 0);
      s = {
        tracking: {
          orderId,
          mode: 'parcel',
          carrier: CARRIER,
          serviceLevel: 'Standard parcel',
          events: [],
          lastCheckedAt: new Date(created).toISOString(),
        },
        seq: 0,
        routeStep: 0,
        stale: false,
      };
      this.sims.set(orderId, s);
      const startAt = orderId.endsWith('0001') ? 2 : 0;
      for (let i = 0; i <= startAt; i++)
        this.push(s, STAGES[i]!, new Date(created + i * 47 * 60_000));
    }
    return s;
  }

  private push(s: Sim, stage: DeliveryStage, at = new Date()) {
    s.seq += 1;
    const id = `${s.tracking.orderId}-${s.seq}`;
    let event: TrackingEvent | null;
    const code = CARRIER_CODE[stage];
    if (code) {
      event = normaliseCarrierEvent({
        id,
        code,
        occurredAt: at.toISOString(),
        location: 'Sample hub',
      });
      s.tracking.trackingReference = TRACKING_REF;
    } else {
      event = {
        id,
        stage,
        source: 'merchant',
        at: at.toISOString(),
        description: MERCHANT_TEXT[stage] ?? '',
      };
    }
    if (event) s.tracking.events = mergeEvents(s.tracking.events, [event]);
    s.tracking.exception = undefined;
    this.refreshEstimate(s);
  }

  private refreshEstimate(s: Sim) {
    const t = s.tracking;
    const stage = stageIndex(t);
    const now = Date.now();
    t.lastCheckedAt = new Date(now).toISOString();
    t.courier = undefined;
    if (stage < STAGES.indexOf('handed_to_carrier') || stage === STAGES.indexOf('delivered')) {
      t.estimate = undefined;
    } else if (t.mode === 'local' && stage === STAGES.indexOf('out_for_delivery')) {
      t.estimate = {
        from: new Date(now + 18 * 60_000).toISOString(),
        to: new Date(now + 42 * 60_000).toISOString(),
        source: 'courier',
        updatedAt: t.lastCheckedAt,
      };
      const p = DEMO_ROUTE[s.routeStep]!;
      const age = s.stale ? 18 * 60_000 : 0;
      t.courier = { x: p.x, y: p.y, updatedAt: new Date(now - age).toISOString() };
    } else {
      const day = new Date(
        now + (stage === STAGES.indexOf('out_for_delivery') ? 0 : 2 * 86_400_000),
      );
      const from = new Date(day);
      from.setHours(9, 0, 0, 0);
      const to = new Date(day);
      to.setHours(17, 0, 0, 0);
      t.estimate = {
        from: from.toISOString(),
        to: to.toISOString(),
        source: 'carrier',
        updatedAt: t.lastCheckedAt,
      };
    }
    this.syncTimer(s);
  }

  /** In same-day mode a new position arrives every few seconds, as a courier feed would. */
  private syncTimer(s: Sim) {
    const id = s.tracking.orderId;
    const live = !!s.tracking.courier && !s.stale;
    const running = this.timers.get(id);
    if (live && !running) {
      this.timers.set(
        id,
        setInterval(() => {
          s.routeStep = Math.min(DEMO_ROUTE.length - 1, s.routeStep + 1);
          const p = DEMO_ROUTE[s.routeStep]!;
          s.tracking.courier = { x: p.x, y: p.y, updatedAt: new Date().toISOString() };
          this.emit(id);
        }, 4000),
      );
    } else if (!live && running) {
      clearInterval(running);
      this.timers.delete(id);
    }
  }

  private emit(orderId: string) {
    const s = this.sims.get(orderId);
    if (!s) return;
    const snapshot = structuredCloneSafe(s.tracking);
    this.listeners.get(orderId)?.forEach((l) => l(snapshot));
  }

  /* ----------------------------------------------------- DeliveryProvider */

  async getTracking(orderId: string): Promise<DeliveryTracking | null> {
    return structuredCloneSafe(this.sim(orderId).tracking);
  }

  subscribe(orderId: string, listener: (t: DeliveryTracking) => void): () => void {
    this.sim(orderId);
    const set = this.listeners.get(orderId) ?? new Set();
    set.add(listener);
    this.listeners.set(orderId, set);
    return () => {
      set.delete(listener);
      if (!set.size) {
        const timer = this.timers.get(orderId);
        if (timer) clearInterval(timer);
        this.timers.delete(orderId);
      }
    };
  }

  async requestPreference(
    orderId: string,
    preference: Omit<DeliveryPreference, 'acknowledgedAt'>,
  ): Promise<DeliveryPreference> {
    const s = this.sim(orderId);
    await new Promise((r) => setTimeout(r, this.ackDelayMs));
    if (!canChangeDelivery(s.tracking)) {
      throw new Error('The courier is already on the way, so delivery changes are closed.');
    }
    const acknowledged = { ...preference, acknowledgedAt: new Date().toISOString() };
    s.tracking.preference = acknowledged;
    this.emit(orderId);
    return acknowledged;
  }

  /* -------------------------------------------------- DemoDeliveryControls */

  advance(orderId: string) {
    const s = this.sim(orderId);
    const next = stageIndex(s.tracking) + 1;
    if (next >= STAGES.length) return;
    this.push(s, STAGES[next]!);
    this.emit(orderId);
  }

  setMode(orderId: string, mode: DeliveryMode) {
    const s = this.sim(orderId);
    s.tracking.mode = mode;
    s.tracking.serviceLevel = mode === 'local' ? 'Same-day courier' : 'Standard parcel';
    this.refreshEstimate(s);
    this.emit(orderId);
  }

  setException(orderId: string, exception: DeliveryExceptionKind | null) {
    const s = this.sim(orderId);
    const code = exception ? EXCEPTION_CODE[exception] : undefined;
    if (code) {
      s.seq += 1;
      const e = normaliseCarrierEvent({
        id: `${orderId}-${s.seq}`,
        code,
        occurredAt: new Date().toISOString(),
      });
      if (e) s.tracking.events = mergeEvents(s.tracking.events, [e]);
      s.tracking.exception = exception ?? undefined;
      s.tracking.estimate = undefined;
    } else {
      s.tracking.exception = undefined;
      // A later clean scan clears an exception; drop the trailing one in the demo.
      while (
        s.tracking.events.length &&
        s.tracking.events[s.tracking.events.length - 1]!.exception
      ) {
        s.tracking.events.pop();
      }
      this.refreshEstimate(s);
    }
    this.emit(orderId);
  }

  setStale(orderId: string, stale: boolean) {
    const s = this.sim(orderId);
    s.stale = stale;
    this.refreshEstimate(s);
    this.emit(orderId);
  }

  injectUnknownEvent(orderId: string) {
    const s = this.sim(orderId);
    s.seq += 1;
    const e = normaliseCarrierEvent({
      id: `${orderId}-${s.seq}`,
      code: 'XQ77',
      occurredAt: new Date().toISOString(),
    });
    if (e) s.tracking.events = mergeEvents(s.tracking.events, [e]);
    this.emit(orderId);
  }

  reset(orderId: string) {
    const timer = this.timers.get(orderId);
    if (timer) clearInterval(timer);
    this.timers.delete(orderId);
    this.sims.delete(orderId);
    this.sim(orderId);
    this.emit(orderId);
  }
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
