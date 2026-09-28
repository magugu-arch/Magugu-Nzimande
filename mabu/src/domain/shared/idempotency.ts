import type { Database } from '../db';
import { DomainError } from './errors';

/**
 * Runs `operation` at most once per (scope, key).
 *
 *   - Same key, same request  → the stored result is returned; nothing runs twice.
 *   - Same key, different request → CONFLICT: a key is one intent, not a session.
 *   - Two calls racing on one key → the second awaits the first's promise.
 *   - The operation throws → nothing is stored, so a retry may try again
 *     (§33: "provider failures must leave the guest in a recoverable state").
 */
const inFlightByDb = new WeakMap<Database, Map<string, Promise<unknown>>>();

export async function idempotent<T>(
  db: Database,
  scope: string,
  key: string,
  request: unknown,
  now: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!key || key.length < 8) {
    throw new DomainError('VALIDATION', 'Please try that again.', 'missing idempotency key');
  }
  const id = `${scope}:${key}`;
  const fingerprint = stableStringify(request);

  const existing = db.idempotency.get(id);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new DomainError(
        'CONFLICT',
        'That request was already made with different details. Please start again.',
        `idempotency fingerprint mismatch for ${id}`,
      );
    }
    return existing.result as T;
  }

  let inFlight = inFlightByDb.get(db);
  if (!inFlight) {
    inFlight = new Map();
    inFlightByDb.set(db, inFlight);
  }
  const running = inFlight.get(id);
  if (running) return running as Promise<T>;

  const promise = (async () => {
    const result = await operation();
    db.idempotency.upsert({ id, scope, key, fingerprint, result, createdAt: now });
    return result;
  })();
  const pending = inFlight;
  pending.set(id, promise);
  try {
    return await promise;
  } finally {
    pending.delete(id);
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
