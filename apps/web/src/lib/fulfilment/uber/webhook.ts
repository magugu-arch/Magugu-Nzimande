import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Uber's webhook signature.
 *
 * HMAC-SHA256 over the payload, hex, in the `x-uber-signature` header, keyed by
 * the signing key issued when the webhook was created.
 *
 * The example that circulates for this — including in Uber's own community
 * material — verifies `JSON.stringify(req.body)`, which re-serialises a parsed
 * object and hopes it comes back byte-identical. It usually does, which is what
 * makes it dangerous: it survives testing and then fails on the first payload
 * whose key order, unicode escaping or number formatting differs from whatever
 * the framework's parser produced. This verifies the raw bytes, which is the
 * only thing a signature was ever taken over.
 */

const SIGNATURE_HEADER = 'x-uber-signature';

export const UBER_SIGNATURE_HEADER = SIGNATURE_HEADER;

export function signPayload(rawBody: string, signingKey: string): string {
  return createHmac('sha256', signingKey).update(rawBody, 'utf8').digest('hex');
}

export function signatureMatches(rawBody: string, signingKey: string, claimed: string): boolean {
  const expected = signPayload(rawBody, signingKey);

  // Hashed before comparing so the buffers are always the same length:
  // timingSafeEqual throws on a mismatch, and a throw is itself a signal about
  // how close a guess was.
  const left = createHmac('sha256', 'compare').update(claimed).digest();
  const right = createHmac('sha256', 'compare').update(expected).digest();
  return timingSafeEqual(left, right);
}

export function verifyWebhook(rawBody: string, headers: Headers, signingKey: string): boolean {
  const claimed = headers.get(SIGNATURE_HEADER);
  if (!claimed) return false;
  return signatureMatches(rawBody, signingKey, claimed);
}

export type DeliveryEvent = {
  /** Uber's delivery id, which is what we recorded as the handoff reference. */
  deliveryId: string;
  /** Our own order id, echoed back from `external_id`. */
  orderId: string | null;
  status: string;
  /** Present on a courier update; absent on most status changes. */
  etaMinutes: number | null;
};

/**
 * The event, or null if this is not one we act on.
 *
 * Uber sends several kinds down one webhook — status changes, courier position
 * updates, refunds. Anything without a delivery id and a status is not a
 * delivery moving, and is skipped rather than treated as one.
 */
export function parseDeliveryEvent(rawBody: string): DeliveryEvent | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;

  const deliveryId =
    stringOf(payload.delivery_id) ?? stringOf(data.id) ?? stringOf(data.delivery_id);
  const status = stringOf(payload.status) ?? stringOf(data.status);
  if (!deliveryId || !status) return null;

  const eta = data.dropoff_eta ?? data.pickup_eta;

  return {
    deliveryId,
    orderId: stringOf(payload.external_id) ?? stringOf(data.external_id),
    status,
    etaMinutes: typeof eta === 'number' && Number.isFinite(eta) ? Math.round(eta) : null,
  };
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
