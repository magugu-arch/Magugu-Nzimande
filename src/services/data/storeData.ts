import { isVerified } from '@/data/businessInput';
import { venue } from '@/data/pappasContent';
import type { OpeningHours, Store } from '@/types';

/**
 * Pappas.
 *
 * One restaurant, not a network — and that is the whole point of this file.
 *
 * ── Why one ──────────────────────────────────────────────────────────────
 *
 * The app this was built from served a chain: seven branches across four
 * cities, a store picker, a "nearest first" sort and a delivery radius per
 * branch. Pappas is one restaurant on Nelson Mandela Square. §15 forbids
 * inventing business facts, and six additional Pappas restaurants is the
 * largest possible one — a customer in Durban shown a "Pappas Gateway" would
 * drive to a shopping centre that has no such thing in it.
 *
 * Keeping the `Store[]` shape rather than collapsing it to a single object is
 * deliberate. Every screen, hook and test that reads a store list keeps
 * working, the delivery-radius and trading-hours logic is unchanged, and a
 * second Pappas is a data change rather than a re-architecture. §17.1 asks
 * that working architecture be preserved; a one-element array is how that
 * survives contact with a one-site restaurant.
 *
 * ── Trading hours ────────────────────────────────────────────────────────
 *
 * Nobody has supplied them, and §15 forbids inventing opening hours. So
 * `openingHours` is empty rather than filled with a plausible 12:00–22:00.
 *
 * That has a real consequence and it is the correct one: `isTradingNow`
 * cannot say the restaurant is open, so the app does not claim it is. The
 * ordering flow offers scheduling and the reservation flow offers a request
 * the restaurant confirms — both of which work without knowing the hours, and
 * neither of which sends somebody to a closed door.
 *
 * `venue.hours` is where they land when they arrive. This file reads them.
 */

/**
 * The supplied hours, in the shape the store model wants.
 *
 * Empty while `venue.hours` is awaiting business input — see the header, and
 * `data/pappasContent.ts` for what is being waited on.
 */
function openingHoursFromVenue(): OpeningHours[] {
  if (!isVerified(venue.hours)) return [];

  const DAY_INDEX: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  return venue.hours.value.flatMap((entry) => {
    const day = DAY_INDEX[entry.day];
    if (day === undefined) return [];
    return [{ day, opensAt: entry.opens, closesAt: entry.closes }];
  });
}

export const stores: Store[] = [
  {
    id: 'pappas-nelson-mandela-square',
    name: venue.name,
    addressLine: isVerified(venue.addressLine) ? venue.addressLine.value : venue.landmark.value,
    suburb: venue.suburb.value,
    city: venue.city,
    province: venue.province,
    // Empty rather than a plausible number. A `tel:` link to an invented
    // number rings a stranger.
    phone: isVerified(venue.phone) ? venue.phone.value : '',
    /**
     * Nelson Mandela Square, not the restaurant's own pin.
     *
     * The square is a published public landmark; the restaurant's exact
     * coordinates are awaiting business input. Getting a guest to the square
     * gets them to within a minute's walk, and the difference is recorded in
     * `venue.coordinates` rather than papered over.
     *
     * These also drive the delivery-radius check, where being a few dozen
     * metres out changes nothing about who can be delivered to.
     */
    latitude: venue.squareLatitude,
    longitude: venue.squareLongitude,
    openingHours: openingHoursFromVenue(),
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    /**
     * How far Pappas Direct will deliver, in kilometres.
     *
     * A UI and quoting bound rather than a published policy — it stops the
     * app quoting a delivery to Pretoria — and 10km from Sandton is the
     * radius the previous app already used for its Sandton branch. Pappas
     * should set its own; it is one number in one file.
     */
    deliveryRadiusKm: 10,
    /**
     * Kitchen preparation time, in minutes.
     *
     * The same figure the catalogue uses per dish. A restaurant grilling
     * whole fish and lamb shanks is not a fryer, and quoting eighteen minutes
     * because that is what a chicken shop quoted would be a promise nobody in
     * this kitchen made.
     */
    preparationMinutes: 25,
    /**
     * The kitchen's own flag: is anything stopping us cooking right now?
     *
     * True, and the first instinct here was the opposite — nobody has supplied
     * trading hours, so how can the app claim the restaurant is open?
     *
     * That reading confuses the two sources `isTradingNow` deliberately keeps
     * apart. The flag answers "is anything wrong" — a power cut, a burst pipe,
     * a shift nobody turned up for. The timetable answers "is this within
     * opening hours". With no timetable, `isTradingNow` falls back to the flag,
     * and `utils/tradingHours` gives the reason: "a data gap should not read as
     * a shut door."
     *
     * Setting this false would have been a *different* claim from the one
     * intended — not "we do not know the hours" but "the restaurant is shut" —
     * and it closes checkout, the cart and the whole ordering journey against a
     * restaurant that is very probably open. It was setting it false that broke
     * three checkout suites, which is how the distinction surfaced.
     *
     * Where the app genuinely does not know, it says so in words rather than by
     * refusing service: the Reserve screen notes that times are confirmed by the
     * restaurant, and About says the hours are on request.
     */
    isOpenNow: true,
  },
];
