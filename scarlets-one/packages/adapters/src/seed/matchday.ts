import {
  tx,
  type ChecklistItem,
  type GuideBlock,
  type GuideSection,
  type HospitalityPackage,
  type VenuePoint,
} from '@scarlets/domain';
import { officialLinks } from '../config';

/**
 * DEMO MATCHDAY GUIDE.
 *
 * A wrong venue fact can strand someone, so this seed invents none. Each
 * block says what will be published there and who supplies it, and is marked
 * "awaiting approval". The schematic's points are placeholders on an
 * illustrative layout: the venue's approved map replaces all of them.
 */

const AWAITING = 'awaiting_approval' as const;

const official = (id: keyof typeof officialLinks) => ({
  label: officialLinks[id].label,
  url: officialLinks[id].url,
  kind: 'official_link' as const,
});

const block = (
  id: string,
  icon: string,
  title: [string, string?],
  body: string,
  action?: GuideBlock['action'],
): GuideBlock => ({
  id,
  icon,
  title: tx(title[0], title[1]),
  body: tx(body),
  approval: AWAITING,
  action,
});

export const guideSections: GuideSection[] = [
  {
    id: 'tickets',
    icon: 'ticket-outline',
    title: tx('Tickets', 'Tocynnau'),
    summary: tx('Buy, find and manage your tickets.', 'Prynu, dod o hyd i’ch tocynnau a’u rheoli.'),
    mediaId: 'app-in-hand',
    blocks: [
      block(
        'buy',
        'cart-outline',
        ['Buy tickets', 'Prynu tocynnau'],
        'Tickets are sold through the club’s official ticketing service. Scarlets One takes you there. It does not sell tickets or take payment.',
        official('tickets'),
      ),
      block(
        'manage',
        'person-circle-outline',
        ['Your ticket account', 'Eich cyfrif tocynnau'],
        'Your e-tickets live in your official ticket account. The barcode is never copied into this app.',
        official('tickets'),
      ),
      block(
        'season',
        'calendar-outline',
        ['Season tickets', 'Tocynnau tymor'],
        'Packages and benefits for 2026/27 are on the club’s season-ticket page.',
        official('seasonTickets'),
      ),
    ],
  },
  {
    id: 'wallet',
    icon: 'wallet-outline',
    title: tx('Phone wallet', 'Waled ffôn'),
    summary: tx(
      'Add a digital ticket to Apple Wallet or Google Wallet.',
      'Ychwanegu tocyn digidol at eich waled.',
    ),
    mediaId: 'passport-phone',
    blocks: [
      block(
        'how',
        'phone-portrait-outline',
        ['Adding your ticket', 'Ychwanegu eich tocyn'],
        'The club has described digital season tickets for 2026/27. Where the ticketing service offers a wallet pass, you add it from your official ticket account, not from this app.',
        official('tickets'),
      ),
      block(
        'offline',
        'cloud-offline-outline',
        ['Before you travel', 'Cyn i chi deithio'],
        'Add your ticket while you have a good connection. Signal can be weak in a full stadium.',
      ),
    ],
  },
  {
    id: 'travel',
    icon: 'navigate-outline',
    title: tx('Travel', 'Teithio'),
    summary: tx('Getting to Parc y Scarlets.', 'Cyrraedd Parc y Scarlets.'),
    mediaId: 'travel-together',
    blocks: [
      block(
        'official',
        'map-outline',
        ['Official travel guidance', 'Canllawiau teithio swyddogol'],
        'Routes, parking and public transport are published by the club. This section shows that guidance once the venue team approves it for the app.',
        official('travel'),
      ),
      block(
        'parking',
        'car-outline',
        ['Parking', 'Parcio'],
        'Car park locations, opening times and any matchday restrictions, supplied by stadium operations.',
      ),
      block(
        'public-transport',
        'bus-outline',
        ['Public transport', 'Trafnidiaeth gyhoeddus'],
        'Rail and bus links, with operator notices where an approved source provides them.',
      ),
      block(
        'arrive',
        'time-outline',
        ['When to arrive', 'Pryd i gyrraedd'],
        'The recommended arrival time for this fixture, set by the venue team.',
      ),
    ],
  },
  {
    id: 'map',
    icon: 'location-outline',
    title: tx('Venue map', 'Map y stadiwm'),
    summary: tx(
      'Entrances, facilities and step-free routes.',
      'Mynedfeydd, cyfleusterau a llwybrau di-ris.',
    ),
    mediaId: 'volunteer-welcome',
    blocks: [],
  },
  {
    id: 'access',
    icon: 'accessibility-outline',
    title: tx('Accessibility', 'Hygyrchedd'),
    summary: tx('Planning an accessible visit.', 'Cynllunio ymweliad hygyrch.'),
    mediaId: 'accessible-matchday',
    blocks: [
      block(
        'contact',
        'call-outline',
        ['Talk to the team first', 'Siaradwch â’r tîm yn gyntaf'],
        'The quickest way to get the right answer for your visit is to contact the club before you travel.',
        official('accessibility'),
      ),
      block(
        'viewing',
        'eye-outline',
        ['Accessible viewing', 'Gwylio hygyrch'],
        'Wheelchair-user and ambulant viewing areas, from the club’s disabled supporters policy.',
      ),
      block(
        'step-free',
        'trending-up-outline',
        ['Step-free routes', 'Llwybrau di-ris'],
        'Verified step-free routes from each entrance, drawn on the venue map once the venue supplies them.',
      ),
      block(
        'toilets',
        'water-outline',
        ['Accessible toilets', 'Toiledau hygyrch'],
        'Locations of accessible toilets and any changing facilities.',
      ),
      block(
        'companions',
        'people-outline',
        ['Companions and carers', 'Cymdeithion a gofalwyr'],
        'The club’s policy on companion and carer tickets.',
      ),
      block(
        'sensory',
        'ear-outline',
        ['Sensory information', 'Gwybodaeth synhwyraidd'],
        'Noise, lighting and quiet-space information. Published only after the venue confirms what is available.',
      ),
    ],
  },
  {
    id: 'food',
    icon: 'restaurant-outline',
    title: tx('Food and drink', 'Bwyd a diod'),
    summary: tx('Outlets, menus and allergens.', 'Stondinau, bwydlenni ac alergenau.'),
    mediaId: 'concourse-food',
    blocks: [
      block(
        'outlets',
        'storefront-outline',
        ['Concourse outlets', 'Stondinau’r cyntedd'],
        'Outlet locations and opening times, supplied by the catering operator.',
      ),
      block(
        'allergens',
        'alert-circle-outline',
        ['Allergens', 'Alergenau'],
        'Allergen information comes directly from the caterer and is never summarised or guessed by the app. Always check with staff at the outlet.',
      ),
      block(
        'preorder',
        'bag-check-outline',
        ['Order ahead', 'Archebu ymlaen llaw'],
        'Not available. Pre-ordering opens only after the caterer’s system is connected and the service is confirmed to work on a matchday.',
      ),
    ],
  },
  {
    id: 'village',
    icon: 'flag-outline',
    title: tx('Supporters Village', 'Pentref y Cefnogwyr'),
    summary: tx(
      'Activities and timings before kick-off.',
      'Gweithgareddau ac amseroedd cyn y gic gyntaf.',
    ),
    mediaId: 'fan-zone-activation',
    blocks: [
      block(
        'whats-on',
        'calendar-outline',
        ['What’s on', 'Beth sydd ymlaen'],
        'Activities and timings for this fixture, as published by the club and venue.',
      ),
      block(
        'families',
        'happy-outline',
        ['For families', 'I deuluoedd'],
        'Family activities appear here when the club confirms them for the fixture.',
      ),
    ],
  },
  {
    id: 'crew',
    icon: 'people-circle-outline',
    title: tx('Bring your crew', 'Dewch â’ch criw'),
    summary: tx(
      'Share the fixture and agree where to meet.',
      'Rhannwch y gêm a chytunwch ble i gwrdd.',
    ),
    mediaId: 'meeting-point',
    blocks: [
      block(
        'group',
        'ticket-outline',
        ['Group bookings', 'Archebion grŵp'],
        'Coming as a club, school or workplace? Group enquiries go to the ticket office.',
        official('tickets'),
      ),
    ],
  },
  {
    id: 'hospitality',
    icon: 'wine-outline',
    title: tx('Hospitality', 'Lletygarwch'),
    summary: tx('Lounges and matchday packages.', 'Lolfeydd a phecynnau diwrnod gêm.'),
    mediaId: 'hospitality-lounge',
    blocks: [
      block(
        'enquire',
        'mail-outline',
        ['Make an enquiry', 'Gwneud ymholiad'],
        'Packages, prices and availability are held by the club’s hospitality team.',
        official('hospitality'),
      ),
      block(
        'before',
        'information-circle-outline',
        ['Before you arrive', 'Cyn i chi gyrraedd'],
        'Dress and access information is sent to guests ahead of the event.',
      ),
    ],
  },
];

const point = (
  id: string,
  kind: VenuePoint['kind'],
  label: [string, string?],
  x: number,
  y: number,
  note?: string,
): VenuePoint => ({
  id,
  kind,
  label: tx(label[0], label[1]),
  x,
  y,
  note: note ? tx(note) : undefined,
});

/** Placeholder points on the illustrative schematic. Positions mean nothing yet. */
export const venuePoints: VenuePoint[] = [
  point('ent-a', 'entrance', ['Entrance A', 'Mynedfa A'], 0.5, 0.06),
  point('ent-b', 'entrance', ['Entrance B', 'Mynedfa B'], 0.95, 0.5),
  point('ent-c', 'entrance', ['Entrance C', 'Mynedfa C'], 0.5, 0.94),
  point('ent-d', 'entrance', ['Entrance D', 'Mynedfa D'], 0.05, 0.5),
  point('sf-1', 'step_free', ['Step-free route', 'Llwybr di-ris'], 0.3, 0.9),
  point('sf-2', 'step_free', ['Step-free route', 'Llwybr di-ris'], 0.9, 0.3),
  point('wc-1', 'toilet', ['Toilets', 'Toiledau'], 0.22, 0.14),
  point('wc-2', 'toilet', ['Toilets', 'Toiledau'], 0.78, 0.86),
  point('awc-1', 'accessible_toilet', ['Accessible toilet', 'Toiled hygyrch'], 0.78, 0.14),
  point('awc-2', 'accessible_toilet', ['Accessible toilet', 'Toiled hygyrch'], 0.22, 0.86),
  point('food-1', 'food', ['Food and drink', 'Bwyd a diod'], 0.36, 0.1),
  point('food-2', 'food', ['Food and drink', 'Bwyd a diod'], 0.9, 0.66),
  point('food-3', 'food', ['Food and drink', 'Bwyd a diod'], 0.1, 0.34),
  point('shop', 'shop', ['Club shop', 'Siop y clwb'], 0.66, 0.92),
  point('help', 'support', ['Supporter help point', 'Man cymorth cefnogwyr'], 0.62, 0.08),
  point('hosp', 'hospitality', ['Hospitality entrance', 'Mynedfa lletygarwch'], 0.92, 0.82),
  point(
    'meet-main',
    'meeting',
    ['Main entrance', 'Prif fynedfa'],
    0.44,
    0.97,
    'By the main doors.',
  ),
  point(
    'meet-shop',
    'meeting',
    ['Club shop doors', 'Drysau siop y clwb'],
    0.7,
    0.97,
    'Outside the shop.',
  ),
  point(
    'meet-village',
    'meeting',
    ['Supporters Village', 'Pentref y Cefnogwyr'],
    0.16,
    0.97,
    'At the Village entrance.',
  ),
];

export const checklistSeed: ChecklistItem[] = [
  {
    id: 'ticket-ready',
    stage: 'before',
    title: tx('Ticket ready on your phone', 'Tocyn yn barod ar eich ffôn'),
    detail: tx('Open it in your official ticket account or add it to your wallet.'),
    section: 'tickets',
  },
  {
    id: 'route',
    stage: 'before',
    title: tx('Plan how you’re getting there', 'Cynlluniwch sut i gyrraedd'),
    detail: tx('Check the official travel guidance before you set off.'),
    section: 'travel',
  },
  {
    id: 'access-needs',
    stage: 'before',
    title: tx('Sort any access needs', 'Trefnwch unrhyw anghenion mynediad'),
    detail: tx('Contact the club in advance so the team can help.'),
    section: 'access',
  },
  {
    id: 'meeting',
    stage: 'before',
    title: tx('Agree a meeting point', 'Cytunwch ar fan cyfarfod'),
    detail: tx('Pick a spot and share it with your group.'),
    section: 'crew',
  },
  {
    id: 'arrive-early',
    stage: 'arrival',
    title: tx('Arrive with time to spare', 'Cyrhaeddwch mewn da bryd'),
    detail: tx('Gates, queues and the build-up all take time.'),
    section: 'travel',
  },
  {
    id: 'entrance',
    stage: 'arrival',
    title: tx('Find your entrance', 'Dewch o hyd i’ch mynedfa'),
    detail: tx('Your ticket shows which entrance to use.'),
    section: 'map',
  },
  {
    id: 'meet',
    stage: 'arrival',
    title: tx('Meet your crew', 'Cwrdd â’ch criw'),
    detail: tx('Head for the meeting point you agreed.'),
    section: 'crew',
  },
  {
    id: 'food',
    stage: 'inside',
    title: tx('Food and drink', 'Bwyd a diod'),
    detail: tx('See what’s open near you.'),
    section: 'food',
  },
  {
    id: 'facilities',
    stage: 'inside',
    title: tx('Know your nearest facilities', 'Gwybod ble mae’r cyfleusterau agosaf'),
    detail: tx('Toilets, help points and the club shop.'),
    section: 'map',
  },
  {
    id: 'next-visit',
    stage: 'after',
    title: tx('Plan your next visit', 'Cynlluniwch eich ymweliad nesaf'),
    detail: tx('See the next home fixture and bring someone new.'),
    section: 'tickets',
  },
];

export const hospitalitySeed: HospitalityPackage[] = [
  {
    id: 'hosp-lounge',
    title: tx('Matchday lounge', 'Lolfa diwrnod gêm'),
    summary: tx('A table, a view of the pitch and time to talk before kick-off.'),
    mediaId: 'hospitality-lounge',
    includes: [
      tx('What is included appears here once the hospitality team publishes the package.'),
    ],
    enquiryUrl: officialLinks.hospitality.url,
    approval: AWAITING,
  },
  {
    id: 'hosp-partner',
    title: tx('Partner table', 'Bwrdd partner'),
    summary: tx('For partners and their guests: business and rugby together.'),
    mediaId: 'partner-hospitality',
    includes: [
      tx('What is included appears here once the hospitality team publishes the package.'),
    ],
    enquiryUrl: officialLinks.hospitality.url,
    approval: AWAITING,
  },
];
