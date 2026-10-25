/**
 * SAMPLE branch content.
 *
 * The brief forbids inventing addresses, phone numbers, hours or branch
 * claims. Every branch here is marked `contentStatus: 'sample'`, carries no
 * street address, phone or Google Business Profile link, and its hours and
 * policies exist only so the sandbox booking engine has rules to apply.
 * Replace this file (or the CMS behind it) with Tashas-approved data before
 * any public release; the UI labels sample content wherever it appears.
 */

import type { BookingPolicy, Branch, ServicePeriod } from '../domain/types.ts';

const SERVICES: ServicePeriod[] = [
  { id: 'breakfast', label: 'Breakfast', firstSeating: '07:00', lastSeating: '11:15' },
  { id: 'lunch', label: 'Lunch', firstSeating: '11:30', lastSeating: '15:30' },
];

const basePolicy: BookingPolicy = {
  version: 'sample-2026-10',
  slotIntervalMinutes: 15,
  holdMinutes: 10,
  minLeadMinutes: 60,
  maxDaysAhead: 30,
  maxOnlinePartySize: 12,
  deposits: [],
  freeCancellationHours: 24,
  lateCancellationRefundPercent: 0,
  graceMinutes: 15,
  noShowRetainsDeposit: true,
  amendCutoffHours: 4,
  waitlist: true,
  seatingOptions: ['No preference', 'Inside'],
  acceptsAccessibilityNotes: true,
  reminderOffsetsHours: [24, 2],
};

const SAMPLE_HOURS = [
  { days: 'Monday to Friday', hours: '07:00 – 16:30' },
  { days: 'Saturday and Sunday', hours: '07:30 – 16:30' },
];

const ZA = { country: 'South Africa', utcOffsetMinutes: 120, timeZone: 'Africa/Johannesburg' };

const common = {
  ...ZA,
  address: null,
  phone: null,
  email: null,
  googleBusinessProfileUrl: null,
  hours: SAMPLE_HOURS,
  services: SERVICES,
  closedWeekdays: [] as number[],
  ordering: false,
  contentStatus: 'sample' as const,
};

export const branches: Branch[] = [
  {
    ...common,
    id: 'rosebank',
    slug: 'rosebank',
    name: 'Tashas Rosebank',
    suburb: 'Rosebank',
    city: 'Johannesburg',
    province: 'Gauteng',
    coords: { lat: -26.146, lng: 28.0436 },
    story: {
      title: 'A long room of oak and morning light',
      body: 'Pendant lights over pale oak tables, a marble counter running the length of the room and plants in every window. Breakfast here is unhurried.',
    },
    heroImageId: 'TASHAS-04',
    galleryImageIds: ['TASHAS-04', 'TASHAS-21', 'TASHAS-09'],
    amenities: ['Indoor seating', 'Espresso bar', 'Bakery counter'],
    policy: {
      ...basePolicy,
      version: 'rosebank-sample-2026-10',
      deposits: [{ id: 'large-party', label: 'Parties of 6 or more', perGuestMinor: 10000, minPartySize: 6 }],
      seatingOptions: ['No preference', 'Inside', 'Window'],
    },
    sandboxCoversPerSlot: 24,
  },
  {
    ...common,
    id: 'hyde-park',
    slug: 'hyde-park',
    name: 'Tashas Hyde Park',
    suburb: 'Hyde Park',
    city: 'Johannesburg',
    province: 'Gauteng',
    coords: { lat: -26.125, lng: 28.035 },
    story: {
      title: 'Timber chairs, marble tables, soft daylight',
      body: 'A quieter room for a slow coffee and a long conversation, with linen, ceramics and flowers on every table.',
    },
    heroImageId: 'TASHAS-26',
    galleryImageIds: ['TASHAS-26', 'TASHAS-15', 'TASHAS-05'],
    amenities: ['Indoor seating', 'Quiet tables'],
    policy: {
      ...basePolicy,
      version: 'hyde-park-sample-2026-10',
      deposits: [
        {
          id: 'weekend-brunch',
          label: 'Weekend breakfast',
          perGuestMinor: 15000,
          minPartySize: 2,
          weekdays: [0, 6],
          periods: ['breakfast'],
        },
        { id: 'large-party', label: 'Parties of 8 or more', perGuestMinor: 10000, minPartySize: 8 },
      ],
    },
    sandboxCoversPerSlot: 18,
  },
  {
    ...common,
    id: 'morningside',
    slug: 'morningside',
    name: 'Tashas Morningside',
    suburb: 'Morningside',
    city: 'Sandton',
    province: 'Gauteng',
    coords: { lat: -26.079, lng: 28.058 },
    story: {
      title: 'Lunch under the pergola',
      body: 'Outdoor tables beneath timber beams and olive trees, with coffee and croissants arriving in the sun.',
    },
    heroImageId: 'TASHAS-19',
    galleryImageIds: ['TASHAS-19', 'TASHAS-25', 'TASHAS-18'],
    amenities: ['Terrace seating', 'Indoor seating'],
    policy: {
      ...basePolicy,
      version: 'morningside-sample-2026-10',
      seatingOptions: ['No preference', 'Inside', 'Terrace'],
    },
    sandboxCoversPerSlot: 28,
  },
  {
    ...common,
    id: 'menlyn',
    slug: 'menlyn',
    name: 'Tashas Menlyn',
    suburb: 'Menlyn',
    city: 'Pretoria',
    province: 'Gauteng',
    coords: { lat: -25.784, lng: 28.277 },
    story: {
      title: 'Plates on pale marble',
      body: 'A light, open room with cream walls and generous tables, made for weekend brunch with family.',
    },
    heroImageId: 'TASHAS-06',
    galleryImageIds: ['TASHAS-06', 'TASHAS-02', 'TASHAS-14'],
    amenities: ['Indoor seating', 'Family tables'],
    policy: {
      ...basePolicy,
      version: 'menlyn-sample-2026-10',
      deposits: [{ id: 'large-party', label: 'Parties of 8 or more', perGuestMinor: 10000, minPartySize: 8 }],
    },
    sandboxCoversPerSlot: 22,
  },
  {
    ...common,
    id: 'va-waterfront',
    slug: 'va-waterfront',
    name: 'Tashas V&A Waterfront',
    suburb: 'V&A Waterfront',
    city: 'Cape Town',
    province: 'Western Cape',
    coords: { lat: -33.9036, lng: 18.4207 },
    story: {
      title: 'Through the glass doors',
      body: 'Olive trees in terracotta at the entrance, tables spilling outside and a bright room behind the glass.',
    },
    heroImageId: 'TASHAS-23',
    galleryImageIds: ['TASHAS-23', 'TASHAS-16', 'TASHAS-17'],
    amenities: ['Outdoor tables', 'Indoor seating'],
    policy: {
      ...basePolicy,
      version: 'va-waterfront-sample-2026-10',
      deposits: [{ id: 'large-party', label: 'Parties of 6 or more', perGuestMinor: 12000, minPartySize: 6 }],
      freeCancellationHours: 48,
      lateCancellationRefundPercent: 50,
      seatingOptions: ['No preference', 'Inside', 'Outside'],
    },
    sandboxCoversPerSlot: 26,
  },
  {
    ...common,
    id: 'umhlanga',
    slug: 'umhlanga',
    name: 'Tashas Umhlanga',
    suburb: 'Umhlanga',
    city: 'Durban',
    province: 'KwaZulu-Natal',
    coords: { lat: -29.726, lng: 31.085 },
    story: {
      title: 'Linen, juice and a late breakfast',
      body: 'Fresh orange juice, cut citrus on stone and a table set for whoever arrives next.',
    },
    heroImageId: 'TASHAS-15',
    galleryImageIds: ['TASHAS-15', 'TASHAS-17', 'TASHAS-03'],
    amenities: ['Indoor seating'],
    policy: {
      ...basePolicy,
      version: 'umhlanga-sample-2026-10',
      waitlist: false,
    },
    sandboxCoversPerSlot: 16,
  },
];
