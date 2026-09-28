import { isDomainError } from '@/domain/shared/errors';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { addGuest, ADMIN, ledgerTotals, makeBackend, STAFF, type TestBackend } from './support/backend';

function expectInvariants(b: TestBackend, accountId: string) {
  const account = b.db.rewardAccounts.require(accountId);
  const totals = ledgerTotals(b, accountId);
  expect(account.balancePoints).toBe(totals.sum);
  expect(account.balancePoints).toBe(totals.lots);
  expect(account.balancePoints).toBeGreaterThanOrEqual(0);
}

async function member(b: TestBackend, points = 0) {
  const guest = addGuest(b);
  const account = b.rewards.optIn(guest.id, guest);
  if (points) await b.rewards.earn(account.id, points, 'seed', 'campaign');
  return { guest, account };
}

describe('membership', () => {
  it('opens an account only on opt-in, at the first tier, with a referral code', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    await expect(b.rewards.getAccount(guest.id)).rejects.toThrow('Join MÁBU Rewards');
    const account = b.rewards.optIn(guest.id, guest);
    expect(account.tierId).toBe('member');
    expect(b.rewards.optIn(guest.id, guest).id).toBe(account.id);
    expect(b.db.guests.require(guest.id).referralCode).toMatch(/^MABU-/);
  });

  it('does not earn for guests who have not opted in', async () => {
    const b = makeBackend();
    const guest = addGuest(b);
    expect(await b.rewards.applyTrigger('completed_visit', guest.id, 'reservation', 'r1')).toEqual([]);
    expect(b.db.rewardAccounts.count()).toBe(0);
  });
});

describe('earning and tiers', () => {
  it('earns once per reference and moves up a tier with a notification', async () => {
    const b = makeBackend();
    const { guest, account } = await member(b);
    await b.rewards.earn(account.id, 1000, 'r1', 'reservation');
    await b.rewards.earn(account.id, 1000, 'r1', 'reservation');
    await b.rewards.earn(account.id, 600, 'r2', 'reservation');
    const fresh = await b.rewards.getAccount(guest.id);
    expect(fresh.balancePoints).toBe(1600);
    expect(fresh.tierId).toBe('signature');
    const progress = b.rewards.progress(fresh);
    expect(progress.next?.id).toBe('prive');
    expect(progress.pointsToNext).toBe(2400);
    expect(b.notifications.inbox(guest.id, guest).some((i) => i.title === 'Welcome to Signature')).toBe(true);
    expectInvariants(b, account.id);
  });

  it('scales purchase points by spend', async () => {
    const b = makeBackend();
    const { account } = await member(b);
    const [tx] = await b.rewards.applyTrigger('purchase', account.guestId, 'voucher', 'v1', 150_000);
    expect(tx?.points).toBe(150);
  });

  it('respects rule changes made in admin without a release', async () => {
    const b = makeBackend();
    const { account } = await member(b);
    const rule = b.db.rewardRules.require('rule-visit');
    b.rewards.upsertRule({ ...rule, points: 400 }, ADMIN);
    await b.rewards.applyTrigger('completed_visit', account.guestId, 'reservation', 'r9');
    expect(b.db.rewardAccounts.require(account.id).balancePoints).toBe(400);
    expect(() => b.rewards.upsertRule({ ...rule, points: 1 }, STAFF)).toThrow();
  });

  it('caps referral credit and refuses self-referral', async () => {
    const b = makeBackend();
    const { guest: referrer } = await member(b);
    const code = b.db.guests.require(referrer.id).referralCode!;
    b.rewards.updateSettings({ referralMonthlyCap: 2 }, ADMIN);
    for (let i = 0; i < 4; i++) {
      const friend = b.guests.findOrCreate({ email: `friend${i}@example.com`, name: `Friend ${i}`, referralCode: code });
      await b.rewards.creditReferral(friend.id);
      await b.rewards.creditReferral(friend.id);
    }
    expect(b.db.rewardAccounts.find((a) => a.guestId === referrer.id)?.balancePoints).toBe(600);
  });
});

describe('redemption', () => {
  it('redeems an eligible reward exactly once per intent and issues a code', async () => {
    const b = makeBackend();
    const { guest, account } = await member(b, 1300);
    const key = newIdempotencyKey();
    const [one, two] = await Promise.all([
      b.rewards.redeemReward(account.id, 'rw-pairing', key, guest),
      b.rewards.redeemReward(account.id, 'rw-pairing', key, guest),
    ]);
    expect(one.redemption.id).toBe(two.redemption.id);
    expect(one.redemption.code).toMatch(/^RW-/);
    expect(b.db.rewardAccounts.require(account.id).balancePoints).toBe(100);
    expect(b.db.rewardRedemptions.count()).toBe(1);
    await expect(b.rewards.redeemReward(account.id, 'rw-pairing', newIdempotencyKey(), guest)).rejects.toThrow(
      /1100 more points/,
    );
    expectInvariants(b, account.id);
  });

  it('keeps tier-locked rewards for their tier', async () => {
    const b = makeBackend();
    const { guest, account } = await member(b, 1000);
    const available = await b.rewards.getAvailableRewards(guest.id);
    expect(available.map((r) => r.id)).not.toContain('rw-priority');
    const error = await b.rewards.redeemReward(account.id, 'rw-priority', newIdempotencyKey(), guest).catch((e) => e);
    expect(isDomainError(error) && error.code).toBe('NOT_ELIGIBLE');
  });

  it('lets staff honour a code once, and never again', async () => {
    const b = makeBackend();
    const { guest, account } = await member(b, 600);
    const { redemption } = await b.rewards.redeemReward(account.id, 'rw-amuse', newIdempotencyKey(), guest);
    expect(b.rewards.useRedemption(redemption.code, STAFF).status).toBe('used');
    expect(() => b.rewards.useRedemption(redemption.code, STAFF)).toThrow(/already used/);
    expect(() => b.rewards.useRedemption(redemption.code, guest)).toThrow();
  });
});

describe('expiry', () => {
  it('lapses unspent points FIFO and can never create a negative balance', async () => {
    const b = makeBackend();
    const { account, guest } = await member(b);
    await b.rewards.earn(account.id, 500, 'old', 'reservation');
    b.clock.set('2027-03-01T09:00:00+02:00');
    await b.rewards.earn(account.id, 300, 'new', 'reservation');
    // Spend 400: comes from the older lot first.
    b.rewards.upsertReward({ ...b.db.rewards.require('rw-amuse'), pointsCost: 400 }, ADMIN);
    await b.rewards.redeemReward(account.id, 'rw-amuse', newIdempotencyKey(), guest);

    expect(b.rewards.expiringSoon(account.id)).toEqual([]);
    b.clock.set('2027-09-15T09:00:00+02:00');
    expect(b.rewards.expiringSoon(account.id).map((l) => l.points)).toEqual([100]);

    b.clock.set('2027-10-02T09:00:00+02:00');
    const lapsed = await b.rewards.processExpiry();
    expect(lapsed.map((t) => t.points)).toEqual([-100]);
    expect(await b.rewards.processExpiry()).toEqual([]);
    expect(b.db.rewardAccounts.require(account.id).balancePoints).toBe(300);
    expectInvariants(b, account.id);

    b.clock.set('2028-03-02T09:00:00+02:00');
    await b.rewards.processExpiry();
    expect(b.db.rewardAccounts.require(account.id).balancePoints).toBe(0);
    expectInvariants(b, account.id);
  });
});

describe('admin corrections', () => {
  it('adjusts, never below zero, and audits it', async () => {
    const b = makeBackend();
    const { account } = await member(b, 200);
    await b.rewards.adjust(account.id, 150, 'Service recovery', ADMIN);
    await expect(b.rewards.adjust(account.id, -1000, 'Oops', ADMIN)).rejects.toThrow(/only 350/);
    await b.rewards.adjust(account.id, -50, 'Correction', ADMIN);
    expect(b.db.rewardAccounts.require(account.id).balancePoints).toBe(300);
    expect(b.db.audit.count((a) => a.action === 'reward.adjusted')).toBe(2);
    expectInvariants(b, account.id);
  });

  it('reverses an earn (unspent part only) and a redemption, each once', async () => {
    const b = makeBackend();
    const { guest, account } = await member(b);
    const earn = await b.rewards.earn(account.id, 700, 'r1', 'reservation');
    const { transaction } = await b.rewards.redeemReward(account.id, 'rw-amuse', newIdempotencyKey(), guest);
    // 500 of the 700 is spent, so reversing the earn removes the 200 left.
    await b.rewards.reverse(earn.id, 'Visit logged in error', ADMIN);
    expect(b.db.rewardAccounts.require(account.id)).toMatchObject({ balancePoints: 0, lifetimePoints: 500 });
    await b.rewards.reverse(transaction.id, 'Reward not honoured', ADMIN);
    expect(b.db.rewardAccounts.require(account.id).balancePoints).toBe(500);
    expect(b.db.rewardRedemptions.list()[0]?.status).toBe('cancelled');
    await expect(b.rewards.reverse(earn.id, 'again', ADMIN)).rejects.toThrow(/already been reversed/);
    expectInvariants(b, account.id);
  });
});
