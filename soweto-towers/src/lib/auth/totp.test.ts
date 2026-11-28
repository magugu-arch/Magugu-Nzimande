import { describe, expect, it } from 'vitest';
import { matchTotp, newTotpSecret, verifyTotp } from './totp';

// RFC 6238 appendix B (SHA-1): the ASCII secret "12345678901234567890", base32-encoded.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('two-step sign-in codes (RFC 6238)', () => {
  it('matches the published test vectors (last six digits)', () => {
    expect(matchTotp(RFC_SECRET, '287082', 59_000)).toBe(1);
    expect(verifyTotp(RFC_SECRET, '081804', 1_111_111_109_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '005924', 1_234_567_890_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '279037', 2_000_000_000_000)).toBe(true);
  });

  it('allows one 30-second window of clock drift either way, and no more', () => {
    const at = 1_234_567_890_000;
    expect(matchTotp(RFC_SECRET, '005924', at + 30_000)).toBe(Math.floor(at / 30_000));
    expect(matchTotp(RFC_SECRET, '005924', at - 30_000)).toBe(Math.floor(at / 30_000));
    expect(matchTotp(RFC_SECRET, '005924', at + 60_000)).toBeNull();
  });

  it('rejects malformed codes and tolerates spaces', () => {
    expect(matchTotp(RFC_SECRET, '', 59_000)).toBeNull();
    expect(matchTotp(RFC_SECRET, '28708', 59_000)).toBeNull();
    expect(matchTotp(RFC_SECRET, 'abcdef', 59_000)).toBeNull();
    expect(matchTotp(RFC_SECRET, '287 082', 59_000)).toBe(1);
  });

  it('creates 32-character base32 secrets', () => {
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(newTotpSecret()).not.toBe(s);
  });
});
