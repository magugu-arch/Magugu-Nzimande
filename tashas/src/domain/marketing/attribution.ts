/**
 * Campaign attribution (brief §7, §13.8).
 *
 * Tracked links carry UTM parameters and a campaign id, never personal data.
 * The device keeps a first-touch and last-touch record (where the guest
 * allows measurement), and the booking attempt copies it, so the source
 * survives landing page → booking → payment into reporting.
 */

import type { AttributionSnapshot, AttributionTouch, Utm } from '../types.ts';

/** UTM standards for every outbound channel, so reports group cleanly. */
export const UTM_STANDARDS: { channel: string; source: string; medium: string }[] = [
  { channel: 'Email', source: 'email', medium: 'email' },
  { channel: 'Push', source: 'app', medium: 'push' },
  { channel: 'In-app', source: 'app', medium: 'in-app' },
  { channel: 'QR code at the café', source: 'qr', medium: 'offline' },
  { channel: 'WhatsApp', source: 'whatsapp', medium: 'social' },
  { channel: 'Paid social', source: 'instagram', medium: 'paid-social' },
  { channel: 'Search ads', source: 'google', medium: 'cpc' },
];

/** Parameters that must never be read from, or written into, a link. */
const PII_PARAMS = /^(email|e-?mail|phone|mobile|name|first_?name|last_?name|msisdn)$/i;

export function parseAttribution(search: string): { utm: Utm; campaignId: string | null; landingSlug: string | null } | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (!source || !medium || !campaign) return null;
  const clean = (v: string | null) => (v ? v.slice(0, 80).replace(/[^\w.\-~]/g, '-') : undefined);
  const utm: Utm = { source: clean(source)!, medium: clean(medium)!, campaign: clean(campaign)! };
  const content = clean(params.get('utm_content'));
  const term = clean(params.get('utm_term'));
  if (content) utm.content = content;
  if (term) utm.term = term;
  return { utm, campaignId: clean(params.get('cid')) ?? null, landingSlug: clean(params.get('page')) ?? null };
}

export function buildTrackedQuery(utm: Utm, campaignId: string | null, landingSlug: string | null): string {
  const params = new URLSearchParams();
  params.set('utm_source', utm.source);
  params.set('utm_medium', utm.medium);
  params.set('utm_campaign', utm.campaign);
  if (utm.content) params.set('utm_content', utm.content);
  if (utm.term) params.set('utm_term', utm.term);
  if (campaignId) params.set('cid', campaignId);
  if (landingSlug) params.set('page', landingSlug);
  for (const key of [...params.keys()]) if (PII_PARAMS.test(key)) params.delete(key);
  return params.toString();
}

export function recordTouch(previous: AttributionSnapshot | null, touch: AttributionTouch): AttributionSnapshot {
  return { firstTouch: previous?.firstTouch ?? touch, lastTouch: touch };
}

export function describeSource(snapshot: AttributionSnapshot | null): string {
  const t = snapshot?.lastTouch;
  return t ? `${t.utm.source} / ${t.utm.medium} · ${t.utm.campaign}` : 'direct / none';
}
