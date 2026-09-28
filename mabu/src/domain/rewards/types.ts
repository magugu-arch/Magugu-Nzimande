/** Rewards contracts — brief §36, extended with the ledger fields §46 and §34 require. */

export type RewardTransactionType = 'earn' | 'redeem' | 'adjust' | 'expire' | 'reverse';

export type RewardTrigger =
  'completed_visit' | 'event_attendance' | 'purchase' | 'referral' | 'birthday' | 'campaign';

export interface RewardAccount {
  id: string;
  guestId: string;
  tierId: string;
  balancePoints: number;
  lifetimePoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface RewardTier {
  id: string;
  name: string;
  /** Lifetime points at which a guest reaches this tier. */
  minLifetimePoints: number;
  order: number;
  benefits: string[];
}

export interface RewardRule {
  id: string;
  name: string;
  trigger: RewardTrigger;
  points: number;
  /** For 'purchase': points per whole R100 spent, instead of a flat award. */
  pointsPer100Rand?: number;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  updatedAt: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  terms: string;
  kind: 'experience' | 'priority-booking' | 'pairing-upgrade' | 'gift' | 'invitation';
  pointsCost: number;
  /** Tiers allowed to redeem. Empty or absent: every tier. */
  tierIds?: string[];
  expiresAt?: string;
  /** Days a redemption code stays valid after it is issued. */
  redemptionValidDays: number;
  active: boolean;
  photo?: string;
}

export type RewardReferenceType =
  | 'reservation'
  | 'event'
  | 'order'
  | 'voucher'
  | 'referral'
  | 'campaign'
  | 'birthday'
  | 'admin'
  | 'redemption'
  | 'expiry';

/**
 * One immutable ledger line. The balance on RewardAccount is a cache of the
 * ledger's sum and is checked against it in tests; nothing edits a line after
 * it is written — mistakes are corrected with a 'reverse' line.
 */
export interface RewardTransaction {
  id: string;
  accountId: string;
  type: RewardTransactionType;
  /** Signed: earn/adjust-up positive; redeem/expire/adjust-down negative. */
  points: number;
  referenceType: RewardReferenceType;
  referenceId: string;
  idempotencyKey: string;
  description: string;
  createdAt: string;
  /** Earn lines: when unspent points from this line lapse. */
  expiresAt?: string;
  /** Earn lines: points from this line not yet spent or expired (FIFO lots). */
  remainingPoints?: number;
  /** Reverse lines: the line being reversed. */
  reversesTransactionId?: string;
  actorId: string;
}

export interface RewardRedemption {
  id: string;
  accountId: string;
  guestId: string;
  rewardId: string;
  rewardName: string;
  code: string;
  status: 'issued' | 'used' | 'cancelled' | 'expired';
  transactionId: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedBy?: string;
}

export interface RewardsSettings {
  id: 'rewards-settings';
  pointsExpiryMonths: number;
  expiryNoticeDays: number;
  referralMonthlyCap: number;
  updatedAt: string;
}

export interface TierProgress {
  current: RewardTier;
  next?: RewardTier;
  pointsToNext: number;
  /** 0..1 progress from current tier's threshold to the next. */
  fraction: number;
}

/** §36 RewardsService. */
export interface RewardsService {
  getAccount(guestId: string): Promise<RewardAccount>;
  getRules(): Promise<RewardRule[]>;
  getAvailableRewards(guestId: string): Promise<Reward[]>;
  earn(
    accountId: string,
    points: number,
    referenceId: string,
    referenceType: RewardTransaction['referenceType'],
  ): Promise<RewardTransaction>;
  redeem(accountId: string, rewardId: string, idempotencyKey: string): Promise<RewardTransaction>;
}
