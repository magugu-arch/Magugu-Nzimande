import type { Promotion, Reward, Store } from '@bbq/types';

/**
 * Two stores at launch. Trading hours, telephone numbers, delivery suburb lists
 * and halaal certification are all demo values pending CLAUDE.md section 8.
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
];

export const PROMOTIONS: readonly Promotion[] = [
  {
    id: 'OF-1',
    title: 'Half and Half Tuesday',
    productSlug: 'half-half',
    code: 'PICKTWO',
    discountRate: 0.15,
    validity: 'Every Tuesday, 11:00 to 22:00',
    copy: 'Two sauces on one bird at the single flavour price. Delivery and collection.',
  },
  {
    id: 'OF-2',
    title: 'Rice Meal for one',
    productSlug: 'chicken-rice',
    code: 'ONETRAY',
    discountRate: 0.1,
    validity: 'Weekdays before 16:00',
    copy: 'Three pieces, rice, slaw and a drink. Built for a lunch break, not a queue.',
  },
  {
    id: 'OF-3',
    title: 'First order, free fries',
    productSlug: 'french-fries',
    code: 'FIRSTCRUNCH',
    discountRate: 0.1,
    validity: 'New accounts, one use',
    copy: 'Create an account and your first delivery order comes with regular fries.',
  },
];

export const REWARDS: readonly Reward[] = [
  { id: 'RW-1', name: 'Regular fries', points: 120 },
  { id: 'RW-2', name: 'Ddeok-Bokki side', points: 220 },
  { id: 'RW-3', name: 'Boneless Chicken', points: 480 },
  { id: 'RW-4', name: 'Half and Half Chicken', points: 700 },
];
