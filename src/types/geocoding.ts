/**
 * Turning an address somebody typed into a place on the map.
 *
 * This is the last of the three gaps the delivery-radius rule sits on top of,
 * and the only one that is a boundary rather than a contract. The add-address
 * form is six text fields; nothing behind it has ever produced a coordinate.
 * So `deliveryRange` answers `'unknown'` for almost every address the app
 * holds, `courierRefusal` declines to read a provider's "cannot route there"
 * as a refusal, and both are right to — but the consequence is that an address
 * genuinely out of range is accepted, because nothing can measure it.
 *
 * The app used to paper over this by stamping every new address with the
 * Johannesburg CBD. That is worth remembering rather than only recording: it
 * made the radius rule *look* implemented while making it wrong for everybody.
 * Measured from the CBD, six of the seven branches sit outside their own
 * radius, so a typed-in address was refused by six branches and accepted by
 * the seventh regardless of where in the country it was.
 *
 * ── Why this exists before a provider does ────────────────────────────────
 * Same reasoning as `DeliveryProvider`, and the same rule from §12: a real
 * geocoder needs an account, a key and a billing relationship this repository
 * does not have. What it does not need is for the app to be rewritten when one
 * arrives. Everything that wants a coordinate goes through this interface now,
 * against a mock, so connecting a real service is a new file and a flag value.
 *
 * The mock deliberately locates almost nothing — see `mockGeocodingProvider`.
 * A stand-in that cheerfully returned a plausible coordinate for any string
 * would recreate the CBD defect with extra steps, and would hide the fact that
 * the app is still running without a geocoder.
 */

/** The six fields the add-address form actually collects. */
export interface GeocodeRequest {
  line1: string;
  line2?: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
}

/**
 * How sure the provider is, which decides whether the app may act on it.
 *
 * Not a number. A confidence score invites a threshold, a threshold invites
 * somebody to tune it, and the only decision the app makes with this is binary:
 * is this good enough to refuse a customer's delivery over? Three named
 * outcomes keep that decision legible.
 *
 *   exact         a rooftop or street-number match
 *   approximate   the right street or suburb, not the right building
 *   none          the provider could not place it
 *
 * Only `exact` may narrow a delivery radius. `approximate` is useful for
 * centring a map and useless for refusing an order — a suburb centroid can sit
 * a kilometre from the door, which is the whole margin the radius rule works
 * in.
 */
export type GeocodePrecision = 'exact' | 'approximate' | 'none';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  precision: GeocodePrecision;
  /** The provider's own normalised rendering, for showing back to a customer. */
  formatted?: string;
}

/**
 * A geocoding service, as the app is willing to depend on one.
 *
 * Deliberately one method. Reverse geocoding, autocomplete and place search
 * are all things a real provider offers and none of them has a caller here;
 * adding them now would be designing against an imagined screen.
 */
export interface GeocodingProvider {
  readonly name: string;
  /**
   * Locate an address, or report that it could not be located.
   *
   * Returns `null` rather than throwing when the address simply cannot be
   * found — that is an ordinary answer, not a failure. Throwing is reserved
   * for the provider being unreachable, which callers must treat as "nobody
   * knows" rather than as "not there".
   */
  locate(request: GeocodeRequest): Promise<GeocodeResult | null>;
}
