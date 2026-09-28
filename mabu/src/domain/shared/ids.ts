/**
 * Identifier generation, injectable so tests get stable ids.
 *
 * Human-facing codes (booking references, voucher codes) use an alphabet with
 * no 0/O or 1/I/L, so they survive being read aloud over the phone.
 */
export interface IdGenerator {
  id(prefix: string): string;
  code(length: number): string;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomInt(max: number): number {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return (buf[0] ?? 0) % max;
  }
  return Math.floor(Math.random() * max);
}

export const randomIds: IdGenerator = {
  id(prefix) {
    let s = '';
    for (let i = 0; i < 16; i++) s += randomInt(36).toString(36);
    return `${prefix}_${s}`;
  },
  code(length) {
    let s = '';
    for (let i = 0; i < length; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    return s;
  },
};

/** Deterministic ids for tests and seed data. */
export function sequentialIds(): IdGenerator {
  let n = 0;
  return {
    id(prefix) {
      n += 1;
      return `${prefix}_${String(n).padStart(4, '0')}`;
    },
    code(length) {
      n += 1;
      let s = '';
      let v = n * 7919;
      for (let i = 0; i < length; i++) {
        s += CODE_ALPHABET[v % CODE_ALPHABET.length];
        v = Math.floor(v / CODE_ALPHABET.length) + 13 * (i + 1);
      }
      return s;
    },
  };
}

/** A client-side idempotency key for one user intent (one tap on "Confirm"). */
export function newIdempotencyKey(): string {
  return randomIds.id('idem');
}
