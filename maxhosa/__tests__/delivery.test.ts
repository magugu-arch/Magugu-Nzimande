import { mergeEvents, normaliseCarrierEvent, trackingView } from '@/domain/delivery';
import type { DeliveryTracking, TrackingEvent } from '@/domain/types';

const fmt = (iso: string) => iso.slice(11, 16);
const at = (h: number) => new Date(Date.UTC(2026, 9, 11, h)).toISOString();

function merchant(stage: TrackingEvent['stage'], h: number): TrackingEvent {
  return { id: `m-${stage}`, stage, source: 'merchant', at: at(h), description: '' };
}
function carrier(code: string, h: number, id = `c-${code}-${h}`): TrackingEvent {
  const e = normaliseCarrierEvent({ id, code, occurredAt: at(h) });
  if (!e) throw new Error('bad fixture');
  return e;
}
function tracking(
  events: TrackingEvent[],
  extra: Partial<DeliveryTracking> = {},
): DeliveryTracking {
  return {
    orderId: 'O',
    mode: 'parcel',
    carrier: 'C',
    serviceLevel: 'S',
    events,
    lastCheckedAt: at(0),
    trackingReference: 'REF',
    ...extra,
  };
}
const estimate = { from: at(9), to: at(17), source: 'carrier' as const, updatedAt: at(8) };

describe('carrier normalisation', () => {
  it('maps reviewed codes to stages and exceptions', () => {
    expect(carrier('PU', 1).stage).toBe('handed_to_carrier');
    expect(carrier('DL', 1).stage).toBe('delivered');
    expect(carrier('NA', 1).exception).toBe('delivery_attempted');
  });

  it('turns an unreviewed code into "unknown" — never a stage, never delivered', () => {
    const e = carrier('XQ77', 1);
    expect(e.stage).toBeNull();
    expect(e.exception).toBe('unknown');
  });

  it('rejects malformed input instead of guessing', () => {
    expect(normaliseCarrierEvent({ id: 'x', code: 'DL' })).toBeNull();
    expect(normaliseCarrierEvent({ id: '', code: 'DL', occurredAt: at(1) })).toBeNull();
    expect(normaliseCarrierEvent('DL')).toBeNull();
  });

  it('applies a retried webhook once, in time order', () => {
    const a = carrier('IT', 3, 'evt-1');
    const b = carrier('PU', 2, 'evt-0');
    const merged = mergeEvents([a], [b, a, a]);
    expect(merged.map((e) => e.id)).toEqual(['evt-0', 'evt-1']);
  });
});

describe('what the tracker may claim', () => {
  const packed = [merchant('order_confirmed', 1), merchant('preparing', 2), merchant('packed', 3)];

  it('shows no estimate and no tracking reference before the courier has the parcel', () => {
    const v = trackingView(tracking(packed, { estimate }), fmt);
    expect(v.title).toBe('Packed');
    expect(v.estimate).toEqual({ text: 'Delivery estimate not yet available', attributed: false });
    expect(v.trackingReference).toBe('Not assigned yet');
  });

  it('attributes the estimate once the courier has it', () => {
    const v = trackingView(tracking([...packed, carrier('PU', 4)], { estimate }), fmt);
    expect(v.estimate.text).toBe('Estimate from carrier: 09:00–17:00');
    expect(v.estimate.attributed).toBe(true);
    expect(v.trackingReference).toBe('REF');
  });

  it('withdraws the estimate during an exception and offers it as the status', () => {
    const v = trackingView(
      tracking([...packed, carrier('PU', 4), carrier('DE', 5)], { estimate }),
      fmt,
    );
    expect(v.title).toBe('Delayed');
    expect(v.exception).toBe('delayed');
    expect(v.estimate.attributed).toBe(false);
  });

  it('keeps the last confirmed stage when the courier sends an unknown code', () => {
    const v = trackingView(
      tracking([...packed, carrier('PU', 4), carrier('ZZ', 5)], { estimate }),
      fmt,
    );
    expect(v.title).toBe('With the courier');
    expect(v.unreviewedUpdate).toBe(true);
    expect(v.exception).toBeUndefined();
  });

  it('works with scan-only data: no map, and says why', () => {
    const v = trackingView(
      tracking([...packed, carrier('PU', 4), carrier('IT', 5), carrier('OFD', 6)]),
      fmt,
    );
    expect(v.map).toEqual({
      show: false,
      note: 'Location tracking isn’t available for this shipment.',
    });
  });

  it('shows a map only for a same-day courier with a position, and flags stale positions', () => {
    const events = [...packed, carrier('PU', 4), carrier('IT', 5), carrier('OFD', 6)];
    const now = Date.parse(at(7));
    const fresh = trackingView(
      tracking(events, { mode: 'local', courier: { x: 0.5, y: 0.5, updatedAt: at(7) } }),
      fmt,
      now,
    );
    expect(fresh.map).toEqual({ show: true, stale: false });
    const stale = trackingView(
      tracking(events, {
        mode: 'local',
        courier: { x: 0.5, y: 0.5, updatedAt: new Date(now - 18 * 60_000).toISOString() },
      }),
      fmt,
      now,
    );
    expect(stale.map).toEqual({ show: true, stale: true });
    const noPosition = trackingView(tracking(events, { mode: 'local' }), fmt, now);
    expect(noPosition.map.show).toBe(false);
  });

  it('only calls it delivered on a delivered event', () => {
    const v = trackingView(tracking([...packed, carrier('PU', 4), carrier('DL', 9)]), fmt);
    expect(v.title).toBe('Delivered');
    expect(v.estimate.text).toBe('Delivered 09:00');
  });

  it('handles an order with no events yet', () => {
    const v = trackingView(tracking([]), fmt);
    expect(v.title).toBe('Order received');
    expect(v.stage).toBe(-1);
  });
});
