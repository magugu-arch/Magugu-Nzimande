import { config } from '@/constants/config';
import type { GeocodeRequest, GeocodeResult, GeocodingProvider } from '@/types/geocoding';
import { mockGeocodingProvider } from './mockGeocodingProvider';

/**
 * Which service locates an address, chosen at runtime by a flag.
 *
 * The same registry shape as `providers/delivery`, and for the same reason: a
 * real geocoder arrives with an account, a key and a bill, and none of that
 * belongs in this repository (§12). What belongs here is the boundary, so that
 * connecting one is a new file and a flag value rather than a change to the
 * address form, the radius rule, or any type.
 *
 * An unknown name falls back to the mock rather than throwing. A missing
 * geocoder is a degraded app, not a broken one — addresses stay unlocated and
 * `deliveryRange` answers "unknown", which is exactly what happens today — so
 * taking the app down at import time over a misconfigured name would trade a
 * working checkout for a tidier error. `geocodingProviderIsConfigured` reports
 * the truth for `audit:launch`, which is where it should be loud.
 */
const REGISTRY: Record<string, GeocodingProvider> = {
  mock: mockGeocodingProvider,
};

export function geocodingProvider(): GeocodingProvider {
  return REGISTRY[config.geocoding.provider] ?? mockGeocodingProvider;
}

/** Whether the configured provider name resolves to something real. */
export function geocodingProviderIsConfigured(): boolean {
  return config.geocoding.provider in REGISTRY;
}

/** Every geocoder this build knows how to talk to. */
export function knownGeocodingProviders(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * Locate an address, and decide whether the answer is good enough to keep.
 *
 * This is the only function the app should call. It exists so the "may I act
 * on this?" rule lives in one place rather than at each call site, because it
 * is the rule that the CBD defect got wrong: the app did not lack a coordinate,
 * it had one it should never have trusted.
 *
 * Only an `exact` fix is kept. An `approximate` one — a suburb centroid, a
 * street without a number — can sit a kilometre from the door, and a kilometre
 * is most of the margin the delivery-radius rule works in. Keeping it would
 * mean refusing somebody's delivery over a point nobody measured, which is the
 * original defect wearing a better label.
 *
 * A provider that is unreachable resolves to `null`, the same as an address it
 * could not find. Both mean "nobody knows", and the app already treats an
 * unlocated address correctly — it lets the order through rather than refusing
 * on a distance it cannot measure.
 */
export async function locateAddress(request: GeocodeRequest): Promise<GeocodeResult | null> {
  try {
    const result = await geocodingProvider().locate(request);
    return result && result.precision === 'exact' ? result : null;
  } catch {
    // Deliberately swallowed. An address that could not be located is an
    // ordinary outcome here, and a geocoder being down must never be the
    // reason somebody cannot save their address.
    return null;
  }
}

export { mockGeocodingProvider } from './mockGeocodingProvider';
