/** A fresh idempotency key for one user intent. Reuse the same key when retrying that intent. */
export function newIdempotencyKey(scope: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${random}`;
}
