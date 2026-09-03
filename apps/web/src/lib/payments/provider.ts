import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentEvent } from '@bbq/types';

/**
 * What a payment gateway has to look like to the rest of this application.
 *
 * No provider has been selected and no merchant credentials exist, so there is
 * no adapter here for a named gateway. This is the seam one drops into: three
 * methods, none of which know anything about orders, baskets or the menu.
 *
 * The interface is shaped by the two things that go wrong with payment
 * integrations rather than by any provider's SDK:
 *
 *  - The amount is never a parameter the caller can be tricked into. It is read
 *    off the order server-side and handed here; a provider adapter cannot ask
 *    for one.
 *  - Verification is separate from parsing, and comes first. Every gateway
 *    signs its callbacks and every rushed integration reads the body before
 *    checking, which turns a public URL into a way to mark orders paid.
 */

export type IntentRequest = {
  /** Our own intent id, sent so the provider echoes it back on the event. */
  reference: string;
  amountCents: number;
  currency: 'ZAR';
  /** For the provider's receipt, not for us. */
  description: string;
};

export type IntentResult =
  | { ok: true; providerRef: string; redirectUrl: string | null }
  | { ok: false; error: string };

export interface PaymentProvider {
  /** Recorded on the intent so a reconciliation knows who took the money. */
  readonly name: string;

  /** Opens a payment for an amount the server has already decided. */
  createIntent(request: IntentRequest): Promise<IntentResult>;

  /**
   * Whether this callback really came from the provider.
   *
   * Takes the raw body rather than a parsed object: a signature covers the
   * bytes that were sent, and re-serialising parsed JSON does not reliably
   * reproduce them.
   */
  verify(rawBody: string, headers: Headers): boolean;

  /** The event this callback carries, or null if it is not one we act on. */
  parse(rawBody: string): PaymentEvent | null;
}

/**
 * HMAC-SHA256 over the raw body, compared without leaking where it differs.
 *
 * Offered here rather than left to each adapter because it is what almost every
 * gateway does, and because a comparison written per-adapter is a comparison
 * written with `===` by the third adapter.
 */
export function signBody(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function signatureMatches(rawBody: string, secret: string, claimed: string): boolean {
  const expected = signBody(rawBody, secret);
  // Hashed before comparing so the buffers are the same length whatever the
  // caller sent: timingSafeEqual throws on a length mismatch, and a throw is
  // itself a signal about the secret.
  const left = createHmac('sha256', 'compare').update(claimed).digest();
  const right = createHmac('sha256', 'compare').update(expected).digest();
  return timingSafeEqual(left, right);
}
