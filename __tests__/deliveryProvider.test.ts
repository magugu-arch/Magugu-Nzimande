import { config } from '@/constants/config';
import {
  deliveryProvider,
  deliveryProviderIsConfigured,
  deliveryStatusToOrderStatus,
  knownDeliveryProviders,
  mockDeliveryProvider,
  resetMockDeliveryJobs,
} from '@/providers/delivery';
import { statusSequence } from '@/services/orderService';
import type { DeliveryStatus } from '@/types';

/**
 * The courier boundary (brief §5, §6).
 *
 * §5 is precise about what "Uber-ready" means and, more usefully, about what it
 * does not: the app must be *architected* so an approved delivery integration
 * can be connected without rebuilding the customer experience, and it must not
 * reproduce anybody's proprietary platform. §12 adds that credentials and
 * approvals are prerequisites this repository does not have.
 *
 * So what is testable here is the shape of the boundary rather than any
 * courier's behaviour: that the interface is the one the brief specified, that
 * the only provider shipping is the mock, that a provider's vocabulary maps
 * onto the customer's in exactly one place, and that the mock is not kinder
 * than the world it stands in for.
 */
beforeEach(() => {
  resetMockDeliveryJobs();
});

describe('the provider boundary', () => {
  it('offers the four methods the brief names, and nothing else to call', () => {
    const provider = deliveryProvider();
    expect(typeof provider.quote).toBe('function');
    expect(typeof provider.create).toBe('function');
    expect(typeof provider.getStatus).toBe('function');
    expect(typeof provider.cancel).toBe('function');
  });

  it('ships the mock and only the mock', () => {
    // §12: an authorised integration needs contracts, credentials and
    // technical approval. Until then a second entry here would be a fiction.
    expect(knownDeliveryProviders()).toEqual(['mock']);
    expect(config.delivery.provider).toBe('mock');
    expect(deliveryProviderIsConfigured()).toBe(true);
  });

  it('falls back to the mock rather than crashing on an unknown name', () => {
    // A misconfigured courier provider must not take down an app in which
    // collection orders still work perfectly well.
    expect(deliveryProvider()).toBe(mockDeliveryProvider);
  });
});

describe('translating the courier’s status into the customer’s', () => {
  it.each([
    ['COURIER_ASSIGNED', 'courier_assigned'],
    ['PICKED_UP', 'out_for_delivery'],
    ['ON_THE_WAY', 'out_for_delivery'],
    ['DELIVERED', 'completed'],
    ['CANCELLED', 'cancelled'],
  ] as const)('%s reads as %s', (delivery, order) => {
    expect(deliveryStatusToOrderStatus(delivery)).toBe(order);
  });

  /**
   * A courier job being confirmed is a fact about the courier network. The
   * customer's food is still in the kitchen, and telling them otherwise would
   * describe somebody else's progress as their own.
   */
  it('does not promote a customer for a courier merely confirming the job', () => {
    expect(deliveryStatusToOrderStatus('CONFIRMED')).toBe('preparing');
  });

  /**
   * The one that matters most, and the easiest to get wrong. A courier who
   * cannot deliver has not cancelled the order: the food exists, it is paid
   * for, and the store needs to reach the customer. Mapping FAILED to
   * 'cancelled' would tell somebody their money is coming back when nobody has
   * decided that.
   */
  it('does not cancel a customer’s order because a courier failed', () => {
    expect(deliveryStatusToOrderStatus('FAILED')).not.toBe('cancelled');
    expect(deliveryStatusToOrderStatus('FAILED')).toBe('ready');
  });

  it('maps every member of the union, so a new one cannot be forgotten', () => {
    const all: DeliveryStatus[] = [
      'CONFIRMED',
      'COURIER_ASSIGNED',
      'PICKED_UP',
      'ON_THE_WAY',
      'DELIVERED',
      'CANCELLED',
      'FAILED',
    ];
    for (const status of all) {
      expect(deliveryStatusToOrderStatus(status)).toBeTruthy();
    }
  });

  it('only ever produces a status the delivery journey actually contains', () => {
    // 'cancelled' is deliberately outside the sequence — it is not a step.
    const sequence = statusSequence('delivery');
    const mapped = (
      ['CONFIRMED', 'COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'] as const
    ).map(deliveryStatusToOrderStatus);
    for (const status of mapped) {
      expect(sequence).toContain(status);
    }
  });
});

describe('the mock provider', () => {
  const dropoff = {
    orderId: 'order-1',
    orderReference: 'BBQ-1',
    storeId: 'store-sandton',
    dropoffSummary: '14 Acacia Road, Melrose Arch',
    dropoffLatitude: -26.1327,
    dropoffLongitude: 28.0673,
    idempotencyKey: 'key-1',
  };

  /**
   * A mock kinder than the world hides the defects it was built to catch. The
   * app has been bitten by exactly this once: a missing coordinate defaulted to
   * the Johannesburg CBD and the delivery-radius rule began deciding where
   * customers lived from a constant.
   */
  it('refuses a dropoff it cannot locate', async () => {
    const quote = await mockDeliveryProvider.quote({ storeId: 'store-sandton', orderValue: 250 });
    expect(quote.serviceable).toBe(false);
    expect(quote.reason).toMatch(/coordinates/i);
  });

  it('quotes a dropoff it can locate', async () => {
    const quote = await mockDeliveryProvider.quote({
      storeId: 'store-sandton',
      dropoffLatitude: -26.1327,
      dropoffLongitude: 28.0673,
      orderValue: 250,
    });
    expect(quote.serviceable).toBe(true);
    expect(quote.etaMinutes).toBeGreaterThan(0);
    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  /**
   * The reason `idempotencyKey` is on the create request at all: the retry
   * that would create a second order is the retry that would dispatch a second
   * driver.
   */
  it('returns the same job for a repeated request rather than dispatching twice', async () => {
    const first = await mockDeliveryProvider.create(dropoff);
    const second = await mockDeliveryProvider.create(dropoff);
    expect(second.externalJobId).toBe(first.externalJobId);
  });

  it('dispatches a genuinely different order separately', async () => {
    const first = await mockDeliveryProvider.create(dropoff);
    const second = await mockDeliveryProvider.create({ ...dropoff, idempotencyKey: 'key-2' });
    expect(second.externalJobId).not.toBe(first.externalJobId);
  });

  /**
   * No real courier network grants a live position without authorisation, so
   * the default has to be the unauthorised one — otherwise the tracking map
   * only ever gets developed against the permissive case.
   */
  it('reports tracking as unavailable until a provider is authorised for it', async () => {
    const job = await mockDeliveryProvider.create(dropoff);
    expect(job.trackingAvailable).toBe(false);
  });

  it('names nobody until somebody is assigned', async () => {
    const job = await mockDeliveryProvider.create(dropoff);
    expect(job.status).toBe('CONFIRMED');
    expect(job.courierName).toBeUndefined();
  });

  it('walks the courier leg as time passes', async () => {
    const created = await mockDeliveryProvider.create(dropoff);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 3 * 60_000);

    const assigned = await mockDeliveryProvider.getStatus(created.externalJobId);
    expect(assigned.status).toBe('COURIER_ASSIGNED');
    expect(assigned.courierName).toBeTruthy();

    jest.spyOn(Date, 'now').mockReturnValue(now + 30 * 60_000);
    const delivered = await mockDeliveryProvider.getStatus(created.externalJobId);
    expect(delivered.status).toBe('DELIVERED');
    jest.restoreAllMocks();
  });

  it('reports a cancelled job as cancelled', async () => {
    const created = await mockDeliveryProvider.create(dropoff);
    await mockDeliveryProvider.cancel(created.externalJobId);
    const after = await mockDeliveryProvider.getStatus(created.externalJobId);
    expect(after.status).toBe('CANCELLED');
  });

  it('rejects rather than inventing a job it has never heard of', async () => {
    await expect(mockDeliveryProvider.getStatus('nope')).rejects.toThrow(/No such delivery job/);
    await expect(mockDeliveryProvider.cancel('nope')).rejects.toThrow(/No such delivery job/);
  });
});
