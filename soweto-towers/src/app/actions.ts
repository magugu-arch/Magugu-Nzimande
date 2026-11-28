'use server';

import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import type { EnquiryType } from '@/lib/db/schema';
import { notifyStaff } from '@/lib/notify';
import { looksLikeBot, rateLimit } from '@/lib/security';

/**
 * `values` echoes what was typed when a submission fails. React 19 resets a
 * form after its action runs, so inputs use `defaultValue={state?.values?.x}`
 * (and checkboxes `defaultChecked`) to keep the visitor's typing on screen.
 */
export type FormState = { ok: boolean; message: string; errors?: Record<string, string>; values?: Record<string, string> } | null;

const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [String(i.path[0] ?? 'form'), i.message]));

const GUARD_FIELDS = new Set(['company_website', 'started_at']);
function typed(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string' && !GUARD_FIELDS.has(k) && !k.startsWith('$ACTION')) out[k] = v;
  return out;
}

// ---------- Newsletter / WhatsApp broadcast opt-in ----------

const subscribeSchema = z.object({
  address: z.string().trim().min(5, 'Enter your WhatsApp number or email').max(120),
  consent: z.literal('on', { error: 'Tick the box so we know it’s OK to message you.' }),
});

export async function subscribe(_: FormState, form: FormData): Promise<FormState> {
  if (looksLikeBot(form)) return { ok: true, message: 'Thanks!' };
  const values = typed(form);
  if (!(await rateLimit('subscribe', 5, 600))) return { ok: false, message: 'Too many tries. Please wait a few minutes.', values };
  const parsed = subscribeSchema.safeParse({ address: form.get('address'), consent: form.get('consent') });
  if (!parsed.success) return { ok: false, message: 'Check the form.', errors: fieldErrors(parsed.error), values };
  const address = parsed.data.address;
  const isEmail = address.includes('@');
  if (isEmail ? !z.email().safeParse(address).success : !/^\+?[\d\s()-]{9,20}$/.test(address)) {
    return { ok: false, message: 'Check the form.', errors: { address: 'That doesn’t look like a number or email address.' }, values };
  }
  const db = await getDb();
  await db.insert(schema.subscribers).values({ channel: isEmail ? 'email' : 'whatsapp', address, source: String(form.get('source') ?? 'footer') });
  return {
    ok: true,
    message: isEmail ? 'You’re on the list. Unsubscribe from any email.' : 'You’re on the list. Reply STOP on WhatsApp at any time.',
  };
}

// ---------- Enquiries (groups, corporate, schools, partners, media, venue, base jumping) ----------

const enquiryTypes = ['group', 'corporate', 'school', 'tour_operator', 'hotel', 'partner', 'media', 'venue', 'base_jump', 'general'] as const;

const enquirySchema = z.object({
  type: z.enum(enquiryTypes),
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.email('Enter a valid email').max(120),
  phone: z.string().trim().max(20).optional().default(''),
  company: z.string().trim().max(120).optional().default(''),
  groupSize: z.coerce.number().int().min(0).max(5000).optional(),
  preferredDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')])
    .optional()
    .default(''),
  message: z.string().trim().min(10, 'Tell us a little more (10 characters or more)').max(3000),
  consent: z.literal('on', { error: 'Please agree to us contacting you about this enquiry.' }),
});

const enquiryLabels: Record<EnquiryType, string> = {
  group: 'Group / celebration',
  corporate: 'Corporate team day',
  school: 'School visit',
  tour_operator: 'Tour operator',
  hotel: 'Hotel or backpackers',
  partner: 'Brand partnership',
  media: 'Media',
  venue: 'Venue hire / film shoot',
  base_jump: 'Base jump application',
  general: 'General',
};

export async function sendEnquiry(_: FormState, form: FormData): Promise<FormState> {
  if (looksLikeBot(form)) return { ok: true, message: 'Thanks! We’ll be in touch.' };
  const values = typed(form);
  if (!(await rateLimit('enquiry', 6, 600))) return { ok: false, message: 'Too many enquiries from this connection. Please try again shortly.', values };
  const parsed = enquirySchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const e = parsed.data;
  const db = await getDb();
  await db.insert(schema.enquiries).values({
    type: e.type,
    name: e.name,
    email: e.email.toLowerCase(),
    phone: e.phone || null,
    company: e.company || null,
    groupSize: e.groupSize || null,
    preferredDate: e.preferredDate || null,
    message: e.message,
    meta: { page: String(form.get('page') ?? '') },
  });
  await notifyStaff(
    `New enquiry: ${enquiryLabels[e.type]}`,
    [
      `${e.name}${e.company ? ` (${e.company})` : ''} · ${e.email}${e.phone ? ` · ${e.phone}` : ''}`,
      e.groupSize ? `Group size: ${e.groupSize}` : '',
      e.preferredDate ? `Preferred date: ${e.preferredDate}` : '',
      e.message,
    ].filter(Boolean),
    '/admin/inbox?tab=enquiries',
  );
  return { ok: true, message: 'Thanks! The crew replies within one working day, usually much sooner.' };
}

// ---------- Restaurant table requests ----------

const tableSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{9,20}$/, 'Enter a mobile number'),
  email: z
    .union([z.email(), z.literal('')])
    .optional()
    .default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a time'),
  partySize: z.coerce.number().int().min(1, 'How many people?').max(60),
  notes: z.string().trim().max(500).optional().default(''),
});

export async function requestTable(_: FormState, form: FormData): Promise<FormState> {
  if (looksLikeBot(form)) return { ok: true, message: 'Thanks!' };
  const values = typed(form);
  if (!(await rateLimit('table', 5, 600))) return { ok: false, message: 'Too many requests. Please try again shortly.', values };
  const parsed = tableSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', errors: fieldErrors(parsed.error), values };
  const t = parsed.data;
  const db = await getDb();
  await db.insert(schema.tableRequests).values({ ...t, email: t.email || null, notes: t.notes || null });
  await notifyStaff('Table request at Chaf-Pozi', [`${t.name} · ${t.phone}`, `${t.date} at ${t.time} for ${t.partySize}`, t.notes], '/admin/inbox?tab=tables');
  return { ok: true, message: 'Request sent. We’ll confirm your table on WhatsApp.' };
}
