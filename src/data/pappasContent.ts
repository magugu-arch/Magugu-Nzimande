import { awaiting, fromAsset, fromBrief, type Fact } from './businessInput';

/**
 * Pappas — the restaurant, in the app's own words.
 *
 * Every string here is either read off one of the sixteen supplied assets,
 * quoted from the brief, or explicitly marked as awaiting business input.
 * Nothing is invented. See `businessInput.ts` for why that distinction is a
 * type rather than a convention.
 *
 * The brief names https://www.pappasrestaurant.co.za/ as the primary source
 * for restaurant information (§2), and that site is not reachable from this
 * build environment — the network egress policy blocks it. So the trading
 * details a website would normally supply are marked rather than guessed.
 * They are a short list, they are all on one page of the Pappas website, and
 * `npm run audit:placeholders` prints them.
 */

/**
 * The brand lockup, exactly as the CI sheet sets it.
 *
 * Panel 01 of asset 15: an olive sprig above "PAPPAS", with "GREEK &
 * MEDITERRANEAN" beneath a rule, and "A TASTE OF A BRIGHTER LIFE" in gold
 * below that. Panel 02 shows the stacked, horizontal, roundel and
 * dark-ground variations.
 */
export const brand = {
  name: 'PAPPAS',
  descriptor: 'GREEK & MEDITERRANEAN',
  /** Panel 01's gold line, and painted on the dining-room wall in asset 13. */
  tagline: 'A taste of a brighter life',
  /** Panel 08's brand elements, and on the bar wall in asset 14. */
  promise: 'Good food. Great company. Unforgettable moments.',
  /**
   * The Allura accent phrase.
   *
   * Appears hand-lettered on the dining-room arch (13), the bar column (14)
   * and a napkin (10). This is the one line §3 permits in the script face,
   * and it is used at most once per screen.
   */
  script: 'Good Food Brighter Moments',
  /** Asset 01's closing line, set in the poster's italic. */
  ethos: 'To eat well is to live well.',
  /** Panel 08 again — the brand's own statement of intent. */
  purpose: 'People. Culture. Change. A brighter tomorrow.',
} as const;

/**
 * Where Pappas is.
 *
 * Asset 16 shows the dining room looking out onto Nelson Mandela Square —
 * the statue, the arch and the square's own signage are all legible, and a
 * Pappas storefront is visible across it. Asset 01's footer states "A TASTE
 * OF THE MEDITERRANEAN IN THE HEART OF SANDTON". Between them the suburb and
 * the landmark are established; the street address, unit number and
 * coordinates are not, and are requested rather than guessed.
 *
 * The coordinates below are the only place this file holds a number nobody
 * supplied, and they are the *square's*, not the restaurant's — they are
 * used to centre a map and to measure a delivery radius, and Nelson Mandela
 * Square is a published public landmark rather than a fact about Pappas. The
 * restaurant's own pin should replace them.
 */
export const venue = {
  name: 'Pappas on the Square',
  landmark: fromAsset('Nelson Mandela Square', '16_window_square_view'),
  suburb: fromAsset('Sandton', '01_pappas_food_photography_master_style', 'footer line'),
  city: 'Johannesburg',
  province: 'Gauteng',
  country: 'South Africa',

  addressLine: awaiting(
    'The full street address, including shop or unit number, as it should appear on directions and receipts.',
    'Nelson Mandela Square, Sandton',
  ) as Fact<string>,
  postalCode: awaiting('Postal code for the restaurant.', '—') as Fact<string>,

  /**
   * Nelson Mandela Square, for map centring and delivery-radius maths. Not
   * the restaurant's own pin — see the note above.
   */
  squareLatitude: -26.1076,
  squareLongitude: 28.0567,
  coordinates: awaiting(
    'The restaurant’s own latitude and longitude, so directions land at the door rather than in the middle of the square.',
    'Centred on Nelson Mandela Square',
  ) as Fact<{ latitude: number; longitude: number }>,

  phone: awaiting(
    'The reservations and enquiries telephone number.',
    'Call us — number coming soon',
  ) as Fact<string>,
  email: awaiting(
    'The public enquiries email address.',
    'Email address coming soon',
  ) as Fact<string>,
  functionsEmail: awaiting(
    'The email address for private dining, functions and corporate enquiries.',
    'Enquiries handled by the Pappas team',
  ) as Fact<string>,

  /**
   * Trading hours.
   *
   * §15 forbids inventing these outright, and they matter more than most
   * placeholders: the order flow reads trading hours to decide whether a
   * customer may order now or must schedule, so a wrong answer here is not
   * cosmetic. Until they are supplied, the app says it does not know and
   * offers scheduling, rather than asserting a closed restaurant is open.
   */
  hours: awaiting(
    'Trading hours for each day of the week, including kitchen close and any breakfast/lunch/dinner service split.',
    'Hours confirmed on request',
  ) as Fact<{ day: string; opens: string; closes: string }[]>,

  /**
   * The venue story, for the About and Location screens.
   *
   * Written from what the supplied venue photography actually shows rather
   * than from a brand imagination: asset 13's olive trees, woven pendants,
   * travertine and open kitchen; asset 14's lit stone bar; asset 16's window
   * onto the square. §15's "do not use generic stock imagery when an attached
   * Pappas image can be used" has a copy equivalent, and this is it.
   */
  story: fromBrief(
    'Pappas sits on Nelson Mandela Square, where a wall of glass opens the dining room onto ' +
      'the life of the square. Inside: olive trees under woven pendants, travertine and pale ' +
      'stone, an open kitchen along the back wall, and a bar that glows at dusk. It is a room ' +
      'built for long tables and unhurried evenings — Greek and Mediterranean cooking, served ' +
      'the way it is meant to be eaten, in company.',
    '§9, venue editorial',
  ),
} as const;

/**
 * The five customer jobs the app is organised around — §4.
 *
 * Quoted rather than paraphrased, because they are the brief's own framing
 * and the bottom navigation is built from them.
 */
export const customerJobs = [
  {
    id: 'discover',
    title: 'Discover',
    detail: 'See what is happening at Pappas — food, cocktails, experiences and the venue.',
  },
  {
    id: 'reserve',
    title: 'Reserve',
    detail: 'Book a table quickly, manage reservations and receive thoughtful reminders.',
  },
  {
    id: 'order',
    title: 'Order',
    detail: 'Browse the menu, customise, pay and track collection or delivery.',
  },
  {
    id: 'belong',
    title: 'Belong',
    detail: 'Earn recognition and rewards.',
  },
  {
    id: 'return',
    title: 'Return',
    detail: 'Favourites, personalised offers and reminders worth receiving.',
  },
] as const;

/**
 * Support contact.
 *
 * Replaces the bb.q support block. Every channel here is awaiting a real
 * value; the app shows the placeholder rather than a dead tel: link, because
 * a phone number that does not ring is worse than no phone number.
 */
export const SUPPORT = {
  phone: venue.phone,
  email: venue.email,
  hours: venue.hours,
} as const;

/**
 * Everything on this page that Pappas still has to supply.
 *
 * Exported so the audit script and its test can walk one object rather than
 * guessing which modules hold facts.
 */
export const pappasContent = { brand, venue, customerJobs } as const;
