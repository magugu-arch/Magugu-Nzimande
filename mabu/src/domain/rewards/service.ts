import type { ServiceContext } from '../context';
import { audit, nowIso, requireFlag, requireOwnerOrStaff, requireRole } from '../context';
import type { Actor } from '../guests/types';
import { DomainError } from '../shared/errors';
import { idempotent } from '../shared/idempotency';
import type {
  Reward,
  RewardAccount,
  RewardRedemption,
  RewardReferenceType,
  RewardRule,
  RewardsSettings,
  RewardTier,
  RewardTransaction,
  RewardTrigger,
  TierProgress,
} from './types';

export const DEFAULT_REWARDS_SETTINGS: RewardsSettings = {
  id: 'rewards-settings',
  pointsExpiryMonths: 12,
  expiryNoticeDays: 30,
  referralMonthlyCap: 5,
  updatedAt: '2026-09-01T00:00:00+02:00',
};

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

/**
 * MÁBU Rewards (§34–36): a points ledger with tiers, a configurable rules
 * engine, a reward catalogue, one-time redemption and FIFO expiry.
 *
 * Invariants, all asserted in __tests__/rewards.test.ts:
 *   1. balancePoints === Σ ledger points
 *   2. balancePoints === Σ remainingPoints across ledger lots
 *   3. balancePoints is never negative
 *   4. a (rule, reference) pair earns at most once
 *   5. a redemption idempotency key spends at most once
 */
export class RewardsEngine {
  constructor(private readonly ctx: ServiceContext) {}

  /* ── Configuration ──────────────────────────────────────────────────── */

  settings(): RewardsSettings {
    return this.ctx.db.rewardsSettings.get('rewards-settings') ?? DEFAULT_REWARDS_SETTINGS;
  }

  tiers(): RewardTier[] {
    return this.ctx.db.rewardTiers.list().sort((a, b) => a.order - b.order);
  }

  async getRules(): Promise<RewardRule[]> {
    return this.ctx.db.rewardRules.list();
  }

  tierFor(lifetimePoints: number): RewardTier {
    const tiers = this.tiers();
    let current = tiers[0];
    if (!current) throw new DomainError('NOT_FOUND', 'Rewards are not set up yet.', 'no tiers');
    for (const t of tiers) if (lifetimePoints >= t.minLifetimePoints) current = t;
    return current;
  }

  progress(account: RewardAccount): TierProgress {
    const tiers = this.tiers();
    const current = this.tierFor(account.lifetimePoints);
    const next = tiers.find((t) => t.minLifetimePoints > account.lifetimePoints);
    if (!next) return { current, pointsToNext: 0, fraction: 1 };
    const span = next.minLifetimePoints - current.minLifetimePoints;
    return {
      current,
      next,
      pointsToNext: next.minLifetimePoints - account.lifetimePoints,
      fraction: Math.min(
        1,
        Math.max(0, (account.lifetimePoints - current.minLifetimePoints) / span),
      ),
    };
  }

  upsertRule(rule: RewardRule, actor: Actor): RewardRule {
    requireRole(actor, 'admin');
    if (!Number.isInteger(rule.points) || rule.points < 0 || rule.points > 100_000) {
      throw new DomainError(
        'VALIDATION',
        'Points must be a whole number between 0 and 100 000.',
        'points',
      );
    }
    const saved = this.ctx.db.rewardRules.upsert({ ...rule, updatedAt: nowIso(this.ctx) });
    audit(this.ctx, actor, 'reward_rule.saved', 'reward_rule', rule.id, {
      points: rule.points,
      active: rule.active,
    });
    return saved;
  }

  upsertReward(reward: Reward, actor: Actor): Reward {
    requireRole(actor, 'admin');
    if (!Number.isInteger(reward.pointsCost) || reward.pointsCost <= 0) {
      throw new DomainError('VALIDATION', 'A reward must cost at least one point.', 'cost');
    }
    const saved = this.ctx.db.rewards.upsert(reward);
    audit(this.ctx, actor, 'reward.saved', 'reward', reward.id, { active: reward.active });
    return saved;
  }

  updateSettings(patch: Partial<Omit<RewardsSettings, 'id'>>, actor: Actor): RewardsSettings {
    requireRole(actor, 'admin');
    const next = {
      ...this.settings(),
      ...patch,
      id: 'rewards-settings' as const,
      updatedAt: nowIso(this.ctx),
    };
    this.ctx.db.rewardsSettings.upsert(next);
    audit(this.ctx, actor, 'rewards_settings.updated', 'rewards_settings', next.id, patch);
    return next;
  }

  /* ── Accounts ───────────────────────────────────────────────────────── */

  accountFor(guestId: string): RewardAccount | undefined {
    return this.ctx.db.rewardAccounts.find((a) => a.guestId === guestId);
  }

  async getAccount(guestId: string): Promise<RewardAccount> {
    const account = this.accountFor(guestId);
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Join MÁBU Rewards to start collecting.', 'no account');
    }
    return account;
  }

  /** §34: an account exists only after the guest opts in. */
  optIn(guestId: string, actor: Actor): RewardAccount {
    requireFlag(this.ctx.flags.rewardsEnabled, 'rewards');
    requireOwnerOrStaff(actor, guestId);
    const existing = this.accountFor(guestId);
    if (existing) return existing;
    const guest = this.ctx.db.guests.require(guestId, 'guest');
    const now = nowIso(this.ctx);
    const account = this.ctx.db.rewardAccounts.insert({
      id: this.ctx.ids.id('racct'),
      guestId,
      tierId: this.tierFor(0).id,
      balancePoints: 0,
      lifetimePoints: 0,
      createdAt: now,
      updatedAt: now,
    });
    this.ctx.db.guests.update(guestId, {
      rewardsOptIn: true,
      referralCode: guest.referralCode ?? `MABU-${this.ctx.ids.code(5)}`,
    });
    this.ctx.analytics.track('reward_account_created');
    return account;
  }

  /* ── Catalogue ──────────────────────────────────────────────────────── */

  async getAvailableRewards(guestId: string): Promise<Reward[]> {
    const account = this.accountFor(guestId);
    const tierId = account ? this.tierFor(account.lifetimePoints).id : undefined;
    const now = this.ctx.clock.now().getTime();
    return this.ctx.db.rewards
      .filter(
        (r) =>
          r.active &&
          (!r.expiresAt || new Date(r.expiresAt).getTime() > now) &&
          (!r.tierIds?.length || (tierId !== undefined && r.tierIds.includes(tierId))),
      )
      .sort((a, b) => a.pointsCost - b.pointsCost);
  }

  /** The full catalogue, including tier-locked rewards, for aspiration. */
  catalogue(): Reward[] {
    return this.ctx.db.rewards.filter((r) => r.active).sort((a, b) => a.pointsCost - b.pointsCost);
  }

  /* ── Earning ────────────────────────────────────────────────────────── */

  /**
   * §36 earn(). The default idempotency key is the reference itself, so the
   * same visit, event or purchase can never earn twice however many times a
   * handler is re-run.
   */
  async earn(
    accountId: string,
    points: number,
    referenceId: string,
    referenceType: RewardReferenceType,
    options: { description?: string; idempotencyKey?: string; actor?: Actor } = {},
  ): Promise<RewardTransaction> {
    requireFlag(
      this.ctx.flags.rewardsEnabled && this.ctx.flags.rewardsEarningEnabled,
      'rewards earning',
    );
    if (!Number.isInteger(points) || points <= 0) {
      throw new DomainError(
        'VALIDATION',
        'Points must be a positive whole number.',
        `points ${points}`,
      );
    }
    const key = options.idempotencyKey ?? `earn:${referenceType}:${referenceId}`;
    const existing = this.ctx.db.rewardTransactions.find(
      (t) => t.accountId === accountId && t.idempotencyKey === key,
    );
    if (existing) return existing;

    const account = this.ctx.db.rewardAccounts.require(accountId, 'rewards account');
    const now = nowIso(this.ctx);
    const tx = this.ctx.db.rewardTransactions.insert({
      id: this.ctx.ids.id('rtx'),
      accountId,
      type: 'earn',
      points,
      referenceType,
      referenceId,
      idempotencyKey: key,
      description: options.description ?? 'Points earned',
      createdAt: now,
      expiresAt: addMonths(now, this.settings().pointsExpiryMonths),
      remainingPoints: points,
      actorId: options.actor?.id ?? 'system',
    });
    await this.applyBalance(account, points, points);
    this.ctx.analytics.track('reward_points_earned', { points, referenceType });
    await this.ctx.bus.publish({
      type: 'reward.earned',
      guestId: account.guestId,
      points,
      referenceId,
    });
    return tx;
  }

  /**
   * Runs every active rule for a trigger. Guests who have not opted in earn
   * nothing and are not enrolled behind their back.
   */
  async applyTrigger(
    trigger: RewardTrigger,
    guestId: string,
    referenceType: RewardReferenceType,
    referenceId: string,
    amountCents?: number,
  ): Promise<RewardTransaction[]> {
    if (!this.ctx.flags.rewardsEnabled || !this.ctx.flags.rewardsEarningEnabled) return [];
    const account = this.accountFor(guestId);
    if (!account) return [];
    const now = this.ctx.clock.now().getTime();
    const rules = this.ctx.db.rewardRules.filter(
      (r) =>
        r.active &&
        r.trigger === trigger &&
        (!r.startsAt || new Date(r.startsAt).getTime() <= now) &&
        (!r.endsAt || new Date(r.endsAt).getTime() > now),
    );
    const out: RewardTransaction[] = [];
    for (const rule of rules) {
      const points =
        rule.pointsPer100Rand && amountCents !== undefined
          ? Math.floor(amountCents / 10_000) * rule.pointsPer100Rand
          : rule.points;
      if (points <= 0) continue;
      out.push(
        await this.earn(account.id, points, referenceId, referenceType, {
          description: rule.name,
          idempotencyKey: `rule:${rule.id}:${referenceType}:${referenceId}`,
        }),
      );
    }
    return out;
  }

  /**
   * Referral credit for the referrer, when the referred guest's first visit is
   * completed. Fraud controls: no self-referral, one credit per referred
   * guest (idempotency), and a monthly cap per referrer.
   */
  async creditReferral(referredGuestId: string): Promise<RewardTransaction[]> {
    const referred = this.ctx.db.guests.get(referredGuestId);
    if (!referred?.referredBy) return [];
    const referrer = this.ctx.db.guests.find((g) => g.referralCode === referred.referredBy);
    if (!referrer || referrer.id === referred.id) return [];
    const account = this.accountFor(referrer.id);
    if (!account) return [];
    const monthStart = nowIso(this.ctx).slice(0, 7);
    const thisMonth = this.ctx.db.rewardTransactions.count(
      (t) =>
        t.accountId === account.id &&
        t.referenceType === 'referral' &&
        t.createdAt.startsWith(monthStart),
    );
    if (thisMonth >= this.settings().referralMonthlyCap) return [];
    return this.applyTrigger('referral', referrer.id, 'referral', referred.id);
  }

  /** Daily job: birthday recognition, once per guest per year. */
  async runBirthdays(): Promise<number> {
    const today = new Date(this.ctx.clock.now().getTime() + 2 * 3_600_000).toISOString();
    const mmdd = today.slice(5, 10);
    const year = today.slice(0, 4);
    let n = 0;
    for (const g of this.ctx.db.guests.list()) {
      if (!g.occasions?.some((o) => o.kind === 'birthday' && o.date === mmdd)) continue;
      const txs = await this.applyTrigger('birthday', g.id, 'birthday', `${g.id}:${year}`);
      n += txs.length;
    }
    return n;
  }

  /* ── Redemption ─────────────────────────────────────────────────────── */

  async redeem(
    accountId: string,
    rewardId: string,
    idempotencyKey: string,
    actor: Actor = { id: 'system', role: 'admin' },
  ): Promise<RewardTransaction> {
    return (await this.redeemReward(accountId, rewardId, idempotencyKey, actor)).transaction;
  }

  async redeemReward(
    accountId: string,
    rewardId: string,
    idempotencyKey: string,
    actor: Actor,
  ): Promise<{ transaction: RewardTransaction; redemption: RewardRedemption }> {
    requireFlag(
      this.ctx.flags.rewardsEnabled && this.ctx.flags.rewardsRedemptionEnabled,
      'rewards redemption',
    );
    const account = this.ctx.db.rewardAccounts.require(accountId, 'rewards account');
    requireOwnerOrStaff(actor, account.guestId);
    const redemptionId = await idempotent(
      this.ctx.db,
      `reward.redeem:${accountId}`,
      idempotencyKey,
      { rewardId },
      nowIso(this.ctx),
      async () => {
        const fresh = this.ctx.db.rewardAccounts.require(accountId);
        const reward = this.ctx.db.rewards.require(rewardId, 'reward');
        const now = this.ctx.clock.now();
        if (!reward.active || (reward.expiresAt && new Date(reward.expiresAt) <= now)) {
          throw new DomainError(
            'EXPIRED',
            'This reward is no longer available.',
            'reward inactive',
          );
        }
        const tier = this.tierFor(fresh.lifetimePoints);
        if (reward.tierIds?.length && !reward.tierIds.includes(tier.id)) {
          throw new DomainError(
            'NOT_ELIGIBLE',
            'This reward is reserved for a higher tier.',
            'tier',
          );
        }
        if (fresh.balancePoints < reward.pointsCost) {
          throw new DomainError(
            'INSUFFICIENT_POINTS',
            `You need ${reward.pointsCost - fresh.balancePoints} more points for this reward.`,
            'balance',
          );
        }
        this.spendLots(accountId, reward.pointsCost);
        const at = nowIso(this.ctx);
        const tx = this.ctx.db.rewardTransactions.insert({
          id: this.ctx.ids.id('rtx'),
          accountId,
          type: 'redeem',
          points: -reward.pointsCost,
          referenceType: 'redemption',
          referenceId: rewardId,
          idempotencyKey: `redeem:${idempotencyKey}`,
          description: reward.name,
          createdAt: at,
          actorId: actor.id,
        });
        await this.applyBalance(fresh, -reward.pointsCost, 0);
        const redemption = this.ctx.db.rewardRedemptions.insert({
          id: this.ctx.ids.id('rdm'),
          accountId,
          guestId: fresh.guestId,
          rewardId,
          rewardName: reward.name,
          code: `RW-${this.ctx.ids.code(6)}`,
          status: 'issued',
          transactionId: tx.id,
          createdAt: at,
          expiresAt: new Date(
            now.getTime() + reward.redemptionValidDays * 86_400_000,
          ).toISOString(),
        });
        this.ctx.analytics.track('reward_redeemed', { points: reward.pointsCost });
        await this.ctx.bus.publish({
          type: 'reward.redeemed',
          guestId: fresh.guestId,
          rewardId,
          redemptionId: redemption.id,
        });
        return redemption.id;
      },
    );
    const redemption = this.ctx.db.rewardRedemptions.require(redemptionId);
    return {
      redemption,
      transaction: this.ctx.db.rewardTransactions.require(redemption.transactionId),
    };
  }

  /** Staff honour a redemption code at the table. One-time: a replay is refused. */
  useRedemption(code: string, actor: Actor): RewardRedemption {
    requireRole(actor, 'staff', 'admin');
    const r = this.ctx.db.rewardRedemptions.find((x) => x.code === code.trim().toUpperCase());
    if (!r) throw new DomainError('NOT_FOUND', 'That reward code was not recognised.', code);
    if (r.status === 'used') {
      throw new DomainError(
        'ALREADY_REDEEMED',
        `This reward was already used on ${r.usedAt?.slice(0, 10)}.`,
        r.id,
      );
    }
    if (r.status !== 'issued') {
      throw new DomainError('EXPIRED', `This reward is ${r.status}.`, r.id);
    }
    if (new Date(r.expiresAt) <= this.ctx.clock.now()) {
      this.ctx.db.rewardRedemptions.update(r.id, { status: 'expired' });
      throw new DomainError('EXPIRED', 'This reward code has expired.', r.id);
    }
    const used = this.ctx.db.rewardRedemptions.update(r.id, {
      status: 'used',
      usedAt: nowIso(this.ctx),
      usedBy: actor.id,
    });
    audit(this.ctx, actor, 'reward_redemption.used', 'reward_redemption', r.id);
    return used;
  }

  /* ── Admin corrections ──────────────────────────────────────────────── */

  /** Manual issue (+) or deduction (−). A deduction can never take a balance below zero. */
  async adjust(
    accountId: string,
    points: number,
    reason: string,
    actor: Actor,
  ): Promise<RewardTransaction> {
    requireRole(actor, 'admin');
    if (!Number.isInteger(points) || points === 0) {
      throw new DomainError('VALIDATION', 'Enter a non-zero whole number of points.', 'points');
    }
    if (!reason.trim()) throw new DomainError('VALIDATION', 'Please give a reason.', 'reason');
    const account = this.ctx.db.rewardAccounts.require(accountId, 'rewards account');
    if (points < 0 && account.balancePoints + points < 0) {
      throw new DomainError(
        'INSUFFICIENT_POINTS',
        `The balance is only ${account.balancePoints} points.`,
        'negative balance',
      );
    }
    const now = nowIso(this.ctx);
    if (points < 0) this.spendLots(accountId, -points);
    const tx = this.ctx.db.rewardTransactions.insert({
      id: this.ctx.ids.id('rtx'),
      accountId,
      type: 'adjust',
      points,
      referenceType: 'admin',
      referenceId: actor.id,
      idempotencyKey: this.ctx.ids.id('adj'),
      description: reason.trim(),
      createdAt: now,
      ...(points > 0
        ? { expiresAt: addMonths(now, this.settings().pointsExpiryMonths), remainingPoints: points }
        : {}),
      actorId: actor.id,
    });
    await this.applyBalance(account, points, points > 0 ? points : 0);
    audit(this.ctx, actor, 'reward.adjusted', 'reward_account', accountId, { points, reason });
    if (points > 0) {
      await this.ctx.bus.publish({
        type: 'reward.earned',
        guestId: account.guestId,
        points,
        referenceId: tx.id,
      });
    }
    return tx;
  }

  /**
   * Reverses an incorrect earn or redeem.
   *   earn   → removes whatever of that lot is still unspent (spent points
   *            cannot be clawed back into a negative balance), and the same
   *            amount from lifetime points.
   *   redeem → returns the points as a fresh lot and cancels the redemption,
   *            unless the reward has already been used at the table.
   */
  async reverse(transactionId: string, reason: string, actor: Actor): Promise<RewardTransaction> {
    requireRole(actor, 'admin');
    const original = this.ctx.db.rewardTransactions.require(transactionId, 'transaction');
    if (this.ctx.db.rewardTransactions.find((t) => t.reversesTransactionId === transactionId)) {
      throw new DomainError(
        'CONFLICT',
        'That transaction has already been reversed.',
        transactionId,
      );
    }
    const account = this.ctx.db.rewardAccounts.require(original.accountId);
    const now = nowIso(this.ctx);
    let points: number;
    let lifetimeDelta: number;
    let lot: Partial<RewardTransaction> = {};

    if (original.type === 'earn' || (original.type === 'adjust' && original.points > 0)) {
      points = -(original.remainingPoints ?? 0);
      lifetimeDelta = points;
      this.ctx.db.rewardTransactions.update(original.id, { remainingPoints: 0 });
    } else if (original.type === 'redeem') {
      const redemption = this.ctx.db.rewardRedemptions.find((r) => r.transactionId === original.id);
      if (redemption?.status === 'used') {
        throw new DomainError(
          'CONFLICT',
          'That reward has already been used and cannot be reversed.',
          original.id,
        );
      }
      if (redemption) this.ctx.db.rewardRedemptions.update(redemption.id, { status: 'cancelled' });
      points = -original.points;
      lifetimeDelta = 0;
      lot = {
        expiresAt: addMonths(now, this.settings().pointsExpiryMonths),
        remainingPoints: points,
      };
    } else {
      throw new DomainError(
        'VALIDATION',
        `A ${original.type} line cannot be reversed.`,
        original.type,
      );
    }

    const tx = this.ctx.db.rewardTransactions.insert({
      id: this.ctx.ids.id('rtx'),
      accountId: account.id,
      type: 'reverse',
      points,
      referenceType: 'admin',
      referenceId: original.id,
      idempotencyKey: `reverse:${original.id}`,
      description: reason.trim() || `Reversal of ${original.description}`,
      createdAt: now,
      reversesTransactionId: original.id,
      actorId: actor.id,
      ...lot,
    });
    await this.applyBalance(account, points, lifetimeDelta);
    audit(this.ctx, actor, 'reward.reversed', 'reward_transaction', original.id, {
      points,
      reason,
    });
    return tx;
  }

  /* ── Expiry ─────────────────────────────────────────────────────────── */

  /** Scheduled job. Lapses unspent lots past their date; never below zero. */
  async processExpiry(): Promise<RewardTransaction[]> {
    const now = this.ctx.clock.now().getTime();
    const out: RewardTransaction[] = [];
    const lots = this.ctx.db.rewardTransactions.filter(
      (t) =>
        (t.remainingPoints ?? 0) > 0 && !!t.expiresAt && new Date(t.expiresAt).getTime() <= now,
    );
    for (const lot of lots) {
      const account = this.ctx.db.rewardAccounts.require(lot.accountId);
      const lapse = Math.min(lot.remainingPoints ?? 0, account.balancePoints);
      this.ctx.db.rewardTransactions.update(lot.id, { remainingPoints: 0 });
      if (lapse <= 0) continue;
      const tx = this.ctx.db.rewardTransactions.insert({
        id: this.ctx.ids.id('rtx'),
        accountId: account.id,
        type: 'expire',
        points: -lapse,
        referenceType: 'expiry',
        referenceId: lot.id,
        idempotencyKey: `expire:${lot.id}`,
        description: 'Points expired',
        createdAt: nowIso(this.ctx),
        actorId: 'system',
      });
      await this.applyBalance(account, -lapse, 0);
      out.push(tx);
    }
    // Issued-but-unused redemption codes past their date lapse too.
    for (const r of this.ctx.db.rewardRedemptions.filter(
      (x) => x.status === 'issued' && new Date(x.expiresAt).getTime() <= now,
    )) {
      this.ctx.db.rewardRedemptions.update(r.id, { status: 'expired' });
    }
    return out;
  }

  /** Lots expiring within the notice window — for the wallet and the reminder job. */
  expiringSoon(accountId: string): { points: number; expiresAt: string; lotId: string }[] {
    const now = this.ctx.clock.now().getTime();
    const horizon = now + this.settings().expiryNoticeDays * 86_400_000;
    return this.ctx.db.rewardTransactions
      .filter(
        (t) =>
          t.accountId === accountId &&
          (t.remainingPoints ?? 0) > 0 &&
          !!t.expiresAt &&
          new Date(t.expiresAt).getTime() > now &&
          new Date(t.expiresAt).getTime() <= horizon,
      )
      .map((t) => ({ points: t.remainingPoints ?? 0, expiresAt: t.expiresAt!, lotId: t.id }))
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }

  /* ── History ────────────────────────────────────────────────────────── */

  history(accountId: string, actor: Actor): RewardTransaction[] {
    const account = this.ctx.db.rewardAccounts.require(accountId, 'rewards account');
    requireOwnerOrStaff(actor, account.guestId);
    return this.ctx.db.rewardTransactions
      .filter((t) => t.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  redemptions(accountId: string, actor: Actor): RewardRedemption[] {
    const account = this.ctx.db.rewardAccounts.require(accountId, 'rewards account');
    requireOwnerOrStaff(actor, account.guestId);
    return this.ctx.db.rewardRedemptions
      .filter((r) => r.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /* ── Internals ──────────────────────────────────────────────────────── */

  /** Consumes points from unspent lots, soonest-expiring first. */
  private spendLots(accountId: string, points: number): void {
    let left = points;
    const lots = this.ctx.db.rewardTransactions
      .filter((t) => t.accountId === accountId && (t.remainingPoints ?? 0) > 0)
      .sort(
        (a, b) =>
          (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '') ||
          a.createdAt.localeCompare(b.createdAt),
      );
    for (const lot of lots) {
      if (left <= 0) break;
      const take = Math.min(left, lot.remainingPoints ?? 0);
      this.ctx.db.rewardTransactions.update(lot.id, {
        remainingPoints: (lot.remainingPoints ?? 0) - take,
      });
      left -= take;
    }
    if (left > 0) {
      throw new DomainError(
        'INSUFFICIENT_POINTS',
        'There are not enough points.',
        `short by ${left}`,
      );
    }
  }

  private async applyBalance(
    account: RewardAccount,
    delta: number,
    lifetimeDelta: number,
  ): Promise<void> {
    const fresh = this.ctx.db.rewardAccounts.require(account.id);
    const balancePoints = fresh.balancePoints + delta;
    if (balancePoints < 0) {
      throw new DomainError(
        'INSUFFICIENT_POINTS',
        'There are not enough points.',
        'negative balance',
      );
    }
    const lifetimePoints = Math.max(0, fresh.lifetimePoints + lifetimeDelta);
    const before = this.tierFor(fresh.lifetimePoints);
    const after = this.tierFor(lifetimePoints);
    this.ctx.db.rewardAccounts.update(fresh.id, {
      balancePoints,
      lifetimePoints,
      tierId: after.id,
      updatedAt: nowIso(this.ctx),
    });
    if (after.order > before.order) {
      await this.ctx.bus.publish({
        type: 'reward.tier_changed',
        guestId: fresh.guestId,
        fromTierId: before.id,
        toTierId: after.id,
      });
    }
  }
}
