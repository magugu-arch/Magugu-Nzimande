import { NextResponse } from 'next/server';
import { verifyMailgunSignature } from '@/lib/notifications/mailgun';
import { mailgunWebhookKey } from '@/lib/notifications/registry';
import { reasonForMailgunEvent, suppress } from '@/lib/notifications/suppression';
import { claimOnce } from '@/lib/once';
import { logger } from '@/lib/observability/log';

/**
 * POST /api/notifications/webhook — Mailgun telling us a message failed.
 *
 * Bounces and complaints, and the reason this endpoint is worth having: a
 * bounced order confirmation means a customer never got their order number,
 * and a complaint means somebody has withdrawn consent and we are obliged to
 * stop rather than to make a note.
 *
 * Mailgun signs the timestamp and token, not the payload. So unlike the payment
 * and courier callbacks, a valid signature here does not vouch for the body —
 * it only proves the request came from Mailgun. The freshness window and the
 * single-use token are what make the rest of it safe to act on.
 */
export async function POST(request: Request) {
  const key = mailgunWebhookKey();
  if (!key) {
    return NextResponse.json({ error: 'No email provider is configured' }, { status: 501 });
  }

  let payload: { signature?: unknown; 'event-data'?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Send a JSON body' }, { status: 400 });
  }

  const signature = payload.signature as
    | { timestamp?: unknown; token?: unknown; signature?: unknown }
    | undefined;

  if (
    typeof signature?.timestamp !== 'string' ||
    typeof signature?.token !== 'string' ||
    typeof signature?.signature !== 'string'
  ) {
    return NextResponse.json({ error: 'Signature rejected' }, { status: 401 });
  }

  const verified = verifyMailgunSignature(
    { timestamp: signature.timestamp, token: signature.token, signature: signature.signature },
    key,
  );
  if (!verified) {
    return NextResponse.json({ error: 'Signature rejected' }, { status: 401 });
  }

  /**
   * Single use, claimed rather than asked about.
   *
   * The freshness window lives in verifyMailgunSignature; this is the other
   * half, and it needs the shared state every worker reads. It used to be a
   * `tokenAlreadySeen` check up above the signature test and a `rememberToken`
   * write down here — two operations, so two redeliveries arriving together
   * both passed the check and both acted.
   *
   * 200 and not 401 on a replay. It was genuinely Mailgun and we have already
   * acted on it; answering an error would have them redeliver something we
   * would refuse again.
   *
   * After the signature check rather than before it, which is the order the
   * split version could not have: an unverified caller must not be able to
   * spend a token, and the claim is now the thing that spends it.
   */
  if (!claimOnce('webhookTokens', signature.token)) {
    return NextResponse.json({ received: true, replayed: true });
  }

  const data = (payload['event-data'] ?? {}) as {
    event?: unknown;
    recipient?: unknown;
    severity?: unknown;
  };
  const event = typeof data.event === 'string' ? data.event : '';
  const recipient = typeof data.recipient === 'string' ? data.recipient : '';

  /**
   * Mailgun reports a soft bounce as `failed` with `severity: temporary`, and
   * a hard one as `failed` with `severity: permanent`. Reading the event alone
   * would suppress a customer whose mailbox was briefly full.
   */
  if (event === 'failed' && data.severity === 'temporary') {
    logger.info('email.soft_bounce', { recipient });
    return NextResponse.json({ received: true, suppressed: false, reason: 'temporary' });
  }

  const reason = reasonForMailgunEvent(event);
  if (!reason || !recipient) {
    // Delivered, opened, clicked — real events that change nothing here.
    return NextResponse.json({ received: true, suppressed: false });
  }

  suppress(recipient, reason);
  logger.warn('email.suppressed', { recipient, reason });

  return NextResponse.json({ received: true, suppressed: true, reason });
}
