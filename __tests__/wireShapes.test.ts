import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  checkedRedemption,
  checkedRewards,
  checkedTiers,
  checkedVoucherValidation,
  MalformedResponse,
} from '@/services/wireChecks';
import { tiers } from '@/services/data/rewardsData';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const REWARD = {
  id: 'reward-r20',
  name: 'R20 off your order',
  description: 'Twenty rand off.',
  pointsCost: 400,
  discountValue: 20,
  redeemable: true,
};

/**
 * 1 — the endpoints nothing checked, and why that is the shape of the risk.
 *
 * The backend does not exist. Thirty endpoints are declared, typed and called,
 * and every one is served today by a mock written in this repository by the
 * same hand that wrote the caller. A mock and its caller agree by
 * construction. The real one will be written by somebody else, and the first
 * thing it will do is answer *nearly* right.
 *
 * `wireChecks` is the boundary that catches that, and it covered ten of the
 * forty-eight `request<T>` calls. None of the loyalty ones — the endpoints
 * that carry points a member spends and rand off a bill.
 */
describe('money and points off the wire', () => {
  it('refuses a points cost the app cannot do arithmetic with', () => {
    expect(() => checkedRewards([{ ...REWARD, pointsCost: '400' }])).toThrow(MalformedResponse);
    expect(() => checkedRewards([{ ...REWARD, pointsCost: null }])).toThrow(MalformedResponse);
    expect(() => checkedRewards([{ ...REWARD, pointsCost: Number.NaN }])).toThrow(
      MalformedResponse,
    );
  });

  it('refuses a reward value the app cannot print', () => {
    expect(() => checkedRewards([{ ...REWARD, discountValue: '20.00' }])).toThrow(
      MalformedResponse,
    );
  });

  /**
   * 2 — strict rather than coercing, which is the decision this file already
   * made and is worth holding. `"400"` could be turned into 400 here and
   * everything would work; the next field a backend stringifies is then one
   * nobody notices.
   */
  it('does not quietly coerce a string that would have worked', () => {
    let message = '';
    try {
      checkedRewards([{ ...REWARD, pointsCost: '400' }]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('pointsCost');
    expect(message).toContain('should be a number');
  });

  it('lets a well-formed list through unchanged', () => {
    expect(checkedRewards([REWARD])).toEqual([REWARD]);
    expect(checkedRewards([])).toEqual([]);
  });

  /** 3 — the two shapes a list arrives as when it is not a list. */
  it('refuses an envelope and a null where an array was promised', () => {
    expect(() => checkedRewards({ data: [REWARD] })).toThrow(MalformedResponse);
    expect(() => checkedRewards(null)).toThrow(MalformedResponse);
  });

  /**
   * 4 — the earn rate, which is the number every points figure in the app is
   * multiplied by. A string does not throw where it is used, because `*`
   * coerces. It goes wrong somewhere else, or does not go wrong at all and is
   * simply paid at the wrong rate.
   */
  it('refuses an earn rate that is not a number', () => {
    const good = { tier: 'bronze', name: 'Bronze', threshold: 0, pointsPerRand: 1, perks: [] };

    expect(checkedTiers([good])).toEqual([good]);
    expect(() => checkedTiers([{ ...good, pointsPerRand: '1' }])).toThrow(MalformedResponse);
    expect(() => checkedTiers([{ ...good, threshold: '0' }])).toThrow(MalformedResponse);
  });

  /**
   * 5 — the seeded ladder passes its own check, which is the guard against a
   * check written to a shape the app does not actually use.
   */
  it('accepts the tiers this app ships with', () => {
    expect(() => checkedTiers(tiers)).not.toThrow();
    expect(tiers.length).toBeGreaterThan(0);
  });

  /**
   * 6 — the redemption, which is the moment the points actually leave.
   * `discount` is a separate number on the wire because a delivery reward is
   * worth the fee when there is one and nothing when there is not.
   */
  it('checks the discount as well as the reward it came with', () => {
    expect(() => checkedRedemption({ reward: REWARD, discount: 20 })).not.toThrow();
    expect(() => checkedRedemption({ reward: REWARD, discount: '20' })).toThrow(MalformedResponse);
    expect(() =>
      checkedRedemption({ reward: { ...REWARD, pointsCost: '1' }, discount: 20 }),
    ).toThrow(MalformedResponse);
  });

  /** 7 — and the promo code a customer just typed, answered by the server. */
  it('checks a voucher validation, inside and out', () => {
    const voucher = { code: 'SPICY15', discountValue: 15, minimumSpend: 0 };

    expect(() => checkedVoucherValidation({ voucher, discount: 15 })).not.toThrow();
    expect(() => checkedVoucherValidation({ voucher, discount: '15' })).toThrow(MalformedResponse);
    expect(() =>
      checkedVoucherValidation({ voucher: { ...voucher, discountValue: '15' }, discount: 15 }),
    ).toThrow(MalformedResponse);
  });

  it('is wired into every loyalty call that returns one of them', () => {
    const service = code('src/services/rewardsService.ts');

    expect(service).toMatch(/'\/v1\/loyalty\/rewards', \{ parse: checkedRewards \}/);
    expect(service).toMatch(/'\/v1\/loyalty\/tiers', \{ parse: checkedTiers \}/);
    expect(service).toMatch(/parse: checkedRedemption/);
    expect(service).toMatch(/parse: checkedVoucherValidation/);
  });
});

/**
 * 8 — the defect the sweep actually found, which was quieter than a crash.
 *
 * With `pointsCost` arriving as a string, the check refuses the response
 * correctly and the query errors. The Rewards screen then read
 * `rewards.data ?? []` and told a member holding 9 000 points:
 *
 *     Ready to redeem · 0 rewards you can claim now
 *     Keep ordering — your first reward unlocks at 300 points.
 *
 * Both sentences are claims about that member's account, made by an app that
 * had just failed to read it. The balance above them was gated and honest; the
 * list beneath was not.
 */
describe('the rewards screen, when the server answered and the answer was refused', () => {
  const screen = code('src/app/(tabs)/rewards.tsx');

  it('gates the list the way it already gated the balance', () => {
    expect(screen).toMatch(/if \(loyalty\.isError \|\| !loyalty\.data \|\| rewards\.isError\)/);
  });

  it('retries both queries, since either can be the one that failed', () => {
    const gate = screen.slice(screen.indexOf('rewards.isError'));

    expect(gate.slice(0, 400)).toMatch(/void loyalty\.refetch\(\)/);
    expect(gate.slice(0, 400)).toMatch(/void rewards\.refetch\(\)/);
  });

  /**
   * 9 — and the wallet, which is a third fetch that can fail on its own while
   * everything around it is fine. "No active vouchers right now" is a claim
   * about a wallet nobody could open.
   */
  it('stops claiming the wallet is empty when it could not read the wallet', () => {
    expect(screen).toMatch(/vouchers\.isSuccess/);
    expect(screen).toMatch(/'No active vouchers right now'/);
    expect(screen).toMatch(/'Tap to see your codes'/);
  });

  /**
   * 10 — tiers are deliberately left out of the gate. A failed tier fetch
   * drops the perks block and claims nothing in its place; taking a working
   * rewards list away from somebody over a missing perks list is the trade in
   * the wrong direction.
   */
  it('does not take the whole screen away over a missing perks list', () => {
    expect(screen).not.toMatch(/tiers\.isError \|\|/);
    expect(screen).toMatch(/const currentTier = tiers\.data\?\.find/);
  });
});

/**
 * And the sweep's own honesty, which it failed first.
 *
 * The first run reported five crashed screens. The app had not crashed: the
 * stub answered `/v1/loyalty/tiers` with `{ id, minPoints }` — invented field
 * names — so every case failed for the baseline's reasons rather than its own.
 * A stub that is wrong everywhere proves only that the app dislikes rubbish.
 */
describe('the sweep that found it', () => {
  const audit = code('scripts/audit-wire.mjs');

  it('builds its baseline from the shapes the types actually declare', () => {
    expect(audit).toMatch(/tier: 'bronze'/);
    expect(audit).toMatch(/threshold: 0/);
    expect(audit).toMatch(/perks: \[/);
    expect(audit).toMatch(/memberId: 'member-wire'/);
    // The invented ones are gone.
    expect(audit).not.toMatch(/minPoints:/);
  });

  it('sees the app’s own crash screen, which an error boundary hides', () => {
    expect(audit).toMatch(/data-testid="error-boundary"/);
    expect(audit).toMatch(/crashes\.length > 0 \|\| caughtByBoundary/);
  });

  it('treats the crash screen as never an acceptable answer', () => {
    expect(audit).toMatch(/const CRASHED = /);
    expect(audit).toMatch(/\|\| CRASHED\.test\(text\)/);
  });

  it('is registered, and names what it is for', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(pkg.scripts['audit:wire']).toBe('node scripts/audit-wire.mjs');
    expect(audit).toMatch(/A mock and its caller agree by construction/);
  });
});
