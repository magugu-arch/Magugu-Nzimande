import type { PaymentMethod } from '@/types';

/**
 * Whether a saved card has run out.
 *
 * `expiry` has been on `PaymentMethod` since the type was written, printed on
 * two screens as "Expires 03/27", and compared to the clock nowhere at all.
 * Both seeded cards expired years from now, so nothing in the app had ever
 * held a card it could not pay with — and an expired one was offered at
 * checkout as an ordinary option. The customer would learn it was dead from
 * the gateway, after committing to the order, at the one moment in the journey
 * where a failure costs the most.
 *
 * This is not a commercial rule being invented. The expiry date is data the
 * app already holds and already shows; reading it is just declining to look
 * away. The gateway will refuse the card either way — all that is decided here
 * is whether the customer finds out before or after they press Place order.
 *
 * ── Two details that are easy to get wrong ─────────────────────────────────
 * A card is valid **through the end** of its expiry month, not up to the 1st.
 * A card marked 03/24 works all through March 2024, so the comparison is
 * against the first instant of the *following* month.
 *
 * An unreadable string is **not** treated as expired. A card whose expiry the
 * app cannot parse is a card the app knows nothing about, and refusing to let
 * somebody pay because of a format nobody anticipated is a worse failure than
 * letting the gateway decide. Absent is the same: rails like SnapScan and cash
 * carry no expiry and must never be filtered out by this.
 */
export function cardHasExpired(expiry: string | undefined, now: Date = new Date()): boolean {
  if (!expiry) return false;

  const match = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(expiry);
  if (!match) return false;

  const month = Number(match[1]);
  const rawYear = Number(match[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;

  // Two digits are the card convention and mean this century. Four are taken
  // as written, so a backend that sends 2027 is not read as the year 27.
  const year = match[2]!.length === 2 ? 2000 + rawYear : rawYear;

  // The first instant of the month *after* the one printed on the card.
  const expiresAfter = new Date(year, month, 1, 0, 0, 0, 0);
  return now.getTime() >= expiresAfter.getTime();
}

/** Whether this is a card that has run out. Rails are never "expired". */
export function methodHasExpired(method: PaymentMethod, now: Date = new Date()): boolean {
  return method.type === 'card' && cardHasExpired(method.expiry, now);
}

/**
 * What the account screen says under a card.
 *
 * "Expires 03/24" on a card that ran out eighteen months ago is not wrong so
 * much as useless — it is the same sentence as the one under a working card,
 * and a customer scanning the list has no way to tell which is which.
 */
export function expiryLabel(method: PaymentMethod, now: Date = new Date()): string | null {
  if (!method.expiry) return null;
  return methodHasExpired(method, now) ? `Expired ${method.expiry}` : `Expires ${method.expiry}`;
}
