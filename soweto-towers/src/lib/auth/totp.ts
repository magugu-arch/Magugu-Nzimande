import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** RFC 6238 time-based one-time passwords (Google Authenticator, Microsoft Authenticator, 1Password). */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}

/** The 30-second window the code belongs to (allowing one window of clock drift), or null. */
export function matchTotp(secret: string, code: string, at = Date.now()): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const key = decode(secret);
  const step = Math.floor(at / 30_000);
  for (const drift of [-1, 0, 1]) {
    const expected = hotp(key, step + drift);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return step + drift;
  }
  return null;
}

export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  return matchTotp(secret, code, at) !== null;
}

export function totpUri(secret: string, account: string): string {
  return `otpauth://totp/${encodeURIComponent(`Soweto Towers:${account}`)}?secret=${secret}&issuer=${encodeURIComponent('Soweto Towers')}&algorithm=SHA1&digits=6&period=30`;
}
