/**
 * Everything about the studio that a person, not a developer, might need to
 * change. Contact details come from the Grateful CI manual (email signature
 * and business card pages). Anything the CI does not state is left null and
 * the UI hides it, rather than guessing.
 *
 * Voice: Grateful is presented as a studio. Copy says "we" and "the studio";
 * no individual is named anywhere on the public site or in emails.
 */

// The studio is reached by email. Its phone number appears only in the booking
// flow (Book, Payment, Confirmation), by the studio's request: see BookingHelp.
import content from './studio-content.json';

export const site = {
  name: 'Grateful',
  legalName: 'Grateful (Pty) Ltd',
  /** How the studio signs off: in the footer and on every email. Grateful speaks as a studio, not as one person. */
  studioName: 'Grateful Studio',
  studioLine: 'Fashion design studio',
  email: 'gratefulpty@gmail.com',
  /** Shown only on the booking pages, through <BookingHelp />. */
  bookingPhone: '+27 76 081 4788',
  bookingPhoneHref: 'tel:+27760814788',
  location: 'Mulbarton, Johannesburg',
  // Suburb-level only: the brief asks that no street address is exposed.
  mapHref: 'https://www.google.com/maps/search/?api=1&query=Mulbarton%2C+Johannesburg',
  mapEmbed: 'https://www.google.com/maps?q=Mulbarton,+Johannesburg&z=13&output=embed',

  /**
   * Opening hours shown on the contact page. Not supplied in the CI, so these
   * say "by appointment" until the studio confirms real hours. The bookable
   * times themselves come from the availability table, not from here.
   */
  hours: [{ days: 'Consultations & fittings', time: 'By appointment' }] as { days: string; time: string }[],

  /** From the launch checklist (studio-content.json). Only supplied profiles appear in the footer. */
  social: content.social as Record<'instagram' | 'facebook' | 'tiktok' | 'other', string | null>,

  /** For the privacy notice (POPIA), from the launch checklist. null → still to be supplied. */
  privacy: content.privacy as { officer: string | null; email: string | null; retention: string | null },

  /** Terms shown before checkout. Edit once the studio has settled its policy. */
  paymentTerms: [
    'Your time slot is held for 20 minutes while you complete payment.',
    'A booking is confirmed only once payment has been verified.',
    'To reschedule or cancel, contact the studio at least 48 hours before your appointment.',
  ],
} as const;

export const nav = [
  { to: '/work', label: 'Work' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/booking', label: 'Book' },
  { to: '/contact', label: 'Contact' },
] as const;
