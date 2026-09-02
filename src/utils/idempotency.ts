/**
 * A key that lets a server recognise the same order attempt twice
 * (brief §7, §9).
 *
 * Checkout already refuses to re-offer the Place order button after a payment
 * whose outcome is unknown, which handles the retry a *person* makes. This is
 * for the retry nobody chooses: a POST that times out on the wire and is sent
 * again, an app resumed mid-submit, a proxy replaying a request. Any of those
 * reaches a real backend twice with an identical basket, and without a key to
 * match them by, the backend cannot tell a duplicate from a customer who
 * genuinely wants two of the same order — because those are indistinguishable
 * requests.
 *
 * ── On the source of randomness ────────────────────────────────────────────
 * `crypto.randomUUID` is used where it exists and is not assumed to. React
 * Native's Hermes runtime has no `crypto` global at all, and on web it is only
 * exposed in a secure context — so on a device this falls back, every time,
 * and the fallback is the path that matters rather than a curiosity.
 *
 * The fallback is not cryptographic and does not need to be: an idempotency key
 * is a correlation token, not a secret. Nothing is authorised by holding one,
 * and a server that treats it as authority has a different bug. What it does
 * need is not to collide, and it draws on the clock, a per-process counter and
 * two random runs — so two keys from one device collide only within the same
 * millisecond *and* on the counter, which cannot happen, and across devices
 * only by also matching both random runs.
 */

let counter = 0;

function randomRun(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

export function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;

  counter = (counter + 1) % 0xffff;
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(4, '0');
  return `${time}-${seq}-${randomRun()}${randomRun()}`;
}
