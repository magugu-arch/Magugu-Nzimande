import 'server-only';
import { createHmac } from 'node:crypto';
import { SITE_MODE } from './env';

/**
 * Where form submissions go. Each kind posts JSON to a webhook the team
 * controls (their CRM, ESP or an automation tool), signed with HMAC-SHA256 so
 * the receiver can check it came from this site.
 *
 * The rule from the brief: never tell someone their message was sent unless
 * it was. With no webhook configured, preview logs a redacted line and says
 * so on screen; production refuses and shows a failure state instead.
 */
export type DeliveryKind = 'speaking' | 'contact' | 'newsletter';

export type DeliveryResult =
  | { ok: true; channel: 'webhook' | 'preview-log' }
  | { ok: false; reason: 'not-configured' | 'failed' };

const ENV_KEYS: Record<DeliveryKind, string> = {
  speaking: 'ENQUIRY_WEBHOOK_URL',
  contact: 'CONTACT_WEBHOOK_URL',
  newsletter: 'NEWSLETTER_WEBHOOK_URL',
};

function webhookFor(kind: DeliveryKind): string | null {
  const specific = process.env[ENV_KEYS[kind]];
  // Contact messages fall back to the enquiry webhook if only that one is set.
  if (!specific && kind === 'contact') return process.env.ENQUIRY_WEBHOOK_URL || null;
  return specific || null;
}

export function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export async function deliver(
  kind: DeliveryKind,
  payload: Record<string, unknown>,
  meta: { sourcePage: string },
): Promise<DeliveryResult> {
  const url = webhookFor(kind);
  const record = {
    kind,
    payload,
    sourcePage: meta.sourcePage,
    submittedAt: new Date().toISOString(),
    site: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  };

  if (!url) {
    if (SITE_MODE === 'preview') {
      // Field names only — personal data stays out of logs.
      console.info(
        `[preview] ${kind} submission validated; not delivered (no webhook). Fields: ${Object.keys(payload).join(', ')}`,
      );
      return { ok: true, channel: 'preview-log' };
    }
    console.error(`[delivery] ${kind}: no webhook configured; submission refused.`);
    return { ok: false, reason: 'not-configured' };
  }

  const body = JSON.stringify(record);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (secret) headers['x-signature-sha256'] = sign(body, secret);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[delivery] ${kind}: webhook answered ${res.status}.`);
      return { ok: false, reason: 'failed' };
    }
    return { ok: true, channel: 'webhook' };
  } catch (error) {
    console.error(`[delivery] ${kind}: webhook request failed (${(error as Error).name}).`);
    return { ok: false, reason: 'failed' };
  }
}
