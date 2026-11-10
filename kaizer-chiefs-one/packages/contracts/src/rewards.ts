import { z } from 'zod';
import { isoDateTime, provenanceSchema } from './provenance';

export const rewardSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string(),
    category: z.enum(['matchday', 'merchandise', 'experience', 'partner', 'community']),
    imageKey: z.string().nullable(),
    /** Set by the rewards programme. Null when not supplied (always null in demo). */
    pointsCost: z.number().int().positive().nullable(),
    eligibility: z.array(z.string()),
    terms: z.string(),
    /** Partner name, only with the partner's approval. Null otherwise. */
    partnerName: z.string().nullable(),
    provenance: provenanceSchema,
  })
  .refine(
    (r) => r.provenance.state !== 'demo' || (r.pointsCost === null && r.partnerName === null),
    { message: 'Demo rewards carry no points values and no partner names.' },
  );
export type Reward = z.infer<typeof rewardSchema>;

export const rewardWalletSchema = z
  .object({
    balance: z.number().int().min(0),
    tier: z.string().nullable(),
    provenance: provenanceSchema,
  })
  .refine((w) => w.provenance.state !== 'demo', {
    message: 'There is no demo balance. A wallet only ever comes from the rewards provider.',
  });
export type RewardWallet = z.infer<typeof rewardWalletSchema>;

export const REDEMPTION_STATUSES = ['pending', 'confirmed', 'failed', 'reversed'] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Idempotency keys are client-generated UUIDs, one per redemption attempt. */
export const idempotencyKeySchema = z.string().regex(UUID, 'Idempotency key must be a UUID');

export const redemptionSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    rewardId: z.string().min(1),
    status: z.enum(REDEMPTION_STATUSES),
    /** The provider's transaction reference. Required for anything but pending/failed. */
    providerRef: z.string().nullable(),
    createdAt: isoDateTime,
  })
  .refine((r) => r.status === 'pending' || r.status === 'failed' || r.providerRef !== null, {
    message: 'A confirmed or reversed redemption must carry the provider reference.',
    path: ['providerRef'],
  });
export type Redemption = z.infer<typeof redemptionSchema>;
