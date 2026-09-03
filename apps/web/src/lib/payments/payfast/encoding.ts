import { createHash } from 'node:crypto';

/**
 * PayFast's signature, which is where most integrations against it go wrong.
 *
 * The signature is an MD5 over the parameters joined as a query string, and
 * PayFast builds that string with PHP's `urlencode()`. JavaScript's
 * `encodeURIComponent` is close and not the same, and the differences are
 * exactly the characters that turn up in a South African address or a product
 * name — an apostrophe in "Nando's", a bracket, a space.
 *
 * MD5 is not a choice made here. It is what PayFast specifies, and a signature
 * scheme is only as good as what the other end checks. It is used for
 * authenticity against a shared passphrase, which is the job it is doing.
 */

/**
 * PHP's urlencode, exactly.
 *
 *  - Space becomes `+`, not `%20`.
 *  - `!`, `'`, `(`, `)`, `*` and `~` are escaped; `encodeURIComponent` leaves
 *    all six alone.
 *  - Hex digits are upper case, which `encodeURIComponent` already does.
 *
 * Getting any of these wrong produces a signature that is wrong only for some
 * payments — the ones whose fields happen to contain that character — which is
 * far worse to diagnose than one that is always wrong.
 */
export function payfastEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * The parameter string a signature is taken over.
 *
 * Order is significant and is the caller's: PayFast signs its notifications in
 * the order the fields arrive, not in alphabetical order, so anything that
 * sorts or round-trips through a plain object first will produce a valid-looking
 * signature that never matches.
 */
export function parameterString(entries: [string, string][], passphrase?: string): string {
  const pairs = entries.map(([key, value]) => `${key}=${payfastEncode(value)}`);

  // The passphrase is appended as though it were a final parameter, and only
  // when the merchant has set one. Appending an empty one gives a signature
  // that fails against an account with no passphrase configured.
  if (passphrase) pairs.push(`passphrase=${payfastEncode(passphrase)}`);

  return pairs.join('&');
}

export function sign(entries: [string, string][], passphrase?: string): string {
  return createHash('md5').update(parameterString(entries, passphrase)).digest('hex');
}

/**
 * Rands as PayFast writes them, to integer cents.
 *
 * Parsed as text rather than through `parseFloat`, because binary floating
 * point cannot hold 129.10 and `Math.round(parseFloat('129.10') * 100)` is one
 * of the classic ways a total ends up a cent out. Everything else in this
 * codebase is integer cents for the same reason.
 */
export function randsToCents(amount: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return null;

  const [, whole, fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** And back, for the amount sent to PayFast, which wants two decimal places. */
export function centsToRands(cents: number): string {
  return (cents / 100).toFixed(2);
}
