/**
 * Reservations — brief §7.
 *
 * "Reservation should feel like concierge service."
 *
 * The journey the brief sets out is date → time → party size → seating
 * preference / occasion → details → confirmation, with "progressive
 * disclosure rather than a long single page". These types are shaped for that:
 * a draft that fills in a step at a time and is only complete when the
 * required parts are present.
 *
 * ── What is deliberately not modelled as a promise ───────────────────────
 *
 * §15 forbids inventing customer promises, and a reservation is made of them.
 * So: no table is claimed to be held, no deposit is taken, and no availability
 * is asserted that the restaurant has not confirmed. A submitted reservation
 * is `requested` until Pappas confirms it, and the app says so. That is one
 * extra state and it is the honest one — an app that says "Table confirmed"
 * the instant somebody taps, against a restaurant with no booking system
 * wired up, is making a promise nobody can keep.
 *
 * §7 also asks for "future deposits, waitlists, special occasions and dining
 * preferences through configurable business rules". Those live in
 * `reservationRules` rather than in screens, so turning any of them on is a
 * configuration change.
 */

/** Where a reservation is in its life. */
export type ReservationStatus =
  /** Sent to Pappas, not yet answered. The honest state on submission. */
  | 'requested'
  /** Pappas has confirmed the table. */
  | 'confirmed'
  /** Pappas could not take it — with a reason, and alternatives offered. */
  | 'declined'
  /** The guest cancelled. */
  | 'cancelled'
  /** The date has passed and the guest came. */
  | 'completed'
  /** The date has passed and they did not. */
  | 'no-show';

/**
 * Where a guest would like to sit.
 *
 * Read off the supplied venue photography rather than invented: asset 13
 * shows the main dining room and an open kitchen along the back wall, 14 the
 * bar counter, and 16 a window table looking onto Nelson Mandela Square.
 * Each option below is somewhere a guest can actually be seated at Pappas,
 * because each one is in a photograph.
 *
 * A preference is exactly that — §7's "seating preference" — and the app
 * never promises it. The confirmation says "we will do our best", because a
 * host desk on a full Friday cannot do more than that.
 */
export type SeatingPreference =
  'no-preference' | 'dining-room' | 'window' | 'bar' | 'outdoor' | 'quiet';

/**
 * What the table is for.
 *
 * §8 asks for personalisation from "consented behaviour such as favourites,
 * visits, order history and birthdays", and an occasion is the most useful
 * signal a guest ever volunteers — it is the difference between a table and
 * an evening someone remembers. It is optional and always will be.
 */
export type ReservationOccasion =
  'none' | 'birthday' | 'anniversary' | 'celebration' | 'business' | 'date-night';

export interface ReservationDraft {
  /** ISO date, `YYYY-MM-DD`. */
  date?: string;
  /** 24-hour `HH:mm`, matching a slot the restaurant offers. */
  time?: string;
  partySize?: number;
  seating?: SeatingPreference;
  occasion?: ReservationOccasion;
  /** Free text from the guest — allergies, a wheelchair, a pushchair. */
  notes?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface Reservation {
  id: string;
  reference: string;
  status: ReservationStatus;
  /** ISO 8601 instant the table is for, resolved from date + time. */
  scheduledFor: string;
  partySize: number;
  seating: SeatingPreference;
  occasion: ReservationOccasion;
  notes?: string;
  guestName: string;
  phone: string;
  email?: string;
  createdAt: string;
  /** Set when Pappas answers. Absent while `requested`. */
  respondedAt?: string;
  /** Why a request was declined, in words a guest can act on. */
  declineReason?: string;
}

/** One bookable time, and whether it can be taken. */
export interface ReservationSlot {
  /** `HH:mm`, 24-hour. */
  time: string;
  available: boolean;
  /**
   * Why not, when it is not.
   *
   * `outside-service` is a time the restaurant is not open for — which the app
   * cannot know until trading hours are supplied, so today every slot the
   * guest is offered is offerable and this exists for when they are.
   */
  reason?: 'fully-booked' | 'outside-service' | 'too-soon' | 'party-too-large';
}

/**
 * The configurable rules §7 asks for.
 *
 * Every number here is a business rule, and §15 forbids inventing those. The
 * ones below fall into two groups:
 *
 *   - **Interface bounds** — how far ahead the date picker runs, the largest
 *     party the form will take before handing off to the functions enquiry.
 *     These shape a screen rather than promise anything, and a sensible bound
 *     is better than none.
 *   - **Commercial rules** — deposits, waitlists, cancellation windows. All
 *     off, because turning one on states a policy Pappas has not set.
 *
 * The distinction matters: a 90-day booking horizon is a UI decision anyone
 * can change. A deposit is a charge.
 */
export const reservationRules = {
  /** How far ahead the date picker runs. A UI bound, not a policy. */
  bookingHorizonDays: 90,
  /** Below this, the reservation form handles it. */
  maxPartySize: 12,
  /**
   * At or above `maxPartySize`, §9's private dining enquiry takes over.
   * A table for sixteen is an event, not a booking, and pretending otherwise
   * puts a party in front of a host who cannot seat them.
   */
  minPartySize: 1,
  /** Slot granularity in minutes. */
  slotMinutes: 30,
  /** How close to a sitting a request may still be made. */
  minLeadMinutes: 60,

  // ── Off until Pappas sets a policy. §7's "future" support. ──────────────
  /** Take a card to hold a table. Requires a published policy first. */
  depositsEnabled: false,
  /** Offer a waitlist when a sitting is full. */
  waitlistEnabled: false,
  /** Hours before the sitting that free cancellation ends. */
  freeCancellationHours: null as number | null,
} as const;
