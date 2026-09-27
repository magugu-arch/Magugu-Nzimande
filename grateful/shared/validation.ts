import { z } from 'zod';

/**
 * One set of schemas, used by the forms for instant feedback and by the API as
 * the check that actually counts. The browser copy is a courtesy; the server
 * copy is the rule.
 */

const trimmed = (max: number) => z.string().trim().max(max);

const name = trimmed(120).min(2, 'Please enter your name.');
const email = z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email address.'));
// South African and international numbers: digits, spaces, +, brackets, dashes.
const phone = trimmed(32)
  .min(7, 'Please enter a phone number we can reach you on.')
  .regex(/^[+()\d\s-]+$/, 'Please use digits, spaces and + only.');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time.');

/** Anti-spam fields every public form carries. See server/security.ts. */
const antiSpam = {
  // A field real people never see, so never fill.
  company: z.string().max(0).optional().or(z.literal('')),
  // Milliseconds since the form rendered; bots submit instantly.
  elapsedMs: z.number().int().nonnegative().optional(),
};

export const bookingSchema = z.object({
  serviceId: z.string().min(1, 'Choose a service.'),
  date: isoDate,
  time: hhmm,
  clientName: name,
  email,
  phone,
  notes: trimmed(2000).optional().default(''),
  ...antiSpam,
});
export type BookingInput = z.input<typeof bookingSchema>;

export const paymentSchema = z.object({
  bookingId: z.uuid(),
  option: z.enum(['deposit', 'full']),
  acceptTerms: z.literal(true, { error: 'Please accept the payment and cancellation terms.' }),
});

export const contactSchema = z.object({
  name,
  email,
  phone: phone.optional().or(z.literal('')),
  subject: trimmed(120).optional().default(''),
  message: trimmed(4000).min(10, 'Tell us a little more — at least a sentence.'),
  consent: z.literal(true, { error: 'Please confirm we may contact you about your enquiry.' }),
  ...antiSpam,
});
export type ContactInput = z.input<typeof contactSchema>;

export const newsletterSchema = z.object({
  email,
  consent: z.literal(true, { error: 'Please confirm you would like to receive our emails.' }),
  ...antiSpam,
});
export type NewsletterInput = z.input<typeof newsletterSchema>;

/** Flatten a zod error into { field: first message }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
