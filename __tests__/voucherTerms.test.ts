import { vouchers } from '@/services/data/rewardsData';
import { validateVoucherCode } from '@/services/rewardsService';
import type { Voucher } from '@/types';
import { voucherExpired, voucherQualifies, voucherTerms } from '@/utils/cart';

/**
 * The terms the cart holds, and the second door that dropped one of them.
 *
 * There are two ways a voucher reaches the basket: typed as a code in the
 * cart, or tapped as a card on the vouchers screen. Each wrote the terms
 * object out by hand, and only the cart's copy carried `expiresAt` — so a
 * voucher tapped rather than typed arrived with no date on it, and
 * `voucherExpired` had nothing to read. Every guard built on top of it was
 * absent on that path.
 *
 * Nothing could have failed. The two objects share four identically-spelled
 * fields and differ only in an optional fifth, which is exactly the shape a
 * type checker is required to accept. The defect lived in the gap between two
 * call sites, so the fix is one derivation both of them use.
 */
const cheeseFries: Voucher = {
  id: 'voucher-lapsed',
  code: 'CHEESE40',
  title: 'R40 off Cheesling Fries',
  description: 'Sent during the launch week.',
  discountType: 'fixed',
  discountValue: 40,
  minimumSpend: 150,
  expiresAt: new Date('2026-09-10T00:00:00Z').toISOString(),
  used: false,
  expired: false,
};

describe('the terms a voucher is carried into the basket under', () => {
  it('carries the expiry, so the basket can tell the code has died', () => {
    const terms = voucherTerms(cheeseFries);
    expect(terms.expiresAt).toBe(cheeseFries.expiresAt);

    expect(voucherExpired(terms, new Date('2026-09-09T12:00:00Z'))).toBe(false);
    expect(voucherExpired(terms, new Date('2026-09-11T12:00:00Z'))).toBe(true);
  });

  it('carries what the voucher asks for, and not what it was once worth', () => {
    expect(voucherTerms(cheeseFries)).toEqual({
      code: 'CHEESE40',
      discountType: 'fixed',
      discountValue: 40,
      minimumSpend: 150,
      expiresAt: cheeseFries.expiresAt,
    });
  });

  /**
   * The whole point of deriving it. A voucher that arrives without its date
   * cannot lapse, so it keeps paying out for as long as the basket lives —
   * which is what the vouchers screen did.
   */
  it('a voucher stripped of its date never stops qualifying', () => {
    const dateless = { ...voucherTerms(cheeseFries), expiresAt: undefined };
    const inTenYears = new Date('2036-09-11T12:00:00Z');

    expect(voucherQualifies(dateless, 300, inTenYears)).toBe(true);
    expect(voucherQualifies(voucherTerms(cheeseFries), 300, inTenYears)).toBe(false);
  });

  it('treats an absent expiry as a voucher that never runs out', () => {
    const forever = voucherTerms({
      code: 'ALWAYS',
      discountType: 'percentage',
      discountValue: 10,
      minimumSpend: 0,
    });
    expect(forever.expiresAt).toBeUndefined();
    expect(voucherExpired(forever, new Date('2099-01-01T00:00:00Z'))).toBe(false);
  });
});

describe('the voucher that ran out before anybody spent it', () => {
  const lapsed = vouchers.find((voucher) => voucher.id === 'voucher-lapsed');

  it('is seeded expired and unused, which nothing else was', () => {
    expect(lapsed).toBeDefined();
    expect(lapsed!.used).toBe(false);
    expect(new Date(lapsed!.expiresAt).getTime()).toBeLessThan(Date.now());

    // The state the screen's red "Expired <date>" caption exists for. Before
    // this fixture the only voucher past its date was also used, and `used` is
    // tested first — so that branch had never rendered.
    const expiredAndUnused = vouchers.filter(
      (voucher) => !voucher.used && new Date(voucher.expiresAt).getTime() <= Date.now(),
    );
    expect(expiredAndUnused.map((voucher) => voucher.id)).toEqual(['voucher-lapsed']);
  });

  it('cannot be typed in at checkout either', async () => {
    await expect(validateVoucherCode('CHEESE40', 400)).rejects.toThrow('That code has expired.');
  });

  it('says it expired rather than that it was used', async () => {
    // Both rejections are true of SOYFAN and only one is true of this one.
    // Telling a customer their unused voucher was "already used" invites a
    // support ticket that cannot be resolved, because it is not what happened.
    await expect(validateVoucherCode('SOYFAN', 400)).rejects.toThrow(
      'That code has already been used.',
    );
  });
});
