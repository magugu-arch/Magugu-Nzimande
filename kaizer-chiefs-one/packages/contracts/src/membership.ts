import { z } from 'zod';
import { isoDateTime, provenanceSchema } from './provenance';

export const VERIFICATION_STATES = [
  'not_linked',
  'pending',
  'verified',
  'expired',
  'failed',
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const entitlementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  validUntil: isoDateTime.nullable(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;

export const memberAccountSchema = z
  .object({
    verificationState: z.enum(VERIFICATION_STATES),
    /**
     * Only the last four characters, ever. The full member number stays with
     * the membership provider and is never logged or rendered in full.
     */
    memberNumberLast4: z
      .string()
      .regex(/^[A-Z0-9]{4}$/)
      .nullable(),
    tier: z.string().nullable(),
    validUntil: isoDateTime.nullable(),
    renewalUrl: z.url().nullable(),
    provenance: provenanceSchema,
  })
  .refine((m) => m.provenance.state !== 'demo' || m.verificationState !== 'verified', {
    message: 'Demo data must never claim verified membership.',
    path: ['verificationState'],
  });
export type MemberAccount = z.infer<typeof memberAccountSchema>;

/** Mask anything but the last four characters for display. */
export function maskMemberNumber(last4: string | null): string {
  return last4 ? `•••• ${last4}` : '••••';
}
