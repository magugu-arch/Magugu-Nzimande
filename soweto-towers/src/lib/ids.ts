import { randomBytes, randomInt } from 'node:crypto';

/** No 0/O, 1/I/L or U: codes get read out over the phone and typed on small keyboards. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function code(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Booking reference, e.g. ST-7K4P2Q. */
export function bookingRef(): string {
  return `ST-${code(6)}`;
}

/** Gift voucher code, e.g. GIFT-7K4P-2QXM. */
export function voucherCode(): string {
  return `GIFT-${code(4)}-${code(4)}`;
}

/** Unguessable secret for ticket links, QR codes and chat sessions. */
export function secretToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function normaliseCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '');
}
