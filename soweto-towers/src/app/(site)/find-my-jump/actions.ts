'use server';

import { z } from 'zod';
import { bookingForVisitor, clipsFor } from '@/lib/data/bookings';
import { rateLimit } from '@/lib/security';

export type FindState =
  | null
  | { ok: false; message: string; values: { ref: string; email: string } }
  | {
      ok: true;
      ref: string;
      summary: string;
      visitDate: string | null;
      ticketUrl: string;
      checkedIn: boolean;
      clips: { kind: 'scream' | 'full'; url: string; participant: string | null }[];
    };

const schema = z.object({
  ref: z.string().trim().min(6).max(12),
  email: z.email(),
});

export async function findJump(_: FindState, form: FormData): Promise<FindState> {
  // React resets the form after each submit; echo the typing back so a failed lookup keeps it.
  const values = { ref: String(form.get('ref') ?? '').slice(0, 20), email: String(form.get('email') ?? '').slice(0, 120) };
  if (!(await rateLimit('find-jump', 10, 600))) return { ok: false, message: 'Too many lookups. Please wait a few minutes.', values };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { ok: false, message: 'Enter your booking reference (like ST-7K4P2Q) and the email you booked with.', values };
  const d = await bookingForVisitor(parsed.data.ref, parsed.data.email);
  // Same message whether the reference or the email is wrong, so lookups can't confirm either.
  if (!d || d.booking.status !== 'paid') return { ok: false, message: 'We couldn’t match that reference and email. Check both, or WhatsApp us.', values };
  const clips = await clipsFor(d.booking.ref);
  return {
    ok: true,
    ref: d.booking.ref,
    summary: String((d.booking.meta as { summary?: string }).summary ?? ''),
    visitDate: d.booking.visitDate,
    ticketUrl: `/ticket/${d.booking.ref}?t=${d.booking.ticketToken}`,
    checkedIn: !!d.booking.checkedInAt,
    clips: clips.map((c) => ({ kind: c.kind, url: c.url, participant: c.participant })),
  };
}
