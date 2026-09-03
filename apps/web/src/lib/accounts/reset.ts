import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mutateState, pushAudit, readState } from '../demo-state';
import { hashPassword } from './passwords';
import { findByEmail } from './store';

/**
 * Password reset.
 *
 * The half that needs no provider. A reset is a token minted, delivered, and
 * spent; only the delivery needs a messaging contract, and it goes out through
 * the notification seam like everything else — which on this deployment writes
 * it to the audit log rather than to an inbox. That is visible in the console
 * and cannot be mistaken for a sent email.
 *
 * Three rules, and each of them is a way this goes wrong in the wild:
 *
 *  - Only a hash of the token is stored. A leaked database is then a leaked
 *    list of useless strings rather than a way into every account on it.
 *  - One use. A token that still works after the password has changed is a
 *    second key left under the mat, and reset links live in inboxes for years.
 *  - Requesting a reset for an address that has never registered does exactly
 *    what requesting one for a real address does, and says the same thing.
 */

/** Long enough that guessing is not worth attempting; short enough to paste. */
const TOKEN_BYTES = 32;
/** A reset link is for using now. An hour is generous for finding an email. */
const TOKEN_TTL_MS = 60 * 60 * 1_000;

export type ResetRequest = { accountId: string; token: string } | null;

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Mints a reset for an address, or does nothing if nobody has it.
 *
 * Returns null in the second case, and every caller is expected to answer the
 * customer identically either way. The endpoint must not become a way to find
 * out who has an account here.
 */
export function requestReset(email: string, now = Date.now()): ResetRequest {
  const account = findByEmail(email);
  if (!account) return null;

  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  mutateState((state) => {
    // One live reset per account. Requesting a second invalidates the first,
    // so a customer who clicks twice cannot be confused about which link works,
    // and an attacker cannot bank a supply of them.
    state.passwordResets = state.passwordResets.filter(
      (reset) => reset.accountId !== account.id && reset.expiresAt > now,
    );
    state.passwordResets.push({
      accountId: account.id,
      tokenHash: digest(token),
      expiresAt: now + TOKEN_TTL_MS,
    });
    pushAudit(state, 'accounts', 'A password reset was requested');
  });

  return { accountId: account.id, token };
}

export type ResetOutcome =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Spends a token and sets the new password.
 *
 * The token is looked up by its hash, and compared in constant time even then:
 * a hash lookup that short-circuits on the first differing byte still leaks,
 * and the cost of not caring is zero.
 */
export function completeReset(token: string, password: string, now = Date.now()): ResetOutcome {
  const wanted = digest(token);

  const match = readState().passwordResets.find((reset) => {
    const a = Buffer.from(reset.tokenHash, 'utf8');
    const b = Buffer.from(wanted, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  });

  // Expired and never-existed are the same answer. A caller must not be able to
  // tell a stale link from an invented one.
  if (!match || match.expiresAt <= now) {
    return { ok: false, status: 400, error: 'That reset link is no longer valid' };
  }

  return mutateState((state) => {
    const account = state.accounts.find((candidate) => candidate.id === match.accountId);
    if (!account) {
      return { ok: false, status: 400, error: 'That reset link is no longer valid' };
    }

    account.passwordHash = hashPassword(password);
    // Spent, in the same write as the change it authorised. A token that
    // outlives the password it set is a second key left under the mat.
    state.passwordResets = state.passwordResets.filter(
      (reset) => reset.tokenHash !== match.tokenHash,
    );
    pushAudit(state, 'accounts', 'A password was reset');
    return { ok: true };
  });
}

/** For the tests and the console. Never the tokens themselves — they are not stored. */
export function liveResetCount(now = Date.now()): number {
  return readState().passwordResets.filter((reset) => reset.expiresAt > now).length;
}
