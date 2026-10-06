'use server';

import { headers } from 'next/headers';
import { trackServer } from '@/lib/analytics/server';
import { CONSENT_TEXT } from '@/lib/consent';
import { CollaborationInput, CommunityInput, fieldErrors } from '@/lib/booking/schemas';
import { COLLABORATION_TYPES } from '@/lib/booking/types';
import { emailAdapter } from '@/lib/notifications/adapters';
import { newId } from '@/lib/security/crypto';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { getStore } from '@/lib/store';

export type FormState = { ok: boolean; message: string | null; fields: Record<string, string> };


function entries(form: FormData) {
  return Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
}

async function limited(key: string) {
  return !rateLimit(`${key}:${clientIp(await headers())}`, 8, 60 * 60_000).ok;
}

/** Optional hand-off to an email platform or automation (Mailchimp, Klaviyo, Make, Zapier…). */
async function forward(kind: string, payload: Record<string, unknown>) {
  const url = process.env.COMMUNITY_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(process.env.COMMUNITY_WEBHOOK_SECRET ? { authorization: `Bearer ${process.env.COMMUNITY_WEBHOOK_SECRET}` } : {}) },
      body: JSON.stringify({ kind, ...payload }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.warn('[community] webhook failed', error instanceof Error ? error.message : error);
  }
}

export async function joinCommunity(_prev: FormState, form: FormData): Promise<FormState> {
  if (await limited('community')) return { ok: false, message: 'Too many attempts — please try again later.', fields: {} };
  // Bots fill the hidden field: answer as if it worked, store nothing.
  if (String(form.get('website') ?? '')) return { ok: true, message: 'You are in.', fields: {} };
  const parsed = CommunityInput.safeParse(entries(form));
  if (!parsed.success) return { ok: false, message: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) };

  const d = parsed.data;
  const consentText = [d.emailConsent && CONSENT_TEXT.email, d.whatsappConsent && CONSENT_TEXT.whatsapp].filter(Boolean).join(' / ');
  try {
    await getStore().insert('community_signups', {
      id: newId(),
      email: d.email.toLowerCase(),
      phone: d.phone ?? null,
      emailConsent: d.emailConsent,
      whatsappConsent: d.whatsappConsent,
      consentText,
      source: 'website',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[community] could not save signup', error);
    return { ok: false, message: 'We could not save that just now. Please try again in a moment.', fields: {} };
  }
  await forward('community_signup', { email: d.email, phone: d.phone, emailConsent: d.emailConsent, whatsappConsent: d.whatsappConsent, consentText });
  await trackServer('community_signup', 'anonymous', { email: d.emailConsent, whatsapp: d.whatsappConsent });
  return { ok: true, message: 'You are in. Look out for first word on music, dates and the institution.', fields: {} };
}

export async function submitCollaboration(_prev: FormState, form: FormData): Promise<FormState> {
  if (await limited('collaborate')) return { ok: false, message: 'Too many attempts — please try again later.', fields: {} };
  if (String(form.get('website') ?? '')) return { ok: true, message: 'Thank you.', fields: {} };
  const parsed = CollaborationInput.safeParse(entries(form));
  if (!parsed.success) return { ok: false, message: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) };

  const d = parsed.data;
  try {
    await getStore().insert('collaboration_requests', {
      id: newId(),
      type: d.type,
      name: d.name,
      organisation: d.organisation,
      email: d.email.toLowerCase(),
      phone: d.phone ?? null,
      timeline: d.timeline,
      budget: d.budget,
      message: d.message,
      status: 'new',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[collaborate] could not save request', error);
    return { ok: false, message: 'We could not save that just now. Please try again in a moment.', fields: {} };
  }

  const inbox = process.env.PARTNERSHIPS_INBOX_EMAIL ?? process.env.BOOKINGS_INBOX_EMAIL;
  if (inbox) {
    const label = COLLABORATION_TYPES.find((t) => t.key === d.type)?.label ?? d.type;
    const text = [`New ${label.toLowerCase()} enquiry`, `From: ${d.name}${d.organisation ? `, ${d.organisation}` : ''} <${d.email}>`, d.timeline && `Timeline: ${d.timeline}`, d.budget && `Budget: ${d.budget}`, '', d.message]
      .filter((l): l is string => typeof l === 'string')
      .join('\n');
    await emailAdapter()
      .send({ to: inbox, subject: `[Collaborate] ${label} — ${d.organisation ?? d.name}`, text }, 'enquiry_received')
      .catch((e) => console.warn('[collaborate] notify failed', e));
  }
  await trackServer('collaboration_submitted', 'anonymous', { type: d.type });
  return { ok: true, message: 'Thank you — the team reads every proposal and will reply if there is a fit.', fields: {} };
}
