import { render, screen } from '@testing-library/react-native';
import { StatusCard } from '@/components/delivery/StatusCard';
import { DeliveryStatusTimeline } from '@/components/delivery/Timeline';
import { normaliseCarrierEvent, trackingView } from '@/domain/delivery';
import type { DeliveryTracking, TrackingEvent } from '@/domain/types';

const fmt = (iso: string) => iso.slice(11, 16);
const at = (h: number) => new Date(Date.UTC(2026, 9, 11, h)).toISOString();
const m = (stage: TrackingEvent['stage'], h: number): TrackingEvent => ({
  id: `m${h}`,
  stage,
  source: 'merchant',
  at: at(h),
  description: `merchant ${stage}`,
});
const c = (code: string, h: number) =>
  normaliseCarrierEvent({ id: `c${h}`, code, occurredAt: at(h) })!;

function renderTracker(events: TrackingEvent[], extra: Partial<DeliveryTracking> = {}) {
  const t: DeliveryTracking = {
    orderId: 'O',
    mode: 'parcel',
    carrier: 'C',
    serviceLevel: 'Standard parcel',
    events,
    lastCheckedAt: at(0),
    ...extra,
  };
  const view = trackingView(t, fmt);
  render(
    <>
      <StatusCard view={view} eyebrow="Standard parcel · simulated" updated={fmt(view.updatedAt)} />
      <DeliveryStatusTimeline events={t.events} stage={view.stage} formatTime={fmt} />
    </>,
  );
  return view;
}

const estimate = { from: at(9), to: at(17), source: 'carrier' as const, updatedAt: at(8) };

describe('tracker UI never presents the unconfirmed as fact', () => {
  it('before handover: no estimate shown, later stages read "Not yet"', () => {
    renderTracker([m('order_confirmed', 1), m('preparing', 2), m('packed', 3)], { estimate });
    expect(screen.getByText('Delivery estimate not yet available')).toBeTruthy();
    expect(screen.queryByText(/Estimate from/)).toBeNull();
    expect(screen.getAllByText('Not yet')).toHaveLength(4);
  });

  it('with the courier: the estimate is attributed', () => {
    renderTracker([m('order_confirmed', 1), m('preparing', 2), m('packed', 3), c('PU', 4)], {
      estimate,
    });
    expect(screen.getByText('Estimate from carrier: 09:00–17:00')).toBeTruthy();
    expect(screen.getByText('Courier')).toBeTruthy();
  });

  it('an unknown courier code does not advance or deliver', () => {
    const view = renderTracker([m('order_confirmed', 1), c('ZZZ', 2)]);
    expect(view.title).toBe('Order confirmed');
    expect(screen.queryByText('Delivered')).not.toBeNull(); // the stage label exists…
    expect(screen.getAllByText('Not yet')).toHaveLength(6); // …but is not confirmed
  });

  it('a delivery exception replaces the estimate rather than keeping a stale one', () => {
    renderTracker(
      [m('order_confirmed', 1), m('preparing', 2), m('packed', 3), c('PU', 4), c('NA', 5)],
      { estimate },
    );
    expect(screen.getByText('Delivery attempted')).toBeTruthy();
    expect(screen.queryByText(/Estimate from/)).toBeNull();
  });
});
