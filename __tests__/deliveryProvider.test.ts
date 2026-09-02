import {
  deliveryProvider,
  hasAuthorisedDeliveryProvider,
  mockDeliveryProvider,
  resetMockDeliveryProvider,
} from '@/providers/delivery';
import { statusFromElapsed } from '@/providers/delivery/mockProvider';
import type { DeliveryPoint } from '@/providers/delivery';

/**
 * The seam an authorised partner connects through. Nothing here talks to a
 * third party — §12 is explicit that this brief grants no such access — so
 * these test that the interface behaves, and that the mock refuses honestly
 * rather than always saying yes.
 */

const located: DeliveryPoint = {
  addressLine: '12 Rivonia Road',
  suburb: 'Sandton',
  latitude: -26.1076,
  longitude: 28.0567,
};

/** The ordinary case: six typed fields and no geocoder behind them. */
const unlocated: DeliveryPoint = {
  addressLine: '4 Long Street',
  suburb: 'Cape Town',
};

const store: DeliveryPoint = {
  addressLine: 'Shop 4, Sandton City',
  suburb: 'Sandton',
  latitude: -26.1071,
  longitude: 28.0567,
};

beforeEach(resetMockDeliveryProvider);

describe('which provider is connected', () => {
  it('is the mock, because no real one is authorised yet', () => {
    expect(deliveryProvider().id).toBe('mock');
    expect(hasAuthorisedDeliveryProvider()).toBe(false);
  });
});

describe('quoting', () => {
  it('prices a located dropoff and says how long the price is good for', async () => {
    const quote = await mockDeliveryProvider.quote({
      pickup: store,
      dropoff: located,
      orderValueMinor: 23_700,
    });

    expect(quote.serviceable).toBe(true);
    expect(quote.feeMinor).toBeGreaterThan(0);
    expect(Number.isInteger(quote.feeMinor)).toBe(true);
    expect(quote.currency).toBe('ZAR');
    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(quote.quoteId).not.toBe('');
  });

  it('refuses an address nobody has located, and says why', async () => {
    const quote = await mockDeliveryProvider.quote({
      pickup: store,
      dropoff: unlocated,
      orderValueMinor: 23_700,
    });

    expect(quote.serviceable).toBe(false);
    expect(quote.unserviceableReason).toMatch(/could not locate/i);
    // No fee and no quote id, so nothing downstream can dispatch on it.
    expect(quote.feeMinor).toBe(0);
    expect(quote.quoteId).toBe('');
  });
});

describe('dispatching', () => {
  const dispatch = async (idempotencyKey: string) => {
    const quote = await mockDeliveryProvider.quote({
      pickup: store,
      dropoff: located,
      orderValueMinor: 23_700,
    });
    return mockDeliveryProvider.create({
      quoteId: quote.quoteId,
      orderReference: 'BBQ-1',
      pickup: store,
      dropoff: located,
      idempotencyKey,
    });
  };

  it('creates a job that starts confirmed', async () => {
    const job = await dispatch('idem-delivery-1');

    expect(job.externalJobId).not.toBe('');
    expect(job.status).toBe('CONFIRMED');
    expect(job.etaMinutes).toBeGreaterThan(0);
  });

  it('does not put two couriers on one order', async () => {
    const first = await dispatch('idem-delivery-same');
    const second = await dispatch('idem-delivery-same');

    expect(second.externalJobId).toBe(first.externalJobId);
  });

  it('dispatches separately for a separate attempt', async () => {
    const first = await dispatch('idem-delivery-a');
    const second = await dispatch('idem-delivery-b');

    expect(second.externalJobId).not.toBe(first.externalJobId);
  });

  it('refuses to dispatch against a quote it never gave', async () => {
    await expect(
      mockDeliveryProvider.create({
        quoteId: '',
        orderReference: 'BBQ-2',
        pickup: store,
        dropoff: unlocated,
        idempotencyKey: 'idem-delivery-bad',
      }),
    ).rejects.toThrow(/no longer valid/i);
  });

  it('never claims live tracking it cannot provide', async () => {
    const job = await dispatch('idem-delivery-tracking');
    expect(job.trackingAvailable).toBe(false);
    expect(job.trackingUrl).toBeUndefined();
  });
});

describe('following and cancelling a job', () => {
  it('reports a job it knows about', async () => {
    const quote = await mockDeliveryProvider.quote({
      pickup: store,
      dropoff: located,
      orderValueMinor: 23_700,
    });
    const created = await mockDeliveryProvider.create({
      quoteId: quote.quoteId,
      orderReference: 'BBQ-3',
      pickup: store,
      dropoff: located,
      idempotencyKey: 'idem-delivery-status',
    });

    const status = await mockDeliveryProvider.getStatus(created.externalJobId);
    expect(status.externalJobId).toBe(created.externalJobId);

    await mockDeliveryProvider.cancel(created.externalJobId);
    expect((await mockDeliveryProvider.getStatus(created.externalJobId)).status).toBe('CANCELLED');
  });

  it('does not invent a job it has never seen', async () => {
    await expect(mockDeliveryProvider.getStatus('job-nonexistent')).rejects.toThrow();
    await expect(mockDeliveryProvider.cancel('job-nonexistent')).rejects.toThrow();
  });
});

describe('how a job progresses', () => {
  it('advances with the clock rather than jumping to delivered', () => {
    const eta = 40;
    expect(statusFromElapsed(0, eta)).toBe('CONFIRMED');
    expect(statusFromElapsed(3, eta)).toBe('COURIER_ASSIGNED');
    expect(statusFromElapsed(15, eta)).toBe('PICKED_UP');
    expect(statusFromElapsed(30, eta)).toBe('ON_THE_WAY');
    expect(statusFromElapsed(40, eta)).toBe('DELIVERED');
    expect(statusFromElapsed(90, eta)).toBe('DELIVERED');
  });

  it('never goes backwards as time passes', () => {
    const order = ['CONFIRMED', 'COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
    let highest = 0;

    for (let minute = 0; minute <= 60; minute += 1) {
      const index = order.indexOf(statusFromElapsed(minute, 40));
      expect(index).toBeGreaterThanOrEqual(highest);
      highest = index;
    }
  });
});
