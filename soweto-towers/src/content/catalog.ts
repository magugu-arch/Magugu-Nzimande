import type { ImageSlug } from './images';

/**
 * The one price list. Prices, limits and rules are carried over from the
 * current sowetotowers.co.za pages (28 Nov 2026). Bundles follow the relaunch
 * plan and are marked CONFIRM in README until the operator signs them off.
 * Staff can override prices and switch items off in the console without a deploy.
 */

export type ActivityId = 'bungee-jump' | 'straightjacket-bungee' | 'scad-freefall' | 'zipline' | 'paintball' | 'lift-ride' | 'base-jump';

/** Physical resource a timed slot draws capacity from. */
export type Resource = 'bridge' | 'scad' | 'zipline' | 'arena' | 'lift';

export type AddonId = 'video' | 'photos';

export type Activity = {
  id: ActivityId;
  name: string;
  /** One line for cards. */
  short: string;
  /** Detail page headline, in the brand voice. */
  headline: string;
  description: string[];
  price: number;
  group?: { min: number; price: number };
  includes: string[];
  videoIncluded: boolean;
  addons: AddonId[];
  rules: {
    minWeightKg?: number;
    maxWeightKg?: number;
    /** Nobody under this age goes up the tower / takes part. */
    minAge?: number;
    /** Participants under this age need signed parent or guardian consent. */
    consentUnder?: number;
    medicalExclusions: boolean;
    notes: string[];
  };
  booking:
    | { mode: 'slots'; resource: Resource; unitsPerPerson: number }
    | {
        mode: 'session';
        resource: Resource;
        minGroup: number;
        maxGroup: number;
        leadHours: number;
        weekdays: number[];
        minutes: number;
      }
    | { mode: 'enquiry' };
  facts: { label: string; value: string }[];
  image: ImageSlug;
  cardImage?: ImageSlug;
  badge?: string;
  seo: { title: string; description: string };
};

export const medicalExclusions = [
  'Severe asthma',
  'Epilepsy',
  'Cardio or respiratory disorders',
  'Hypertension',
  'Skeletal weakness, joint or ligament problems',
  'Pregnancy',
  'Being under the influence of alcohol or other drugs',
  'Any other medical condition that should stop you taking part',
];

export const addons: Record<AddonId, { id: AddonId; name: string; price: number; blurb: string }> = {
  video: {
    id: 'video',
    name: 'Full HD video',
    price: 170,
    blurb: 'Your whole jump, filmed and edited by our multimedia crew. Per person, per activity.',
  },
  photos: {
    id: 'photos',
    name: 'Photo pack',
    price: 100,
    blurb: 'The best stills of your jump. Per person, per activity.',
  },
};

export const activities: Activity[] = [
  {
    id: 'bungee-jump',
    name: 'Bungee Jump',
    short: '100m from the bridge between the towers',
    headline: 'Jump from the top.',
    description: [
      'Step off the suspension bridge strung between the two cooling towers and drop 100 metres over Soweto. It is the jump that put the towers on the map, and the one people talk about for years.',
      'Our jump masters rig and run every jump. Your weight is checked before you pay and again on the bridge, and every jumper gets a free 10-second Scream Clip on WhatsApp. Add the full HD video to keep the whole thing.',
    ],
    price: 630,
    group: { min: 6, price: 580 },
    includes: ['100m bungee from the suspension bridge', 'Safety briefing and all equipment', 'Free 10-second Scream Clip on WhatsApp'],
    videoIncluded: false,
    addons: ['video', 'photos'],
    rules: {
      minWeightKg: 35,
      maxWeightKg: 110,
      minAge: 12,
      consentUnder: 18,
      medicalExclusions: true,
      notes: [
        'No tandem jumps. One jumper at a time keeps everyone safe.',
        'Wear comfortable clothes you can jump in (preferably no skirts) and closed shoes.',
        'Bring sunscreen. The bridge is exposed.',
      ],
    },
    booking: { mode: 'slots', resource: 'bridge', unitsPerPerson: 1 },
    facts: [
      { label: 'Drop', value: '100 m' },
      { label: 'Weight', value: '35–110 kg' },
      { label: 'Age', value: '12+' },
      { label: 'Groups of 6+', value: 'R580 each' },
    ],
    image: 'bungee-between-towers',
    cardImage: 'bungee-pov-edge',
    badge: 'Most popular',
    seo: {
      title: '100m Bungee Jump in Soweto',
      description:
        'Bungee jump 100m from the bridge between the Soweto Towers (Orlando Towers). R630, or R580 each for groups of 6+. Book a timed slot and get your Scream Clip on WhatsApp.',
    },
  },
  {
    id: 'straightjacket-bungee',
    name: 'Straightjacket Bungee',
    short: 'Same 100m drop. Arms strapped in.',
    headline: 'No arms. All nerve.',
    description: [
      'We buckle you into our custom-made straitjacket, arms wrapped tight around your body, and you tumble off the bridge without them. Same 100m drop, a far more intense ride.',
      'Preparation takes the crew longer, so straightjacket jumps take a little more of the bridge’s time. Multimedia video is included in the price.',
    ],
    price: 1030,
    includes: ['100m straightjacket bungee from the suspension bridge', 'Multimedia video included', 'Safety briefing and all equipment'],
    videoIncluded: true,
    addons: ['photos'],
    rules: {
      minWeightKg: 35,
      maxWeightKg: 110,
      minAge: 12,
      consentUnder: 18,
      medicalExclusions: true,
      notes: ['Wear comfortable clothes you can jump in and closed shoes.', 'The jacket goes on at the top. Your jump master talks you through every buckle.'],
    },
    booking: { mode: 'slots', resource: 'bridge', unitsPerPerson: 2 },
    facts: [
      { label: 'Drop', value: '100 m' },
      { label: 'Weight', value: '35–110 kg' },
      { label: 'Video', value: 'Included' },
      { label: 'Age', value: '12+' },
    ],
    image: 'before-the-drop',
    seo: {
      title: 'Straightjacket Bungee Jump, Soweto',
      description:
        'A 100m bungee with your arms strapped into a straitjacket, from the bridge between the Soweto Towers (Orlando Towers). R1,030 with video included. Book online.',
    },
  },
  {
    id: 'scad-freefall',
    name: 'SCAD Freefall',
    short: 'Freefall inside the Western Cooling Tower',
    headline: 'Fall inside the tower.',
    description: [
      'SCAD stands for Suspended Catch Air Device. You hang inside the Western Cooling Tower, the crew releases you, and you freefall onto a catch net with no cord at all. It is the world’s highest SCAD freefall.',
      'Video is included with every SCAD freefall. Groups of six or more pay R360 each.',
    ],
    price: 400,
    group: { min: 6, price: 360 },
    includes: ['SCAD freefall inside the cooling tower', 'Multimedia video included', 'Safety briefing and all equipment'],
    videoIncluded: true,
    addons: ['photos'],
    rules: {
      minWeightKg: 35,
      maxWeightKg: 100,
      minAge: 12,
      consentUnder: 18,
      medicalExclusions: true,
      notes: ['The SCAD weight limit is lower than the bungee: 100 kg maximum.', 'Wear comfortable clothes and closed shoes.'],
    },
    booking: { mode: 'slots', resource: 'scad', unitsPerPerson: 1 },
    facts: [
      { label: 'Where', value: 'Inside the tower' },
      { label: 'Weight', value: '35–100 kg' },
      { label: 'Video', value: 'Included' },
      { label: 'Groups of 6+', value: 'R360 each' },
    ],
    image: 'scad-freefall',
    seo: {
      title: 'SCAD Freefall Inside a Cooling Tower',
      description:
        'Freefall onto a catch net inside the Western Cooling Tower at Soweto Towers (Orlando Towers). R400 with video included, R360 each for groups of 6+. Book online.',
    },
  },
  {
    id: 'zipline',
    name: 'Zipline',
    short: '700m across the Orlando Dam',
    headline: 'Fly the dam.',
    description: [
      'Clip in and ride 700 metres across the Orlando Dam with the towers at your back. When you land, hitch a free ride back to the towers.',
      'Add the video or the photo pack to keep the ride.',
    ],
    price: 400,
    includes: ['700m zipline over the Orlando Dam', 'Free ride back to the towers', 'Safety briefing and all equipment'],
    videoIncluded: false,
    addons: ['video', 'photos'],
    rules: {
      consentUnder: 18,
      medicalExclusions: true,
      notes: ['Our crew confirms weight and fit on the day.', 'Wear comfortable clothes and closed shoes.'],
    },
    booking: { mode: 'slots', resource: 'zipline', unitsPerPerson: 1 },
    facts: [
      { label: 'Length', value: '700 m' },
      { label: 'Over', value: 'Orlando Dam' },
      { label: 'Ride back', value: 'Free' },
      { label: 'Price', value: 'R400' },
    ],
    image: 'zipline-orlando-dam',
    seo: {
      title: '700m Zipline over the Orlando Dam',
      description:
        'Ride a 700m zipline across the Orlando Dam from Soweto Towers (Orlando Towers), with a free ride back. R400. Add video or photos and book online.',
    },
  },
  {
    id: 'paintball',
    name: 'Paintball',
    short: 'An arena in the base of the cooling tower',
    headline: 'Game on, inside the tower.',
    description: [
      'Serious fun for groups in an arena at the bottom of the Western Cooling Tower. Every player gets 200 balls, one cylinder refill, a mask and overall rental, and each game runs for an hour.',
      'Sessions take 2 to 10 players. For bigger groups, book more than one session.',
    ],
    price: 200,
    includes: ['One-hour game', '200 balls and one cylinder refill', 'Mask and overall rental'],
    videoIncluded: false,
    addons: [],
    rules: {
      minAge: 12,
      consentUnder: 18,
      medicalExclusions: false,
      notes: [
        'Book at least 24 hours ahead. Walk-ins are welcome when the arena is free; bookings take preference.',
        'Bookings are for the date and time chosen. No-shows forfeit payment, and there are no refunds or vouchers for players who cancel, don’t arrive or choose not to take part.',
      ],
    },
    booking: { mode: 'session', resource: 'arena', minGroup: 2, maxGroup: 10, leadHours: 24, weekdays: [5, 6, 0], minutes: 60 },
    facts: [
      { label: 'Players', value: '2–10' },
      { label: 'Game', value: '1 hour' },
      { label: 'Age', value: '12+' },
      { label: 'Price', value: 'R200 each' },
    ],
    image: 'paintball-arena',
    seo: {
      title: 'Paintball inside a Cooling Tower, Soweto',
      description:
        'Paintball for 2 to 10 players in an arena inside the base of the Soweto Towers (Orlando Towers). R200 each with 200 balls, mask and overalls. Book 24 hours ahead.',
    },
  },
  {
    id: 'lift-ride',
    name: 'Lift Ride & View',
    short: 'Up the outside of the tower to a 360° view',
    headline: 'See Soweto from the top.',
    description: [
      'Travel up the side of the Western Cooling Tower in our lift and step onto the viewing platform for a 360-degree view of Soweto and the city beyond.',
      'No jump required. It is the best seat in the house for friends and family watching the jumpers, and groups of ten or more pay R70 each.',
    ],
    price: 80,
    group: { min: 10, price: 70 },
    includes: ['Lift ride up the outside of the tower', 'Time on the viewing platform'],
    videoIncluded: false,
    addons: [],
    rules: {
      minAge: 12,
      consentUnder: 18,
      medicalExclusions: false,
      notes: ['No children under 12 at the top of the tower.'],
    },
    booking: { mode: 'slots', resource: 'lift', unitsPerPerson: 1 },
    facts: [
      { label: 'View', value: '360°' },
      { label: 'Jump', value: 'Not needed' },
      { label: 'Age', value: '12+' },
      { label: 'Groups of 10+', value: 'R70 each' },
    ],
    image: 'lift-ride-view',
    seo: {
      title: 'Lift Ride & 360° View over Soweto',
      description:
        'Ride the lift up the outside of the Soweto Towers (Orlando Towers) for a 360-degree view over Soweto. R80, or R70 each for groups of 10+. No jump needed.',
    },
  },
  {
    id: 'base-jump',
    name: 'Base Jump',
    short: 'For experienced skydivers only',
    headline: 'For the experienced.',
    description: [
      'Soweto Towers is base-jump friendly. Base jumps are only for skydivers with more than 100 freefalls, and our base jump co-ordinator screens every applicant before a jump is arranged.',
      'Send your details and logbook summary through the form below and the co-ordinator will be in touch.',
    ],
    price: 200,
    includes: ['Access to jump from the towers', 'Safety briefing'],
    videoIncluded: false,
    addons: [],
    rules: {
      consentUnder: 18,
      medicalExclusions: true,
      notes: ['Only for skydivers with more than 100 freefalls.', 'Every jump is pre-arranged with the base jump co-ordinator.'],
    },
    booking: { mode: 'enquiry' },
    facts: [
      { label: 'Experience', value: '100+ freefalls' },
      { label: 'Booking', value: 'By arrangement' },
      { label: 'Price', value: 'R200' },
    ],
    image: 'towers-sunset-panorama',
    seo: {
      title: 'Base Jumping at the Towers',
      description:
        'Base jumping from the Soweto Towers (Orlando Towers) for experienced skydivers with 100+ freefalls, arranged with our base jump co-ordinator. Apply online.',
    },
  },
];

export type PackageId = 'the-jump' | 'jump-film' | 'full-tower';

export type Package = {
  id: PackageId;
  name: string;
  price: number;
  saving: number;
  blurb: string;
  includes: string[];
  /** What the package books, per person. */
  components: { activityId: ActivityId; video: boolean }[];
  recommended?: boolean;
};

export const packages: Package[] = [
  {
    id: 'the-jump',
    name: 'The Jump',
    price: 630,
    saving: 0,
    blurb: '100m bungee jump and a free 10-second Scream Clip.',
    includes: ['100m bungee jump', 'Free 10-second Scream Clip'],
    components: [{ activityId: 'bungee-jump', video: false }],
  },
  {
    id: 'jump-film',
    name: 'Jump + Film',
    price: 760,
    saving: 40,
    blurb: 'Bungee jump, Scream Clip and the full edited HD video.',
    includes: ['100m bungee jump', 'Free 10-second Scream Clip', 'Full edited HD video'],
    components: [{ activityId: 'bungee-jump', video: true }],
    recommended: true,
  },
  {
    id: 'full-tower',
    name: 'The Full Tower',
    price: 1090,
    saving: 110,
    blurb: 'Bungee jump, SCAD freefall with video and the full bungee video.',
    includes: ['100m bungee jump with full HD video', 'SCAD freefall with video', 'Free 10-second Scream Clip'],
    components: [
      { activityId: 'bungee-jump', video: true },
      { activityId: 'scad-freefall', video: false },
    ],
  },
];

export const DEFAULT_PACKAGE: PackageId = 'jump-film';

export function getActivity(id: string): Activity | undefined {
  return activities.find((a) => a.id === id);
}

export function getPackage(id: string): Package | undefined {
  return packages.find((p) => p.id === id);
}

export const bookableActivities = activities.filter((a) => a.booking.mode !== 'enquiry');

export const lowestJumpPrice = Math.min(...activities.filter((a) => a.id === 'bungee-jump').map((a) => a.price));

export const priceRange = {
  min: Math.min(...activities.map((a) => a.price)),
  max: Math.max(...packages.map((p) => p.price), ...activities.map((a) => a.price)),
};
