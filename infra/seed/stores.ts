import type { Promotion, Reward, Store } from '@bbq/types';

/**
 * Three stores. Trading hours, telephone numbers, delivery suburb lists and
 * halaal certification are all demo values pending CLAUDE.md section 8.
 *
 * Fourways Crossing closes at 23:00 rather than 22:00, so the estate has at
 * least one store whose hours differ from the others -- a locator that only
 * ever renders identical hours is not really being exercised.
 *
 * Waterfall Ridge has dine-in switched off. That rule is enforced here and in
 * the API, not only in the interface.
 */
export const STORES: readonly Store[] = [
  {
    id: 'ST-CRE',
    name: 'Cresta Crossing',
    address: 'Beyers Naude Drive, Randburg, Johannesburg',
    telephone: '011 000 0000',
    hours: { opensMinute: 11 * 60, closesMinute: 22 * 60, label: '11:00 to 22:00, seven days' },
    distanceKm: 4.2,
    services: { Delivery: true, Collection: true, 'Dine-in': true },
    zones: ['Randburg', 'Northcliff', 'Blackheath', 'Fairland', 'Cresta', 'Linden'],
    halaal: 'Certification confirmed in store',
  },
  {
    id: 'ST-WAT',
    name: 'Waterfall Ridge',
    address: 'Allandale off-ramp, Midrand, Johannesburg',
    telephone: '011 000 0001',
    hours: { opensMinute: 11 * 60, closesMinute: 22 * 60, label: '11:00 to 22:00, seven days' },
    distanceKm: 28.6,
    services: { Delivery: true, Collection: true, 'Dine-in': false },
    zones: ['Midrand', 'Kyalami', 'Sunninghill', 'Waterfall', 'Vorna Valley'],
    halaal: 'Certification confirmed in store',
  },
  {
    id: 'ST-FOU',
    name: 'Fourways Crossing',
    address: 'Witkoppen Road, Fourways, Johannesburg',
    telephone: '011 000 0002',
    hours: { opensMinute: 11 * 60, closesMinute: 23 * 60, label: '11:00 to 23:00, seven days' },
    distanceKm: 17.4,
    services: { Delivery: true, Collection: true, 'Dine-in': true },
    zones: ['Fourways', 'Douglasdale', 'Lonehill', 'Craigavon', 'Dainfern', 'Broadacres'],
    halaal: 'Certification confirmed in store',
  },
];

export const PROMOTIONS: readonly Promotion[] = [
  {
    id: 'OF-1',
    title: 'Half and Half Tuesday',
    productSlug: 'half-half',
    code: 'PICKTWO',
    discountRate: 0.15,
    validity: 'Every Tuesday, 11:00 to 22:00',
    window: { days: [2], fromMinute: 11 * 60, toMinute: 22 * 60, modes: [] },
    firstOrderOnly: false,
    copy: 'Two sauces on one bird at the single flavour price. Delivery and collection.',
  },
  {
    id: 'OF-2',
    title: 'Rice Meal for one',
    productSlug: 'chicken-rice',
    code: 'ONETRAY',
    discountRate: 0.1,
    validity: 'Weekdays before 16:00',
    window: { days: [1, 2, 3, 4, 5], fromMinute: null, toMinute: 16 * 60, modes: [] },
    firstOrderOnly: false,
    copy: 'Three pieces, rice, slaw and a drink. Built for a lunch break, not a queue.',
  },
  {
    id: 'OF-3',
    title: 'First order, free fries',
    productSlug: 'french-fries',
    code: 'FIRSTCRUNCH',
    discountRate: 0.1,
    validity: 'New accounts, one use',
    window: { days: [], fromMinute: null, toMinute: null, modes: ['Delivery'] },
    firstOrderOnly: true,
    copy: 'Create an account and your first delivery order comes with regular fries.',
  },
  {
    id: 'OF-4',
    title: 'Wings Wednesday',
    productSlug: 'honey-garlic-wings',
    code: 'MIDWEEK',
    discountRate: 0.2,
    validity: 'Every Wednesday, 11:00 to close',
    window: { days: [3], fromMinute: 11 * 60, toMinute: null, modes: [] },
    firstOrderOnly: false,
    copy: 'Twenty percent off every sauced wing. Collection and delivery, all three stores.',
  },
  {
    id: 'OF-5',
    title: 'Two sides, one price',
    productSlug: 'sweet-potato-fries',
    code: 'SIDEBYSIDE',
    discountRate: 0.15,
    validity: 'Daily after 20:00',
    window: { days: [], fromMinute: 20 * 60, toMinute: null, modes: [] },
    firstOrderOnly: false,
    copy: 'Add a second side after eight and the cheaper of the two comes off the bill.',
  },
  {
    id: 'OF-6',
    title: 'Student Thursday',
    productSlug: 'boneless',
    code: 'CAMPUS',
    discountRate: 0.15,
    validity: 'Thursdays, with a valid student card at collection',
    // The card is checked at the counter and cannot be checked here. The day
    // and the mode can be, and are.
    window: { days: [4], fromMinute: null, toMinute: null, modes: ['Collection'] },
    firstOrderOnly: false,
    copy: 'Boneless and a side, fifteen percent off, collection only. Card checked in store.',
  },
];

export const REWARDS: readonly Reward[] = [
  { id: 'RW-1', name: 'Regular fries', points: 120 },
  { id: 'RW-5', name: 'Sweet Potato Fries', points: 140 },
  { id: 'RW-2', name: 'Ddeok-Bokki side', points: 220 },
  { id: 'RW-3', name: 'Boneless Chicken', points: 480 },
  { id: 'RW-6', name: 'Sauced Wings', points: 520 },
  { id: 'RW-7', name: 'Wings and Rice Meal', points: 640 },
  { id: 'RW-4', name: 'Half and Half Chicken', points: 700 },
];
