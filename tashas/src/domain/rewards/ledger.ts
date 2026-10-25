/**
 * Rewards ledger (brief §6).
 *
 * Every earn, redeem, expiry, reversal and adjustment is a ledger row with a
 * UNIQUE idempotency key, so a duplicated booking.completed event cannot earn
 * twice. Balances are derived from the ledger, never stored. Points earn only
 * from verified visit events. The rules themselves (points per visit, expiry,
 * tiers, catalogue) are content Tashas configures; today's are samples.
 */

import type { Ctx } from '../context.ts';
import { audit } from '../context.ts';
import type { Consumer, Outbox } from '../outbox.ts';
import { authorize } from '../roles.ts';
import type { Actor, RewardLedgerEntry, RewardOffer, TashasDomainEvent, Voucher } from '../types.ts';
import { DAY, DomainError } from '../util/core.ts';
import { UniqueViolation } from '../db.ts';

export interface Lot {
  entryId: string;
  points: number;
  remaining: number;
  expiresAt: number | null;
}

export interface RewardsSummary {
  balance: number;
  lifetime: number;
  tier: { id: string; label: string };
  nextTier: { id: string; label: string; pointsToGo: number } | null;
  expiringSoon: { points: number; expiresAt: number } | null;
}

export class RewardsService {
  private ctx: Ctx;
  private outbox: Outbox;

  constructor(ctx: Ctx, outbox: Outbox) {
    this.ctx = ctx;
    this.outbox = outbox;
  }

  private get rules() {
    return this.ctx.content.rewardRules;
  }

  entries(guestId: string): RewardLedgerEntry[] {
    return this.ctx.db
      .where('rewardLedger', (e) => e.guestId === guestId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  balance(guestId: string): number {
    return this.entries(guestId).reduce((n, e) => n + e.points, 0);
  }

  /** FIFO lots: what each earn has left after redemptions, expiries and reversals. */
  lots(guestId: string): Lot[] {
    const entries = this.entries(guestId);
    const reversed = new Set(entries.filter((e) => e.type === 'reverse').map((e) => e.reversesEntryId));
    const lots: Lot[] = entries
      .filter((e) => (e.type === 'earn' || (e.type === 'adjust' && e.points > 0)) && !reversed.has(e.id))
      .map((e) => ({
        entryId: e.id,
        points: e.points,
        remaining: e.points,
        expiresAt: e.expiresAt ? Date.parse(e.expiresAt) : null,
      }));
    let spend = entries
      .filter((e) => e.type === 'redeem' || e.type === 'expire' || (e.type === 'adjust' && e.points < 0))
      .reduce((n, e) => n - e.points, 0);
    // Expiries consume the lot they expire; spend the rest oldest first.
    for (const e of entries.filter((x) => x.type === 'expire' && x.reversesEntryId)) {
      const lot = lots.find((l) => l.entryId === e.reversesEntryId);
      if (lot) {
        const take = Math.min(lot.remaining, -e.points);
        lot.remaining -= take;
        spend -= take;
      }
    }
    for (const lot of lots) {
      if (spend <= 0) break;
      const take = Math.min(lot.remaining, spend);
      lot.remaining -= take;
      spend -= take;
    }
    return lots;
  }

  summary(guestId: string): RewardsSummary {
    const entries = this.entries(guestId);
    const lifetime = entries.filter((e) => e.type === 'earn').reduce((n, e) => n + e.points, 0) -
      entries.filter((e) => e.type === 'reverse').reduce((n, e) => n - e.points, 0);
    const tiers = [...this.rules.tiers].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
    const tier = [...tiers].reverse().find((t) => lifetime >= t.minLifetimePoints) ?? tiers[0]!;
    const next = tiers.find((t) => t.minLifetimePoints > lifetime);
    const now = this.ctx.clock.now();
    const soon = this.lots(guestId)
      .filter((l) => l.remaining > 0 && l.expiresAt !== null && l.expiresAt - now < 30 * DAY)
      .sort((a, b) => a.expiresAt! - b.expiresAt!)[0];
    return {
      balance: this.balance(guestId),
      lifetime,
      tier: { id: tier.id, label: tier.label },
      nextTier: next ? { id: next.id, label: next.label, pointsToGo: next.minLifetimePoints - lifetime } : null,
      expiringSoon: soon ? { points: soon.remaining, expiresAt: soon.expiresAt! } : null,
    };
  }

  private append(entry: Omit<RewardLedgerEntry, 'id' | 'createdAt'>): RewardLedgerEntry | null {
    const { db, ids, clock } = this.ctx;
    if (db.byUnique('rewardLedger', 'idempotencyKey', entry.idempotencyKey)) return null;
    try {
      return db.insert('rewardLedger', { ...entry, id: ids.id('rwd'), createdAt: new Date(clock.now()).toISOString() });
    } catch (err) {
      if (err instanceof UniqueViolation) return null;
      throw err;
    }
  }

  earnForVisit(guestId: string, bookingId: string): RewardLedgerEntry | null {
    const now = this.ctx.clock.now();
    return this.ctx.db.transaction(() => {
      const entry = this.append({
        guestId,
        type: 'earn',
        points: this.rules.pointsPerCompletedVisit,
        referenceType: 'visit',
        referenceId: bookingId,
        idempotencyKey: `visit:${bookingId}`,
        expiresAt: new Date(now + this.rules.pointExpiryDays * DAY).toISOString(),
        reversesEntryId: null,
        note: `Rules ${this.rules.version}`,
      });
      if (entry) {
        this.outbox.publish({ type: 'reward.earned', guestId, points: entry.points, referenceId: bookingId }, bookingId);
      }
      return entry;
    });
  }

  redeem(guestId: string, offerId: string, idempotencyKey: string): Voucher {
    const { db, ids, clock } = this.ctx;
    const offer: RewardOffer | undefined = this.rules.catalogue.find((o) => o.id === offerId);
    if (!offer) throw new DomainError('unknown_reward', 'That reward is not available.');
    const existing = db.byUnique('rewardLedger', 'idempotencyKey', idempotencyKey);
    if (existing) {
      const voucher = db.where('vouchers', (v) => v.ledgerEntryId === existing.id)[0];
      if (voucher) return voucher;
    }
    if (this.balance(guestId) < offer.pointsCost) {
      throw new DomainError('insufficient_points', `You need ${offer.pointsCost} points for this reward.`);
    }
    return db.transaction(() => {
      const now = clock.now();
      const entry = this.append({
        guestId,
        type: 'redeem',
        points: -offer.pointsCost,
        referenceType: 'campaign',
        referenceId: offer.id,
        idempotencyKey,
        expiresAt: null,
        reversesEntryId: null,
        note: offer.title,
      });
      if (!entry) throw new DomainError('duplicate', 'This redemption was already made.');
      const voucher = db.insert('vouchers', {
        id: ids.id('vch'),
        code: ids.reference('TV'),
        guestId,
        offerId: offer.id,
        title: offer.title,
        status: 'active',
        issuedAt: now,
        expiresAt: now + offer.voucherValidDays * DAY,
        redeemedAt: null,
        ledgerEntryId: entry.id,
      });
      this.outbox.publish({ type: 'reward.redeemed', guestId, points: offer.pointsCost, voucherId: voucher.id }, voucher.id);
      return voucher;
    });
  }

  /** Staff mark a voucher used at the till. */
  useVoucher(voucherId: string, actor: Actor): Voucher {
    authorize(actor, 'booking.mark-outcome');
    const v = this.ctx.db.require('vouchers', voucherId);
    if (v.status !== 'active') throw new DomainError('voucher_inactive', `This voucher is ${v.status}.`);
    if (v.expiresAt < this.ctx.clock.now()) throw new DomainError('voucher_expired', 'This voucher has expired.');
    audit(this.ctx, actor, 'voucher.used', 'voucher', voucherId);
    return this.ctx.db.update('vouchers', voucherId, { status: 'redeemed', redeemedAt: this.ctx.clock.now() });
  }

  /** Reverses an earn, e.g. a visit recorded in error. */
  reverse(entryId: string, actor: Actor, reason: string): RewardLedgerEntry | null {
    authorize(actor, 'booking.reconcile');
    const entry = this.ctx.db.require('rewardLedger', entryId);
    if (entry.type !== 'earn') throw new DomainError('not_reversible', 'Only earned points can be reversed.');
    return this.ctx.db.transaction(() => {
      const row = this.append({
        guestId: entry.guestId,
        type: 'reverse',
        points: -entry.points,
        referenceType: 'admin',
        referenceId: entry.id,
        idempotencyKey: `reverse:${entry.id}`,
        expiresAt: null,
        reversesEntryId: entry.id,
        note: reason,
      });
      audit(this.ctx, actor, 'reward.reversed', 'reward', entry.id, { reason });
      return row;
    });
  }

  adjust(guestId: string, points: number, actor: Actor, reason: string, idempotencyKey: string): RewardLedgerEntry | null {
    authorize(actor, 'booking.reconcile');
    if (!Number.isInteger(points) || points === 0) throw new DomainError('invalid_points', 'Adjust by a whole number of points.');
    const row = this.append({
      guestId,
      type: 'adjust',
      points,
      referenceType: 'admin',
      referenceId: actor.id,
      idempotencyKey,
      expiresAt: points > 0 ? new Date(this.ctx.clock.now() + this.rules.pointExpiryDays * DAY).toISOString() : null,
      reversesEntryId: null,
      note: reason,
    });
    audit(this.ctx, actor, 'reward.adjusted', 'guest', guestId, { points, reason });
    return row;
  }

  /** Expires lapsed lots and vouchers; idempotent per lot. */
  expire(): number {
    const { db, clock } = this.ctx;
    const now = clock.now();
    let count = 0;
    const guests = new Set(db.all('rewardLedger').map((e) => e.guestId));
    for (const guestId of guests) {
      for (const lot of this.lots(guestId)) {
        if (lot.remaining > 0 && lot.expiresAt !== null && lot.expiresAt <= now) {
          const row = this.append({
            guestId,
            type: 'expire',
            points: -lot.remaining,
            referenceType: 'admin',
            referenceId: lot.entryId,
            idempotencyKey: `expire:${lot.entryId}`,
            expiresAt: null,
            reversesEntryId: lot.entryId,
            note: 'Points expired',
          });
          if (row) count++;
        }
      }
    }
    for (const v of db.where('vouchers', (x) => x.status === 'active' && x.expiresAt <= now)) {
      db.update('vouchers', v.id, { status: 'expired' });
    }
    return count;
  }

  readonly consumer: Consumer = {
    name: 'rewards',
    handle: (event: TashasDomainEvent) => {
      if (event.type === 'booking.completed') this.earnForVisit(event.guestId, event.bookingId);
    },
  };
}
