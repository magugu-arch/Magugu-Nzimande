import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password storage.
 *
 * scrypt, because it is in the standard library and is memory-hard: a stolen
 * table of these costs an attacker real hardware per guess rather than a GPU's
 * worth of hashes a second. bcrypt or argon2 would be equally defensible and
 * both are dependencies; this is not.
 *
 * The stored string carries the parameters it was made with, so raising the
 * cost later does not invalidate every existing password — an old hash still
 * verifies against the settings it was written with, and can be upgraded the
 * next time its owner signs in.
 */

const FORMAT = 'scrypt';
/** 2^15. High enough to hurt, low enough for a request to finish. */
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_BYTES = 64;
const SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password.normalize('NFKC'), salt, KEY_BYTES, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    // scrypt at this cost needs more than Node's default 32 MB allowance.
    maxmem: 256 * 1024 * 1024,
  });

  return [
    FORMAT,
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Whether this password made that hash.
 *
 * Returns false rather than throwing on a stored value it cannot read. A
 * corrupt row should refuse one person's sign-in, not 500 the endpoint for
 * everybody and tell the caller which rows are malformed.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6) return false;

  const [format, cost, blockSize, parallelism, salt, expected] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (format !== FORMAT) return false;

  const n = Number(cost);
  const r = Number(blockSize);
  const p = Number(parallelism);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // A stored cost is an instruction to allocate memory. Read from our own
  // database, but bounded anyway: one bad row should not be able to ask for
  // sixteen gigabytes and take the process down.
  if (n < 1_024 || n > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  const expectedBytes = Buffer.from(expected, 'base64');

  let derived: Buffer;
  try {
    derived = scryptSync(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expectedBytes.length, {
      N: n,
      r,
      p,
      maxmem: 256 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  if (derived.length !== expectedBytes.length) return false;
  return timingSafeEqual(derived, expectedBytes);
}

/**
 * A hash of a password nobody has.
 *
 * Sign-in verifies against this when the email is unknown, so a request for an
 * address that has never registered costs the same time as one for an address
 * that has. Without it the endpoint answers "no such account" measurably faster
 * than "wrong password" and becomes a way to test which addresses are customers.
 */
export const ABSENT_ACCOUNT_HASH = hashPassword(randomBytes(32).toString('hex'));
