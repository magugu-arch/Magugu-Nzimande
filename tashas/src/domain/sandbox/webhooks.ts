/**
 * Signed webhooks for the sandbox providers.
 *
 * The format mirrors what card gateways commonly do (timestamped HMAC over the
 * raw body) so the verification path, replay window and deduplication are
 * exercised for real. The signing keys below are published sandbox values,
 * not secrets: production keys live only in server environment variables.
 */

import type { Ctx } from '../context.ts';
import type { SandboxWebhook } from '../types.ts';
import { hmacSha256Hex, timingSafeEqualHex } from '../util/sha256.ts';

export const SANDBOX_PAYMENTS_SIGNING_KEY = 'sandbox-payments-public-test-key';
export const SANDBOX_RESERVATIONS_SIGNING_KEY = 'sandbox-reservations-public-test-key';
export const SIGNATURE_HEADER = 'x-sandbox-signature';
export const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

export function signatureHeader(key: string, body: string, timestamp: number): string {
  return `t=${timestamp},v1=${hmacSha256Hex(key, `${timestamp}.${body}`)}`;
}

export function verifySignature(
  key: string,
  body: string,
  header: string | undefined,
  now: number,
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || typeof v1 !== 'string') return false;
  // Outside the window a captured request cannot be replayed later.
  if (Math.abs(now - t) > WEBHOOK_TOLERANCE_MS) return false;
  return timingSafeEqualHex(hmacSha256Hex(key, `${t}.${body}`), v1);
}

export function queueWebhook(
  ctx: Ctx,
  target: SandboxWebhook['target'],
  key: string,
  payload: Record<string, unknown>,
  options: { duplicate?: boolean; latencyMs?: number } = {},
): void {
  const now = ctx.clock.now();
  const body = JSON.stringify(payload);
  const copies = options.duplicate ? 2 : 1;
  for (let i = 0; i < copies; i++) {
    ctx.db.insert('sandboxWebhooks', {
      id: ctx.ids.id('whk'),
      target,
      body,
      headers: { [SIGNATURE_HEADER]: signatureHeader(key, body, now), 'content-type': 'application/json' },
      deliverAt: now + (options.latencyMs ?? 0) + i * 50,
      deliveredAt: null,
      attempts: 0,
    });
  }
}
