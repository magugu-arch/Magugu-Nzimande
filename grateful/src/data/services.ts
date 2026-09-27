import type { Service } from '../../shared/types';

/**
 * The service catalogue. This is the seed: in production the services table
 * is the source of truth (see supabase/seed.sql), so prices, deposits and
 * durations are edited there without a deploy.
 *
 * No prices have been supplied, so every service is "Quote required" and books
 * without payment. Set priceCents (and optionally depositCents) in the
 * database and the booking flow starts taking payment for that service —
 * nothing in the UI needs to change.
 *
 * Durations are working estimates for scheduling. Confirm them with the studio.
 */
export const serviceSeed: Service[] = [
  {
    id: 'consultation',
    slug: 'consultation',
    name: 'Consultation & Concept Development',
    description:
      'A first conversation about you, the occasion and the idea. We talk through silhouette, fabric and how you want to feel, and shape a direction for the piece.',
    durationMinutes: 60,
    priceCents: null,
    depositCents: null,
    image: 'whiteGarment',
    sortOrder: 1,
    active: true,
  },
  {
    id: 'custom-design',
    slug: 'custom-design',
    name: 'Custom Fashion Design',
    description:
      'A garment designed and made around you, from sketch and pattern to cut, construction and finish, with fittings along the way.',
    durationMinutes: 90,
    priceCents: null,
    depositCents: null,
    image: 'styledLook',
    sortOrder: 2,
    active: true,
  },
  {
    id: 'fittings',
    slug: 'fittings',
    name: 'Fittings & Alterations',
    description:
      'Measured fittings for pieces in progress, and considered alterations that bring an existing garment back to the body it belongs to.',
    durationMinutes: 45,
    priceCents: null,
    depositCents: null,
    image: 'burgundyDetail',
    sortOrder: 3,
    active: true,
  },
  {
    id: 'special-occasion',
    slug: 'special-occasion',
    name: 'Special Occasion / Bespoke Garments',
    description:
      'For the days that matter most. A bespoke piece built for one moment, with the time and attention that moment deserves.',
    durationMinutes: 90,
    priceCents: null,
    depositCents: null,
    image: 'burgundyDetail',
    sortOrder: 4,
    active: true,
  },
];
