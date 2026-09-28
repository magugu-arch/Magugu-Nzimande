/**
 * Restaurant events — brief §11. Called "experiences" in code so they are
 * never confused with domain events on the bus.
 */
export type ExperienceKind =
  'wine-pairing' | 'chef-evening' | 'tasting-menu' | 'special-occasion' | 'private-function';

export interface Experience {
  id: string;
  title: string;
  subtitle: string;
  kind: ExperienceKind;
  startsAt: string;
  endsAt: string;
  room: string;
  /** Per guest. null means "Price on request". */
  priceCents: number | null;
  capacity: number;
  seatsBooked: number;
  maxSeatsPerBooking: number;
  waitlistEnabled: boolean;
  description: string;
  menuTeaser?: string[];
  winePartner?: string;
  dressCode?: string;
  ageRule?: string;
  heroPhoto: string;
  bookingRequired: boolean;
  published: boolean;
  /** True for content that is illustrative seed data, not confirmed by Mábu. */
  isSample: boolean;
  updatedAt: string;
}

export type ExperienceBookingStatus =
  'pending_payment' | 'confirmed' | 'waitlisted' | 'cancelled' | 'attended' | 'no-show';

export interface ExperienceBooking {
  id: string;
  reference: string;
  eventId: string;
  guestId: string;
  seats: number;
  status: ExperienceBookingStatus;
  amountCents: number;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export type Availability = 'available' | 'limited' | 'sold-out' | 'waitlist' | 'past';

export function availabilityOf(experience: Experience, now: Date): Availability {
  if (new Date(experience.endsAt).getTime() <= now.getTime()) return 'past';
  const left = experience.capacity - experience.seatsBooked;
  if (left <= 0) return experience.waitlistEnabled ? 'waitlist' : 'sold-out';
  if (left <= Math.max(4, Math.ceil(experience.capacity * 0.15))) return 'limited';
  return 'available';
}
