import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Delivery, Message, NotificationTransport } from './transport';

/**
 * Mailgun, for email.
 *
 * Basic auth with the literal username `api` and the key as the password —
 * which looks wrong the first time and is what Mailgun specifies. Messages go
 * as form-encoded fields rather than JSON, which is also theirs.
 *
 * Two regions, and picking the wrong one is a 401 that reads like a bad key:
 * an account provisioned in the EU cannot be reached on the US host. It is
 * configured rather than guessed.
 */

const HOSTS = {
  us: 'https://api.mailgun.net',
  eu: 'https://api.eu.mailgun.net',
} as const;

export type MailgunRegion = keyof typeof HOSTS;

export type MailgunConfig = {
  apiKey: string;
  /** The sending domain, which is part of the path and not a header. */
  domain: string;
  /** Who the customer sees it from. */
  from: string;
  region: MailgunRegion;
  fetcher?: typeof fetch;
};

export function mailgunTransport(config: MailgunConfig): NotificationTransport {
  const send = config.fetcher ?? fetch;

  return {
    name: 'mailgun',

    async deliver(message: Message): Promise<Delivery> {
      const body = new URLSearchParams({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
        // Our own id, so a bounce or a complaint in Mailgun's logs can be
        // traced back to the order that caused it without a lookup table.
        'v:message-id': message.id,
      });

      try {
        const response = await send(
          `${HOSTS[config.region]}/v3/${encodeURIComponent(config.domain)}/messages`,
          {
            method: 'POST',
            headers: {
              // `api` is the username Mailgun requires, not a placeholder.
              authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`,
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          },
        );

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          return {
            ok: false,
            error: `Mailgun refused it (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          };
        }

        const parsed = (await response.json().catch(() => null)) as { id?: unknown } | null;
        // Accepted with no id is still accepted — the message is queued and
        // reporting a failure would have us send it again.
        return { ok: true, id: typeof parsed?.id === 'string' ? parsed.id : message.id };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Mailgun unreachable' };
      }
    },
  };
}

/**
 * Mailgun's webhook signature.
 *
 * HMAC-SHA256 over `timestamp + token`, keyed by the webhook signing key —
 * note that it signs those two fields and *not* the payload, which is unlike
 * every other webhook in this codebase. The signature therefore proves the
 * request came from Mailgun and says nothing about the body being unmodified.
 *
 * Which is why the two extra checks below are not optional. Without them a
 * captured `{timestamp, token, signature}` triple can be replayed for ever
 * with any body attached to it.
 */
export function verifyMailgunSignature(
  signature: { timestamp: string; token: string; signature: string },
  signingKey: string,
  options: { now?: number; seen?: Set<string>; toleranceSeconds?: number } = {},
): boolean {
  const expected = createHmac('sha256', signingKey)
    .update(`${signature.timestamp}${signature.token}`)
    .digest('hex');

  const left = createHmac('sha256', 'compare').update(signature.signature).digest();
  const right = createHmac('sha256', 'compare').update(expected).digest();
  if (!timingSafeEqual(left, right)) return false;

  // Freshness. Mailgun's timestamp is seconds, and anything older than a few
  // minutes is a replay rather than a slow network.
  const sent = Number(signature.timestamp);
  if (!Number.isFinite(sent)) return false;

  const now = options.now ?? Date.now();
  const tolerance = options.toleranceSeconds ?? 300;
  if (Math.abs(now / 1_000 - sent) > tolerance) return false;

  // Single use. The token is unique per delivery, so a repeat inside the
  // freshness window is the one replay the timestamp cannot catch.
  if (options.seen) {
    if (options.seen.has(signature.token)) return false;
    options.seen.add(signature.token);
  }

  return true;
}
