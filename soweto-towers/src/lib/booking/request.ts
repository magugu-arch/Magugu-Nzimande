import { z } from 'zod';

/** What the browser sends. Everything here is re-checked on the server. */

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const name = z.string().trim().min(2).max(80);
const phone = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(/^\+?[\d\s()-]{9,20}$/, 'Enter a mobile number');

export const contactSchema = z.object({
  name,
  email: z.email().max(120),
  phone,
});

export const activityIds = ['bungee-jump', 'straightjacket-bungee', 'scad-freefall', 'zipline', 'paintball', 'lift-ride', 'base-jump'] as const;

export const bookingRequestSchema = z.object({
  date: ymd,
  packageId: z.enum(['the-jump', 'jump-film', 'full-tower']).nullable(),
  items: z
    .array(
      z.object({
        activityId: z.enum(activityIds),
        qty: z.number().int().min(1).max(30),
        time: hm,
        video: z.number().int().min(0).max(30),
        photos: z.number().int().min(0).max(30),
      }),
    )
    .min(1)
    .max(4),
  participants: z
    .array(
      z.object({
        name: z.string().trim().max(60),
        weightKg: z.number().min(10).max(250).nullable(),
        minor: z.boolean(),
      }),
    )
    .min(1)
    .max(30),
  safety: z.object({
    allTwelvePlus: z.boolean(),
    medicalOk: z.boolean(),
    guardianName: z.string().trim().max(80),
  }),
  contact: contactSchema,
  consents: z.object({
    terms: z.literal(true, { error: 'Please accept the terms and indemnity.' }),
    whatsapp: z.boolean(),
    marketing: z.boolean(),
    clip: z.boolean(),
  }),
  voucherCode: z.string().trim().max(20).optional().default(''),
  lunch: z
    .object({ time: hm, partySize: z.number().int().min(1).max(30) })
    .nullable()
    .optional(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const voucherOrderSchema = z.object({
  product: z.discriminatedUnion('type', [
    z.object({ type: z.literal('package'), id: z.enum(['the-jump', 'jump-film', 'full-tower']) }),
    z.object({ type: z.literal('activity'), id: z.enum(activityIds) }),
    z.object({ type: z.literal('amount'), amount: z.number().int().min(100).max(10000) }),
  ]),
  quantity: z.number().int().min(1).max(10),
  recipient: z.object({
    name: z.string().trim().min(2).max(80),
    email: z
      .union([z.email().max(120), z.literal('')])
      .optional()
      .default(''),
    phone: z
      .union([phone, z.literal('')])
      .optional()
      .default(''),
  }),
  message: z.string().trim().max(280).optional().default(''),
  delivery: z.enum(['email', 'whatsapp', 'me']),
  deliverOn: z
    .union([ymd, z.literal('')])
    .optional()
    .default(''),
  purchaser: contactSchema,
  consents: z.object({ terms: z.literal(true, { error: 'Please accept the voucher terms.' }), marketing: z.boolean() }),
});

export type VoucherOrder = z.infer<typeof voucherOrderSchema>;

export const eventOrderSchema = z.object({
  slug: z.string().min(1).max(120),
  qty: z.number().int().min(1).max(20),
  contact: contactSchema,
  consents: z.object({ terms: z.literal(true, { error: 'Please accept the terms.' }), whatsapp: z.boolean(), marketing: z.boolean() }),
});

export type EventOrder = z.infer<typeof eventOrderSchema>;

export function zodErrors(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.join('.');
    if (path.startsWith('contact.email') || path.startsWith('purchaser.email')) return 'Enter a valid email address.';
    if (path.startsWith('contact.phone') || path.startsWith('purchaser.phone')) return 'Enter a valid mobile number.';
    if (path.startsWith('contact.name') || path.startsWith('purchaser.name')) return 'Enter your full name.';
    return i.message;
  });
}
