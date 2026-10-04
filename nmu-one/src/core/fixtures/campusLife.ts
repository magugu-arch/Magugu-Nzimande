/**
 * SYNTHETIC DEMO DATA — library, shuttle, residence and dining. Vendor names,
 * menus, prices, routes and timings are invented for demonstration.
 */
import type {
  LibraryResource,
  MenuItem,
  Residence,
  ServiceDisruption,
  ShuttleRoute,
  StudySpace,
  Vendor,
} from '../domain/models';
import { zar } from '../domain/money';
import { addDays, sastDate, sastParts } from '../time/sast';

// ── Library ─────────────────────────────────────────────────────────────────

export const libraryCatalogue: LibraryResource[] = [
  { id: 'lr1', title: 'Principles of Marketing', authors: ['Demo Editorial Team'], year: 2023, kind: 'book', availability: 'available', location: 'Level 2', callNumber: '658.8 KOT' },
  { id: 'lr2', title: 'Consumer Behaviour in South Africa', authors: ['Demo Editorial Team'], year: 2022, kind: 'book', availability: 'on-loan', location: 'Level 2', callNumber: '658.834 CON' },
  { id: 'lr3', title: 'Digital Marketing Strategy', authors: ['Demo Editorial Team'], year: 2022, kind: 'ebook', availability: 'online', location: null, callNumber: null },
  { id: 'lr4', title: 'Marketing Research Essentials', authors: ['Demo Editorial Team'], year: 2021, kind: 'book', availability: 'available', location: 'Level 3', callNumber: '658.83 MAR' },
  { id: 'lr5', title: 'Marketing journals collection (online)', authors: [], year: 2026, kind: 'journal', availability: 'online', location: null, callNumber: null },
  { id: 'lr6', title: 'Business research database (online)', authors: [], year: 2026, kind: 'database', availability: 'online', location: null, callNumber: null },
  { id: 'lr7', title: 'Brand Management: An African Perspective', authors: ['Demo Editorial Team'], year: 2020, kind: 'book', availability: 'available', location: 'Level 2', callNumber: '658.827 BRA' },
  { id: 'lr8', title: 'Statistics for Business and Economics', authors: ['Demo Editorial Team'], year: 2019, kind: 'book', availability: 'on-loan', location: 'Level 3', callNumber: '519.5 STA' },
];

/**
 * Hourly slots for a day. Free/taken is a fixed pattern per room so the demo
 * always has rooms free "this afternoon" (brief §6's example answer).
 */
export function studySpaces(day: Date, now: Date): StudySpace[] {
  const { year, month, day: d } = sastParts(day);
  const rooms: { id: string; name: string; floor: number; capacity: number; features: string[]; taken: number[] }[] = [
    { id: 'gr1', name: 'Group Room 1', floor: 2, capacity: 6, features: ['Screen', 'Whiteboard'], taken: [10, 11, 15] },
    { id: 'gr2', name: 'Group Room 2', floor: 2, capacity: 4, features: ['Whiteboard'], taken: [10, 12, 13] },
    { id: 'gr3', name: 'Group Room 3', floor: 3, capacity: 8, features: ['Screen', 'Video calls'], taken: [11, 14, 16, 17] },
    { id: 'sp1', name: 'Silent Pod 1', floor: 4, capacity: 1, features: ['Silent', 'Power'], taken: [10, 13] },
  ];
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    buildingId: 'lib',
    floor: r.floor,
    capacity: r.capacity,
    features: r.features,
    slots: Array.from({ length: 10 }, (_, i) => 10 + i).map((h) => {
      const start = sastDate(year, month, d, h);
      return {
        start: start.toISOString(),
        end: sastDate(year, month, d, h + 1).toISOString(),
        available: !r.taken.includes(h) && start > now,
      };
    }),
  }));
}

// ── Transport ───────────────────────────────────────────────────────────────

export const shuttleRoutes: ShuttleRoute[] = [
  {
    id: 'route-a',
    code: 'A',
    name: 'South ↔ North Campus',
    status: 'on-time',
    frequencyMinutes: 20,
    firstDeparture: '06:45',
    lastDeparture: '22:05',
    lateNight: false,
    stops: [
      { id: 'stop-si', name: 'Shuttle Interchange', campus: 'south', buildingId: 'si' },
      { id: 'stop-gate', name: 'Main Gate', campus: 'south' },
      { id: 'stop-north', name: 'North Campus Main', campus: 'north' },
    ],
  },
  {
    id: 'route-b',
    code: 'B',
    name: 'South ↔ Second Avenue',
    status: 'delayed',
    statusNote: 'Running about 5 minutes late because of roadworks.',
    frequencyMinutes: 30,
    firstDeparture: '07:00',
    lastDeparture: '19:00',
    lateNight: false,
    stops: [
      { id: 'stop-si', name: 'Shuttle Interchange', campus: 'south', buildingId: 'si' },
      { id: 'stop-2nd', name: 'Second Avenue Campus', campus: 'second-avenue' },
    ],
  },
  {
    id: 'route-n',
    code: 'N',
    name: 'Late-night Residence Loop',
    status: 'on-time',
    frequencyMinutes: 30,
    firstDeparture: '18:00',
    lastDeparture: '00:30',
    lateNight: true,
    stops: [
      { id: 'stop-lib', name: 'Library Square', campus: 'south', buildingId: 'lib' },
      { id: 'stop-si', name: 'Shuttle Interchange', campus: 'south', buildingId: 'si' },
      { id: 'stop-rv', name: 'Residence Village', campus: 'south', buildingId: 'rv' },
    ],
  },
];

/** Minutes from a route's first stop to each later stop. */
export const stopOffsets: Record<string, number[]> = {
  'route-a': [0, 3, 14],
  'route-b': [0, 22],
  'route-n': [0, 4, 9],
};

/** Minutes of delay applied to a route's timetable while it is disrupted. */
export const routeDelayMinutes: Record<string, number> = { 'route-a': 0, 'route-b': 5, 'route-n': 0 };

export const disruptions: ServiceDisruption[] = [
  {
    id: 'd1',
    routeId: 'route-b',
    title: 'Route B running late',
    detail: 'Roadworks on the way to Second Avenue are adding about 5 minutes.',
    severity: 'minor',
    until: null,
  },
];

// ── Residence ───────────────────────────────────────────────────────────────

export function residence(now: Date): Residence {
  const { year } = sastParts(now);
  return {
    id: 'res-rv',
    name: 'Residence Village',
    campus: 'south',
    buildingId: 'rv',
    block: 'Block C',
    room: 'C214',
    checkIn: { status: 'complete', date: sastDate(year, 1, 29, 10).toISOString() },
    office: { name: 'Residence Village office', hours: 'Weekdays 08:00–16:00' },
    requests: [
      {
        id: 'rr-1',
        category: 'maintenance',
        description: 'Desk lamp in C214 flickers and switches off.',
        status: 'in-progress',
        createdAt: addDays(now, -2).toISOString(),
        reference: 'RV-20418',
      },
    ],
  };
}

// ── Dining and commerce ─────────────────────────────────────────────────────

const weekdays = (open: string, close: string) => [{ days: 'Mon–Fri', open, close }];

export const vendors: Vendor[] = [
  {
    id: 'campus-kitchen',
    name: 'Campus Kitchen',
    buildingId: 'sc',
    campus: 'south',
    cuisine: 'Bowls, grills and fresh salads',
    hours: weekdays('07:00', '19:00'),
    isOpen: true,
    prepMinutes: 12,
    acceptsOrders: true,
    pickupPoint: 'Counter 2, Student Centre',
  },
  {
    id: 'commons-coffee',
    name: 'Commons Coffee',
    buildingId: 'lib',
    campus: 'south',
    cuisine: 'Coffee, toasties and baking',
    hours: weekdays('07:30', '21:00'),
    isOpen: true,
    prepMinutes: 6,
    acceptsOrders: true,
    pickupPoint: 'Library ground floor',
  },
  {
    id: 'bay-grill',
    name: 'Bay Grill',
    buildingId: 'sc',
    campus: 'south',
    cuisine: 'Flame-grilled chicken and wraps',
    hours: weekdays('10:00', '16:00'),
    isOpen: true,
    prepMinutes: 15,
    acceptsOrders: true,
    pickupPoint: 'Bay Grill window, Student Centre',
  },
  {
    id: 'green-corner',
    name: 'Green Corner',
    buildingId: 'mh',
    campus: 'south',
    cuisine: 'Plant-based plates',
    hours: [{ days: 'Tue–Thu', open: '08:00', close: '15:00' }],
    isOpen: false,
    prepMinutes: 10,
    acceptsOrders: false,
    pickupPoint: 'Main Hall foyer',
  },
];

const item = (
  vendorId: string,
  id: string,
  name: string,
  description: string,
  rands: number,
  category: string,
  dietary: MenuItem['dietary'] = [],
  available = true,
): MenuItem => ({ id, vendorId, name, description, price: zar(rands), dietary, available, category });

export const menus: Record<string, MenuItem[]> = {
  'campus-kitchen': [
    item('campus-kitchen', 'ck-bowl-chicken', 'Peri-peri chicken bowl', 'Grilled chicken, spiced rice, charred corn and greens.', 62, 'Bowls', ['halaal']),
    item('campus-kitchen', 'ck-bowl-veg', 'Roast veg & chickpea bowl', 'Roasted butternut, chickpeas, quinoa and tahini.', 55, 'Bowls', ['vegan', 'gluten-free']),
    item('campus-kitchen', 'ck-bowl-beef', 'Beef & umngqusho bowl', 'Slow-cooked beef over samp and beans.', 68, 'Bowls', ['halaal']),
    item('campus-kitchen', 'ck-salad', 'Garden salad', 'Leaves, cucumber, tomato, feta and seeds.', 42, 'Salads', ['vegetarian', 'gluten-free']),
    item('campus-kitchen', 'ck-juice', 'Fresh orange juice', '330 ml, squeezed this morning.', 24, 'Drinks', ['vegan', 'gluten-free']),
    item('campus-kitchen', 'ck-water', 'Still water', '500 ml.', 12, 'Drinks', ['vegan', 'gluten-free']),
  ],
  'commons-coffee': [
    item('commons-coffee', 'cc-flat-white', 'Flat white', 'Double shot, steamed milk.', 28, 'Coffee', ['vegetarian']),
    item('commons-coffee', 'cc-rooibos', 'Rooibos latte', 'Rooibos espresso with steamed milk.', 26, 'Coffee', ['vegetarian']),
    item('commons-coffee', 'cc-toastie', 'Cheese & tomato toastie', 'On sourdough.', 38, 'Food', ['vegetarian']),
    item('commons-coffee', 'cc-muffin', 'Bran muffin', 'Baked this morning.', 22, 'Food', ['vegetarian', 'contains-nuts']),
  ],
  'bay-grill': [
    item('bay-grill', 'bg-wrap', 'Grilled chicken wrap', 'Chicken, slaw and garlic sauce.', 58, 'Wraps', ['halaal']),
    item('bay-grill', 'bg-quarter', 'Quarter chicken & chips', 'Flame-grilled, lemon and herb.', 72, 'Meals', ['halaal', 'gluten-free']),
    item('bay-grill', 'bg-halloumi', 'Halloumi wrap', 'Grilled halloumi, peppers and hummus.', 61, 'Wraps', ['vegetarian']),
    item('bay-grill', 'bg-ribs', 'Rib & chips combo', 'Sold out today.', 89, 'Meals', [], false),
  ],
  'green-corner': [
    item('green-corner', 'gc-curry', 'Lentil curry', 'With brown rice.', 48, 'Plates', ['vegan', 'gluten-free']),
  ],
};
