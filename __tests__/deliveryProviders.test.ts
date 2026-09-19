import {
  MrDAdapter,
  PappasDirectAdapter,
  ProviderOrderRejected,
  UberEatsAdapter,
  availabilityFor,
  configureDirectChannel,
  defaultProviderFor,
  getProvider,
  listAvailability,
  resetProviderRegistry,
  type ProviderOrderRequest,
} from '@/integrations/delivery';
import { config } from '@/constants/config';
import type { Store } from '@/types/order';

/**
 * Provider selection, and the three ways a channel can be unusable.
 *
 * Extension §10.10 asks for tests covering provider selection, unavailable
 * providers, quote failure, order failure, status mapping and duplicate
 * webhooks. The last two live in `deliveryWebhooks.test.ts`; the first four
 * are here.
 *
 * The case worth naming: a channel is unusable for three different reasons
 * and the brief's §5 requires the interface to say two different things about
 * them. A flag being off and a credential being missing both read as "coming
 * soon" because both mean Pappas has not opened the channel yet. A provider
 * that is live but cannot do the mode the customer selected is something
 * else entirely — it is a dead end, and showing it as "coming soon" would
 * have a customer waiting for a collection option that will never arrive
 * because Mr D does not do collection at all.
 */

const channels = config.channels as {
  pappasDirectEnabled: boolean;
  uberEatsEnabled: boolean;
  mrDEnabled: boolean;
  brokerBaseUrl: string;
};

const original = { ...channels };

function setChannels(next: Partial<typeof original>): void {
  Object.assign(channels, next);
  resetProviderRegistry();
}

afterEach(() => {
  Object.assign(channels, original);
  resetProviderRegistry();
});

const SANDTON: Store = {
  id: 'pappas-nelson-mandela-square',
  name: 'Pappas on the Square',
  addressLine: 'Nelson Mandela Square',
  suburb: 'Sandton',
  city: 'Johannesburg',
  province: 'Gauteng',
  phone: '',
  latitude: -26.1076,
  longitude: 28.0567,
  openingHours: [],
  supportsDelivery: true,
  supportsCollection: true,
  supportsDineIn: true,
  deliveryRadiusKm: 10,
  preparationMinutes: 25,
  isOpenNow: true,
};

function direct(store: Store | null = SANDTON): PappasDirectAdapter {
  return new PappasDirectAdapter({
    async getStore() {
      return store;
    },
  });
}

function request(over: Partial<ProviderOrderRequest> = {}): ProviderOrderRequest {
  return {
    provider: 'pappas-direct',
    fulfilment: 'delivery',
    storeId: SANDTON.id,
    items: [{ sku: 'souvlaki-pork', name: 'Pork Souvlaki', quantity: 1, unitPriceCents: 18_500 }],
    subtotalCents: 18_500,
    deliveryFeeCents: 0,
    discountCents: 0,
    totalCents: 18_500,
    currency: 'ZAR',
    idempotencyKey: 'test-key',
    address: {
      line1: '5 Maude Street',
      suburb: 'Sandown',
      city: 'Johannesburg',
      country: 'ZA',
      latitude: -26.1085,
      longitude: 28.0553,
    },
    ...over,
  };
}

describe('choosing a channel', () => {
  beforeEach(() =>
    configureDirectChannel({
      async getStore() {
        return SANDTON;
      },
    }),
  );

  it('defaults to Pappas Direct, where the customer earns rewards', async () => {
    setChannels({
      pappasDirectEnabled: true,
      uberEatsEnabled: true,
      brokerBaseUrl: 'https://x.test',
    });
    await expect(defaultProviderFor('delivery')).resolves.toBe('pappas-direct');
  });

  it('falls through to another live channel if Direct is switched off', async () => {
    setChannels({
      pappasDirectEnabled: false,
      uberEatsEnabled: true,
      brokerBaseUrl: 'https://x.test',
    });
    await expect(defaultProviderFor('delivery')).resolves.toBe('uber-eats');
  });

  it('has no answer at all when every channel is closed', async () => {
    setChannels({ pappasDirectEnabled: false, uberEatsEnabled: false, mrDEnabled: false });
    await expect(defaultProviderFor('delivery')).resolves.toBeNull();
  });

  it('still lists the closed channels, because a partner row is content', async () => {
    setChannels({ uberEatsEnabled: false, mrDEnabled: false });
    const states = await listAvailability('delivery');
    // All three present — the picker must not change shape as flags flip.
    expect(states.map((s) => s.provider)).toEqual(['pappas-direct', 'uber-eats', 'mr-d']);
  });

  it('refuses an id nobody defined', () => {
    // @ts-expect-error — the point of the test is the runtime guard.
    expect(() => getProvider('deliveroo')).toThrow('UNKNOWN_PROVIDER:deliveroo');
  });
});

describe('the three ways a channel is unusable', () => {
  it('reads a switched-off channel as coming soon', async () => {
    setChannels({ uberEatsEnabled: false });
    const state = await availabilityFor('uber-eats', 'delivery');
    expect(state).toMatchObject({ state: 'coming-soon', reason: 'DISABLED' });
  });

  it('reads an enabled channel with no broker as coming soon too', async () => {
    setChannels({ uberEatsEnabled: true, brokerBaseUrl: '' });
    const state = await availabilityFor('uber-eats', 'delivery');
    expect(state).toMatchObject({ state: 'coming-soon', reason: 'NOT_CONFIGURED' });
  });

  it('reads a live channel that cannot do the mode as unavailable, not coming soon', async () => {
    // Mr D declares delivery only. A customer on the Collection toggle must
    // not be told to wait for something that is not coming.
    setChannels({ mrDEnabled: true, brokerBaseUrl: 'https://x.test' });
    const state = await availabilityFor('mr-d', 'pickup');
    expect(state).toMatchObject({ state: 'unavailable', reason: 'UNSUPPORTED_MODE' });
  });

  it('never claims live tracking for a channel that has no courier feed', async () => {
    // Pappas Direct delivers with its own staff and has no GPS feed. Claiming
    // the capability is how a map with an invented moving pin gets built.
    const caps = await direct().getCapabilities();
    expect(caps).not.toContain('live-tracking');
    expect(caps).not.toContain('driver-messaging');
  });
});

describe('an unconfigured external channel fails without crashing', () => {
  beforeEach(() => setChannels({ uberEatsEnabled: true, mrDEnabled: true, brokerBaseUrl: '' }));

  it('quotes as unavailable rather than throwing', async () => {
    // §11: "Missing provider credentials never crash the app."
    const quote = await new UberEatsAdapter().quote(request({ provider: 'uber-eats' }));
    expect(quote).toEqual({ available: false, reason: 'NOT_CONFIGURED' });
  });

  it('reports an address as unserviceable rather than throwing', async () => {
    const check = await new MrDAdapter().validateAddress(request().address!);
    expect(check).toEqual({ serviceable: false, reason: 'NOT_CONFIGURED' });
  });

  it('does throw on order creation, because there is no half-placed order', async () => {
    // Quoting can return a state; ordering cannot. A caller that ignored a
    // falsy return would leave a customer believing dinner is on its way.
    await expect(
      new UberEatsAdapter().createOrder(request({ provider: 'uber-eats' })),
    ).rejects.toBeInstanceOf(ProviderOrderRejected);
  });

  it('still answers what it will be able to do once connected', async () => {
    // A "coming soon" row that can name the service is marketing; a blank one
    // is a defect.
    await expect(new UberEatsAdapter().getCapabilities()).resolves.toContain('scheduled-order');
  });
});

describe('Pappas Direct quoting', () => {
  it('quotes collection at no fee and the kitchen’s own timing', async () => {
    const quote = await direct().quote(request({ fulfilment: 'pickup' }));
    expect(quote).toMatchObject({ available: true, deliveryFeeCents: 0, etaMinutes: 25 });
  });

  it('refuses an address outside the delivery radius, and says which', async () => {
    const quote = await direct().quote(
      request({
        address: {
          line1: 'Far',
          city: 'Pretoria',
          country: 'ZA',
          latitude: -25.75,
          longitude: 28.19,
        },
      }),
    );
    expect(quote).toMatchObject({ available: false, reason: 'OUT_OF_AREA' });
  });

  it('refuses a delivery under the minimum subtotal', async () => {
    const quote = await direct().quote(request({ subtotalCents: 4_000, totalCents: 4_000 }));
    expect(quote).toMatchObject({ available: false, reason: 'MINIMUM_NOT_MET' });
  });

  it('waives the fee above the free-delivery threshold', async () => {
    const quote = await direct().quote(request({ subtotalCents: 40_000, totalCents: 40_000 }));
    expect(quote.deliveryFeeCents).toBe(0);
  });

  it('refuses an immediate order when the restaurant is shut', async () => {
    const quote = await direct({ ...SANDTON, isOpenNow: false }).quote(request());
    expect(quote).toMatchObject({ available: false, reason: 'OUTSIDE_TRADING' });
  });

  it('still takes a booking for later when the restaurant is shut now', async () => {
    // A scheduled order is quoted against the schedule, not against now.
    const quote = await direct({ ...SANDTON, isOpenNow: false }).quote(
      request({ scheduledFor: '2026-09-20T18:30:00+02:00' }),
    );
    expect(quote.available).toBe(true);
  });

  it('reports an unknown store as a provider error, not as out of area', async () => {
    const quote = await direct(null).quote(request());
    expect(quote).toMatchObject({ available: false, reason: 'PROVIDER_ERROR' });
  });

  it('re-quotes at order time, so a closing restaurant refuses rather than charges', async () => {
    await expect(direct({ ...SANDTON, isOpenNow: false }).createOrder(request())).rejects.toThrow(
      /OUTSIDE_TRADING/,
    );
  });
});
