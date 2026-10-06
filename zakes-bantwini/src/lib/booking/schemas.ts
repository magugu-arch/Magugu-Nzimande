import { z } from 'zod';
import { isIsoDate } from './dates';
import { BUDGET_RANGES, COLLABORATION_TYPES, EVENT_TYPES, PERFORMANCE_FORMATS, QUOTE_LINE_KINDS } from './types';

const keys = <T extends readonly { key: string }[]>(list: T) => list.map((i) => i.key) as [T[number]['key'], ...T[number]['key'][]];

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const optionalText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => (v ? v : null));
const checkbox = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 19:30');

export const phone = z
  .string()
  .trim()
  .min(7, 'Enter a phone number we can reach you on')
  .max(24)
  .regex(/^\+?[\d\s()-]+$/, 'Use digits, spaces and an optional leading +');

/**
 * The public booking request (brief §05 recommended fields). The same schema
 * validates each wizard step in the browser and the whole submission on the
 * server — the server never trusts the browser's checks.
 */
export const BookingRequest = z
  .object({
    eventDate: z.string().refine(isIsoDate, 'Choose a date'),
    startTime: time,
    endTime: time.optional().or(z.literal('').transform(() => undefined)),
    eventType: z.enum(keys(EVENT_TYPES), { message: 'Choose the type of event' }),
    performanceFormat: z.enum(keys(PERFORMANCE_FORMATS), { message: 'Choose a performance format' }),
    expectedAttendance: z.coerce.number({ message: 'Enter a number' }).int('Enter a whole number').min(1, 'Enter the expected attendance').max(500_000),
    budgetRange: z.enum(keys(BUDGET_RANGES), { message: 'Choose a budget range' }),
    venue: text(160).min(2, 'Enter the venue, or “TBC”'),
    city: text(80).min(2, 'Enter the city'),
    country: text(80).min(2, 'Enter the country'),
    travelRequired: checkbox,
    travelNotes: optionalText(1000),
    accommodationRequired: checkbox,
    accommodationNotes: optionalText(1000),
    productionNotes: optionalText(2000),
    additionalInfo: optionalText(4000),
    fullName: text(120).min(2, 'Enter your full name'),
    organisation: optionalText(160),
    email: z.email('Enter a valid email address').max(200),
    phone,
    whatsappOptIn: checkbox,
    privacyConsent: checkbox.refine((v) => v, 'Please agree so we can handle your request'),
    /** Honeypot: people never see it, bots fill it in. */
    website: z.string().max(0).optional(),
  })
  .refine((d) => !d.endTime || d.endTime !== d.startTime, { path: ['endTime'], message: 'End time must differ from start time' });

export type BookingRequestInput = z.input<typeof BookingRequest>;
export type BookingRequestData = z.output<typeof BookingRequest>;

/** Wizard steps and the fields each one owns. */
export const REQUEST_STEPS = [
  { key: 'date', title: 'Date', fields: ['eventDate'] },
  { key: 'event', title: 'Event', fields: ['eventType', 'performanceFormat', 'startTime', 'endTime', 'expectedAttendance', 'budgetRange'] },
  { key: 'location', title: 'Location', fields: ['venue', 'city', 'country', 'travelRequired', 'travelNotes', 'accommodationRequired', 'accommodationNotes', 'productionNotes'] },
  { key: 'details', title: 'You', fields: ['fullName', 'organisation', 'email', 'phone', 'whatsappOptIn', 'additionalInfo'] },
  { key: 'review', title: 'Review', fields: ['privacyConsent'] },
] as const;

export const QuoteInput = z.object({
  lines: z
    .array(
      z.object({
        kind: z.enum(QUOTE_LINE_KINDS),
        description: text(200).min(1, 'Describe the line'),
        amountCents: z.number().int().min(0),
      }),
    )
    .min(1, 'Add at least one line'),
  taxApplicable: z.boolean(),
  taxRateBps: z.number().int().min(0).max(5000),
  depositPercent: z.number().int().min(0).max(100),
  depositDueDate: z.string().refine(isIsoDate),
  balanceDueDate: z
    .string()
    .refine(isIsoDate)
    .nullable(),
  validUntil: z.string().refine(isIsoDate),
  cancellationTerms: text(6000).min(10),
  clientMessage: optionalText(2000),
});
export type QuoteInputData = z.output<typeof QuoteInput>;

export const PublicEventInput = z.object({
  title: text(160).min(2),
  date: z.string().refine(isIsoDate, 'Choose a date'),
  startTime: time.optional().or(z.literal('').transform(() => undefined)),
  venue: text(160).min(2),
  city: text(80).min(2),
  country: text(80).min(2),
  ticketUrl: z.url('Enter the full ticket link, starting https://').optional().or(z.literal('').transform(() => undefined)),
  description: optionalText(2000),
  published: checkbox,
});

export const CommunityInput = z
  .object({
    email: z.email('Enter a valid email address').max(200),
    phone: phone.optional().or(z.literal('').transform(() => undefined)),
    emailConsent: checkbox,
    whatsappConsent: checkbox,
    website: z.string().max(0).optional(),
  })
  .refine((d) => d.emailConsent || d.whatsappConsent, { path: ['emailConsent'], message: 'Choose at least one way to hear from us' })
  .refine((d) => !d.whatsappConsent || Boolean(d.phone), { path: ['phone'], message: 'Add a mobile number for WhatsApp' });

export const CollaborationInput = z.object({
  type: z.enum(keys(COLLABORATION_TYPES), { message: 'Choose the kind of collaboration' }),
  name: text(120).min(2, 'Enter your name'),
  organisation: optionalText(160),
  email: z.email('Enter a valid email address').max(200),
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  timeline: optionalText(200),
  budget: optionalText(200),
  message: text(4000).min(20, 'Tell us a little more — at least a couple of sentences'),
  privacyConsent: checkbox.refine((v) => v, 'Please agree so we can reply'),
  website: z.string().max(0).optional(),
});

/** Field-keyed messages for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
