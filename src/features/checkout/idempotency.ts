/**
 * One key per checkout attempt, held until that attempt succeeds.
 *
 * The brief's acceptance criterion is that a checkout retry cannot create a
 * duplicate order. The sequence in `submitOrder` already refuses to leave a
 * hold against an order that never happened, but it could not make a *retry*
 * safe: every call minted a fresh order, so a customer who tapped again after
 * a dropped connection got a second order at full price, and the app had to
 * tell them to go and check their banking app instead.
 *
 * A key fixes that, but only if it survives the failure. A key regenerated per
 * call is a different key, and a different key is a different order — which is
 * the bug it was supposed to prevent, wearing a header. So the key is minted
 * once and kept until the order is placed:
 *
 *   mint  → attempt → fails   → same key → attempt → the original order
 *   mint  → attempt → placed  → cleared  → next basket gets a new key
 *
 * It is deliberately *not* derived from the basket contents. Two identical
 * orders placed twenty minutes apart are two orders a customer wants, and
 * hashing the basket would silently collapse them into one.
 */

/** RFC 4122-shaped, from the best randomness the runtime offers. */
function randomKey(): string {
  const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }

  if (globalCrypto?.getRandomValues) {
    const bytes = globalCrypto.getRandomValues(new Uint8Array(16));
    // Version 4, variant 1, so the value is a well-formed UUID rather than 32
    // random nibbles that only look like one.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  /**
   * Last resort, and it has to be one: a key that repeats across two devices
   * would make one customer's order answer another's retry. Time plus two
   * random draws is weak next to a CSPRNG but is not a counter, and every
   * runtime this app ships on has `crypto` — Hermes included.
   */
  const stamp = Date.now().toString(16);
  const noise = `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  return `${stamp}-${noise.slice(0, 20)}`;
}

/**
 * Holds the key for the attempt in progress.
 *
 * A tiny object rather than a module-level variable so a test can have its own,
 * and so two checkout screens can never share one.
 */
export interface IdempotencyScope {
  /** The key for the current attempt, minting one if there is not one yet. */
  current(): string;
  /** Called once the order exists, so the next basket starts clean. */
  settle(): void;
  /** Whether an attempt is currently held. Exposed for assertions. */
  isHeld(): boolean;
}

export function createIdempotencyScope(mint: () => string = randomKey): IdempotencyScope {
  let key: string | null = null;

  return {
    current() {
      if (key === null) key = mint();
      return key;
    },
    settle() {
      key = null;
    },
    isHeld() {
      return key !== null;
    },
  };
}

/** The header the key travels in, alongside its place in the request body. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
