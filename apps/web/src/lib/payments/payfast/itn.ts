import { randsToCents, sign } from './encoding';

/**
 * PayFast's Instant Transaction Notification, and the four checks their
 * documentation asks a receiver to make before believing one.
 *
 * All four matter, and they guard different things:
 *
 *  1. The signature proves whoever sent it knows the passphrase.
 *  2. The source proves it came from PayFast rather than from someone who
 *     learned the passphrase from a leaked log.
 *  3. The amount proves it is about the order we think it is about, at the
 *     price we asked for.
 *  4. The postback proves PayFast itself still agrees the payment happened —
 *     the only check that catches a replay of a genuine, correctly signed
 *     notification.
 *
 * Steps 1 and 3 are here; 3 is enforced by the ledger, which already refuses an
 * amount that is not the one it asked for. Step 2 and step 4 need the network
 * and are below, both failing closed.
 */

/** Where a notification is posted back for confirmation. */
const VALIDATE_PATH = '/eng/query/validate';

export const PAYFAST_HOSTS = {
  live: 'www.payfast.co.za',
  sandbox: 'sandbox.payfast.co.za',
} as const;

/**
 * The hosts PayFast sends notifications from.
 *
 * Their documentation gives a list of hostnames rather than addresses, because
 * the addresses change. Checked by resolving these and comparing, rather than
 * by hard-coding a netblock that will quietly stop matching one day and reject
 * every payment.
 */
export const NOTIFY_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
] as const;

/** The fields as they arrived, in order. Order is what the signature is over. */
export function entriesOf(rawBody: string): [string, string][] {
  return [...new URLSearchParams(rawBody).entries()];
}

/**
 * Step 1 — the signature.
 *
 * Everything except `signature` itself, in the order received. Re-sorting or
 * round-tripping through a plain object first produces a signature that looks
 * plausible and never matches.
 */
export function signatureMatches(rawBody: string, passphrase?: string): boolean {
  const entries = entriesOf(rawBody);
  const claimed = entries.find(([key]) => key === 'signature')?.[1];
  if (!claimed) return false;

  const expected = sign(
    entries.filter(([key]) => key !== 'signature'),
    passphrase,
  );

  // Both are hex of the same length, so a plain comparison leaks only whether
  // two hashes differ — but constant time costs nothing here and the habit is
  // worth more than the microseconds.
  return timingSafeStringEquals(claimed, expected);
}

function timingSafeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Step 2 — did it come from PayFast.
 *
 * The resolver is injected so this can be tested without DNS, and so a
 * deployment behind a proxy that rewrites the source address can supply its
 * own. Fails closed: an address that cannot be resolved is not accepted.
 */
export type Resolver = (host: string) => Promise<string[]>;

export async function fromPayfast(sourceIp: string | null, resolve: Resolver): Promise<boolean> {
  if (!sourceIp) return false;

  const settled = await Promise.allSettled(NOTIFY_HOSTS.map((host) => resolve(host)));
  const allowed = new Set(
    settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
  );

  // Every lookup failed: DNS is down, or there is no outbound access. Refusing
  // is the safe answer, and it is loud — payments stop rather than being
  // quietly accepted from anywhere.
  if (allowed.size === 0) return false;
  return allowed.has(normaliseIp(sourceIp));
}

/** IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is the same address, written differently. */
function normaliseIp(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

/**
 * Step 4 — ask PayFast whether it really sent this.
 *
 * The notification is posted back verbatim and PayFast answers `VALID` or
 * `INVALID`. This is the only check that catches a replay: a notification
 * captured off the wire is correctly signed and comes from a plausible address
 * for as long as the attacker can arrange it, and PayFast is the only party who
 * knows it has already been settled.
 *
 * Fails closed. If the postback cannot be made, the notification is not
 * believed, and outbound access to PayFast is a deployment requirement rather
 * than a nicety.
 */
export async function postbackValid(
  rawBody: string,
  options: { sandbox: boolean; fetcher?: typeof fetch; timeoutMs?: number },
): Promise<boolean> {
  const host = options.sandbox ? PAYFAST_HOSTS.sandbox : PAYFAST_HOSTS.live;
  const send = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  try {
    const response = await send(`https://${host}${VALIDATE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      // Sent exactly as received, signature included. PayFast is comparing it
      // against what it holds, so anything re-encoded on the way is a mismatch.
      body: rawBody,
      signal: controller.signal,
    });

    if (!response.ok) return false;
    return (await response.text()).trim().split('\n')[0]?.trim() === 'VALID';
  } catch {
    // A timeout, a DNS failure, a proxy refusing the connection. None of them
    // is evidence the payment happened.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The amount PayFast says was actually taken.
 *
 * `amount_gross` is what the customer paid; `amount_net` is what the merchant
 * receives after PayFast's fee. The order is settled against gross, because
 * that is what the customer agreed to and what the ledger asked for — settling
 * against net would refuse every payment for being a few rand short.
 */
export function grossCents(entries: [string, string][]): number | null {
  const gross = entries.find(([key]) => key === 'amount_gross')?.[1];
  return gross === undefined ? null : randsToCents(gross);
}
