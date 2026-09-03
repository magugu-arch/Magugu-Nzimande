import { stores } from '@/services/data/storeData';
import type { GeocodeRequest, GeocodeResult, GeocodingProvider } from '@/types/geocoding';

/**
 * A geocoder that locates almost nothing, on purpose.
 *
 * The temptation with a mock like this is to return a plausible coordinate for
 * whatever it is handed — a city centre, a jittered point, the middle of the
 * province. That would make every screen look finished and would recreate,
 * exactly, the defect this whole boundary exists because of: the app used to
 * stamp new addresses with the Johannesburg CBD, which made the delivery-radius
 * rule appear to work while making it wrong for every customer in the country.
 *
 * A mock kinder than the world hides the defects it was built to catch. So this
 * one answers `null` for anything it cannot genuinely place, which is what a
 * real geocoder does for a bad address and what this app should keep handling
 * gracefully.
 *
 * ── What it does place ────────────────────────────────────────────────────
 * The suburbs bb.q actually has branches in, taken from the store list rather
 * than typed out again — so the fixture cannot drift from the network it
 * describes. That is enough to exercise the paths that matter:
 *
 *   · an address that locates, so `deliveryRange` finally measures something
 *   · an address that does not, so the "nobody knows" path stays exercised
 *   · an `approximate` result, so callers must decide what they trust
 *
 * It returns the *branch* coordinate for a matching suburb, which is
 * approximate by construction and is labelled as such. Nothing in the app may
 * refuse a delivery on an `approximate` fix, so this cannot repeat the CBD
 * mistake even for the suburbs it does know.
 */

/** Suburb (lower-cased) to the branch that sits in it. */
const KNOWN = new Map(
  stores.map((store) => [
    store.suburb.trim().toLowerCase(),
    { latitude: store.latitude, longitude: store.longitude },
  ]),
);

/**
 * One address that resolves exactly, so the `exact` path has an example.
 *
 * A real geocoder returns rooftop precision for a well-formed street address
 * it knows. Without one seeded case the difference between `exact` and
 * `approximate` is a distinction the app makes and never demonstrates — and
 * `deliveryRange` narrowing on a real coordinate would have no test at all.
 */
const ROOFTOP: Record<string, GeocodeResult> = {
  '14 acacia road': {
    latitude: -26.1327,
    longitude: 28.0673,
    precision: 'exact',
    formatted: '14 Acacia Road, Melrose Arch, Johannesburg, 2196',
  },
};

export const mockGeocodingProvider: GeocodingProvider = {
  name: 'mock',

  async locate(request: GeocodeRequest): Promise<GeocodeResult | null> {
    const line = request.line1.trim().toLowerCase();
    const rooftop = ROOFTOP[line];
    if (rooftop) return rooftop;

    const suburb = KNOWN.get(request.suburb.trim().toLowerCase());
    if (suburb) {
      return {
        latitude: suburb.latitude,
        longitude: suburb.longitude,
        precision: 'approximate',
        formatted: `${request.suburb}, ${request.city}`,
      };
    }

    // Not "somewhere near enough". Nowhere.
    return null;
  },
};
