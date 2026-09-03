import {
  geocodingProvider,
  geocodingProviderIsConfigured,
  knownGeocodingProviders,
  locateAddress,
  mockGeocodingProvider,
} from '@/providers/geocoding';
import { deliveryRange } from '@/store/fulfilmentStore';
import { stores } from '@/services/data/storeData';
import type { Address } from '@/types';
import type { GeocodeRequest, GeocodingProvider } from '@/types/geocoding';

const request = (over: Partial<GeocodeRequest> = {}): GeocodeRequest => ({
  line1: '27 Protea Avenue',
  suburb: 'Northcliff',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2195',
  ...over,
});

describe('the geocoding boundary', () => {
  it('resolves a provider, and says which ones it knows', () => {
    expect(geocodingProvider().name).toBe('mock');
    expect(knownGeocodingProviders()).toEqual(['mock']);
    expect(geocodingProviderIsConfigured()).toBe(true);
  });
});

/**
 * The mock's job is to be honest, not helpful.
 *
 * A stand-in that returned a plausible coordinate for any string would make
 * every screen look finished and would recreate the exact defect this boundary
 * exists because of — the app used to stamp every new address with the
 * Johannesburg CBD, which made the delivery-radius rule appear implemented
 * while making it wrong for every customer in the country.
 */
describe('the mock geocoder', () => {
  it('locates nothing it does not actually know', async () => {
    expect(await mockGeocodingProvider.locate(request({ suburb: 'Nowhere' }))).toBeNull();
  });

  it('places a known suburb only approximately', async () => {
    const found = await mockGeocodingProvider.locate(request({ suburb: 'Sandhurst' }));
    expect(found?.precision).toBe('approximate');
  });

  it('takes its known suburbs from the store list rather than a second copy', async () => {
    // A fixture that restated the branch network could drift from it. This is
    // the assertion that it cannot.
    for (const store of stores) {
      const found = await mockGeocodingProvider.locate(request({ suburb: store.suburb }));
      expect(found).not.toBeNull();
      expect(found!.latitude).toBe(store.latitude);
      expect(found!.longitude).toBe(store.longitude);
    }
  });

  it('resolves one address exactly, so the exact path has an example', async () => {
    const found = await mockGeocodingProvider.locate(request({ line1: '14 Acacia Road' }));
    expect(found?.precision).toBe('exact');
  });
});

/**
 * The rule the CBD defect got wrong. The app did not lack a coordinate — it
 * had one it should never have trusted.
 */
describe('what the app is willing to act on', () => {
  it('keeps an exact fix', async () => {
    const located = await locateAddress(request({ line1: '14 Acacia Road' }));
    expect(located).not.toBeNull();
    expect(located!.precision).toBe('exact');
  });

  it('throws away an approximate one', async () => {
    // A suburb centroid can sit a kilometre from the door, and a kilometre is
    // most of the margin the delivery-radius rule works in. Refusing somebody's
    // order on that is the original defect wearing a better label.
    const approximate = await mockGeocodingProvider.locate(request({ suburb: 'Sandhurst' }));
    expect(approximate?.precision).toBe('approximate');
    expect(await locateAddress(request({ suburb: 'Sandhurst' }))).toBeNull();
  });

  it('returns nothing for an address nobody can place', async () => {
    expect(await locateAddress(request({ suburb: 'Nowhere' }))).toBeNull();
  });

  /**
   * A geocoder being unreachable must never be the reason somebody cannot save
   * their address.
   *
   * The registry resolves `mock` to the provider module, so replacing that
   * module with a throwing one is what puts a broken provider behind
   * `locateAddress`. Spying on the exported `geocodingProvider` does not work
   * and is worth recording: `locateAddress` calls it directly, within the same
   * module, so the call never goes through the export a spy can replace.
   */
  it('treats a provider that is down as "nobody knows", not as "not there"', async () => {
    const broken: GeocodingProvider = {
      name: 'broken',
      locate: () => Promise.reject(new Error('DNS failure')),
    };

    let withBrokenProvider!: typeof locateAddress;
    jest.isolateModules(() => {
      jest.doMock('@/providers/geocoding/mockGeocodingProvider', () => ({
        mockGeocodingProvider: broken,
      }));
      // `require`, not `import()`: this suite runs through the CommonJS
      // transform, where a dynamic import needs --experimental-vm-modules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      withBrokenProvider = require('@/providers/geocoding').locateAddress;
    });

    await expect(withBrokenProvider(request())).resolves.toBeNull();
  });
});

/**
 * What locating an address is *for*. Until now `deliveryRange` answered
 * `'unknown'` for every address a customer typed, so the radius rule could
 * never refuse an order that genuinely was out of range.
 */
describe('what a located address unlocks', () => {
  const sandton = stores.find((store) => store.id === 'store-sandton')!;
  const capeTown = stores.find((store) => store.id === 'store-vanda')!;

  const addressAt = (result: { latitude: number; longitude: number } | null): Address => ({
    id: 'a1',
    label: 'Home',
    line1: '14 Acacia Road',
    suburb: 'Melrose Arch',
    city: 'Johannesburg',
    province: 'Gauteng',
    postalCode: '2196',
    isDefault: false,
    ...(result ? { latitude: result.latitude, longitude: result.longitude } : {}),
  });

  it('lets a branch measure a distance it previously could not', async () => {
    const located = await locateAddress(request({ line1: '14 Acacia Road' }));
    expect(located).not.toBeNull();

    expect(deliveryRange(sandton, addressAt(located))).toBe('in');
    // Johannesburg to Cape Town is emphatically outside a 10 km radius, and
    // before a coordinate existed this answered 'unknown' and let it through.
    expect(deliveryRange(capeTown, addressAt(located))).toBe('out');
  });

  it('still answers "unknown" for an address nothing could locate', () => {
    expect(deliveryRange(sandton, addressAt(null))).toBe('unknown');
    expect(deliveryRange(capeTown, addressAt(null))).toBe('unknown');
  });
});
