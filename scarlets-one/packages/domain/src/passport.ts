import { z } from 'zod';
import { localizedText } from './i18n';

export const accountState = z.enum(['guest', 'signed_in']);
export type AccountState = z.infer<typeof accountState>;

export const membership = z.object({
  state: z.enum(['not_linked', 'pending_verification', 'linked']),
  type: localizedText.nullable(),
  season: z.string().nullable(),
  /** Always masked. The full reference stays in the membership system. */
  memberRefMasked: z.string().nullable(),
  validTo: z.string().nullable(),
  sourceSystem: z.string(),
});
export type Membership = z.infer<typeof membership>;

export const benefit = z.object({
  id: z.string(),
  title: localizedText,
  detail: localizedText,
  icon: z.string(),
  /** Who vouches for this benefit existing. */
  source: z.enum(['club_published', 'partner', 'programme']),
  /** Whether usage terms have been supplied. Until then no redemption is offered. */
  terms: z.enum(['confirmed', 'awaiting_terms']),
  redemption: z.enum(['automatic', 'show_passport', 'code', 'not_available_yet']),
});
export type Benefit = z.infer<typeof benefit>;

export const mission = z.object({
  id: z.string(),
  title: localizedText,
  detail: localizedText,
  icon: z.string(),
  /** How the activity would be verified: only verified events can count. */
  verification: localizedText,
  status: z.enum(['proposed', 'available', 'pending', 'completed']),
});
export type Mission = z.infer<typeof mission>;

export const rewardTransaction = z.object({
  id: z.string(),
  providerTxnId: z.string(),
  type: z.enum(['earned', 'pending', 'redeemed', 'expired', 'reversed']),
  title: localizedText,
  /** Only ever supplied by the rewards provider. Null means "not supplied". */
  amount: z.number().nullable(),
  occurredAt: z.string(),
  reference: z.string().nullable(),
});
export type RewardTransaction = z.infer<typeof rewardTransaction>;

export const programme = z.object({
  name: z.string(),
  status: z.enum(['announced', 'live', 'unavailable']),
  /** False until the programme owner publishes earning and redemption rules. */
  rulesPublished: z.boolean(),
  balance: z.number().nullable(),
  tier: z.string().nullable(),
  statement: localizedText,
});
export type Programme = z.infer<typeof programme>;

/**
 * The app must not invent reward economics. While the programme's rules are
 * unpublished there is no balance, no tier and no transaction amount, and the
 * schema itself refuses a payload that carries one.
 */
export const passport = z
  .object({
    displayName: z.string(),
    initials: z.string(),
    membership,
    programme,
    benefits: z.array(benefit),
    missions: z.array(mission),
    history: z.array(rewardTransaction),
    catalogueOpen: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.programme.rulesPublished) return;
    if (value.programme.balance !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Balance shown before programme rules are published',
      });
    }
    if (value.programme.tier !== null) {
      ctx.addIssue({ code: 'custom', message: 'Tier shown before programme rules are published' });
    }
    if (value.history.some((entry) => entry.amount !== null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Reward amount shown before programme rules are published',
      });
    }
    if (value.catalogueOpen) {
      ctx.addIssue({
        code: 'custom',
        message: 'Catalogue open before programme rules are published',
      });
    }
  });
export type Passport = z.infer<typeof passport>;
