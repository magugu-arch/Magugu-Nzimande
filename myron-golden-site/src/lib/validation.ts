import { z } from 'zod';

/**
 * Form schemas, shared by the server actions (the real gate) and the tests.
 * Messages are written to be read next to the field, so they say what to do,
 * not what went wrong.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);

const requiredText = (label: string, max: number) => trimmed(max).min(1, `Enter ${label}.`);

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'Enter a shorter email address.')
  .email('Enter an email address in the format name@example.com.');

const consent = z
  .string()
  .optional()
  .refine((v) => v === 'on' || v === 'true', {
    message: 'Confirm you are happy for us to use these details to reply.',
  });

/** Empty strings from untouched optional fields become undefined. */
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const eventTypes = [
  'Conference or keynote',
  'Workshop or masterclass',
  'Church or ministry event',
  'Corporate or team event',
  'Podcast or interview',
  'Other',
] as const;

export const eventFormats = ['In person', 'Virtual', 'Hybrid'] as const;

export const audienceSizes = [
  'Under 50',
  '50–200',
  '200–500',
  '500–1,000',
  '1,000–5,000',
  'Over 5,000',
] as const;

export const budgetRanges = [
  'Prefer to discuss',
  'Under $10,000',
  '$10,000–$25,000',
  '$25,000–$50,000',
  'Over $50,000',
] as const;

export const durations = [
  'Under 30 minutes',
  '30–60 minutes',
  'Half day',
  'Full day',
  'Multi-day',
] as const;

const isoDate = z
  .string()
  .trim()
  .min(1, 'Choose a requested date.')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a requested date.');

export const speakingEnquirySchema = z.object({
  name: requiredText('your name', 120),
  organisation: requiredText('your organisation', 160),
  email,
  country: requiredText('the country of the event', 80),
  eventType: z.enum(eventTypes, { message: 'Choose the kind of event.' }),
  requestedDate: isoDate,
  alternativeDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Choose a valid date.'),
  timezone: requiredText('the event’s time zone', 64),
  format: z.enum(eventFormats, { message: 'Choose in person, virtual or hybrid.' }),
  location: requiredText('the venue, city or platform', 200),
  audienceSize: z.enum(audienceSizes, { message: 'Choose an approximate audience size.' }),
  audienceProfile: requiredText('who the audience is', 600),
  topic: requiredText('the topic you have in mind', 600),
  duration: z.enum(durations, { message: 'Choose a session length.' }),
  budget: z
    .enum(budgetRanges)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  travel: optionalText(800),
  notes: optionalText(2000),
  consent,
});

export const contactCategories = [
  'support',
  'speaking',
  'partnership',
  'press',
  'general',
] as const;

export const contactSchema = z.object({
  category: z.enum(contactCategories, { message: 'Choose what your message is about.' }),
  name: requiredText('your name', 120),
  email,
  subject: requiredText('a subject', 160),
  message: requiredText('your message', 4000).min(10, 'Add a little more detail so we can help.'),
  orderReference: optionalText(80),
  consent,
});

export const newsletterTopicValues = [
  'offers-value',
  'sales-closing',
  'business-growth',
  'entrepreneurship',
  'money-stewardship',
  'faith-purpose',
  'speaking-content',
] as const;

export const newsletterSchema = z.object({
  firstName: optionalText(80),
  email,
  topics: z.array(z.enum(newsletterTopicValues)).max(newsletterTopicValues.length).default([]),
  consent,
});

export type SpeakingEnquiry = z.infer<typeof speakingEnquirySchema>;
export type ContactMessage = z.infer<typeof contactSchema>;
export type NewsletterSignup = z.infer<typeof newsletterSchema>;

export type FieldErrors = Record<string, string>;

/** First message per field, keyed by field name, for inline display. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** FormData → plain object; repeated keys (checkbox groups) become arrays. */
export function formDataToObject(
  formData: FormData,
  arrayKeys: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith('$ACTION')) continue;
    const values = formData.getAll(key).filter((v): v is string => typeof v === 'string');
    out[key] = arrayKeys.includes(key) ? values : values[0];
  }
  for (const key of arrayKeys) if (!(key in out)) out[key] = [];
  return out;
}
