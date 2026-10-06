import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, readSessionToken } from '@/lib/auth/session-token';
import { pfEncode, pfSignature } from '@/lib/payments/payfast';

describe('PayFast signature', () => {
  it('encodes like PHP urlencode', () => {
    expect(pfEncode('Zakes Bantwini — deposit')).toBe('Zakes+Bantwini+%E2%80%94+deposit');
    expect(pfEncode("it's (a) test!*~")).toBe('it%27s+%28a%29+test%21%2A%7E');
    expect(pfEncode('https://x.co/a?b=c&d')).toBe('https%3A%2F%2Fx.co%2Fa%3Fb%3Dc%26d');
  });

  it('is MD5 over the ordered fields, then the passphrase', () => {
    const fields: [string, string][] = [
      ['merchant_id', '10000100'],
      ['merchant_key', '46f0cd694581a'],
      ['amount', '100.00'],
      ['item_name', 'Test Item'],
    ];
    const expected = createHash('md5')
      .update('merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test+Item&passphrase=jt7NOE43FZPn')
      .digest('hex');
    expect(pfSignature(fields, 'jt7NOE43FZPn')).toBe(expected);
    expect(pfSignature(fields)).not.toBe(expected);
  });
});

describe('admin passwords and sessions', () => {
  it('hashes with scrypt and verifies only the right password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse battery!', hash)).toBe(false);
  });

  it('refuses short passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow();
  });

  it('signs sessions that expire and cannot be altered', () => {
    const { token } = createSessionToken('user-1', 'scrypt$hash', 1_000);
    expect(readSessionToken(token, 2_000)?.userId).toBe('user-1');
    expect(readSessionToken(token, 1_000 + 9 * 3_600_000)).toBeNull();
    expect(readSessionToken(token.replace('user-1', 'user-2'), 2_000)).toBeNull();
    expect(readSessionToken('a.b.c', 2_000)).toBeNull();
  });

  it('ties sessions to the password, so changing it signs everyone out', () => {
    const a = createSessionToken('u', 'scrypt$old', 0).token;
    const b = createSessionToken('u', 'scrypt$new', 0).token;
    expect(readSessionToken(a, 1)?.fingerprint).not.toBe(readSessionToken(b, 1)?.fingerprint);
  });
});
