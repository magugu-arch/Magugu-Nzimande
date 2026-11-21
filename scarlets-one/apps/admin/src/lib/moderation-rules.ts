import { z } from 'zod';
import type { CaseDecision, CaseState } from './types';

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export const decisionFields = z.object({
  decision: z.enum(['approve', 'reject', 'escalate'], 'Choose approve, reject or escalate.'),
  reason: z
    .string()
    .trim()
    .max(REASON_MAX, `Keep the reason to ${REASON_MAX} characters or fewer.`)
    .default(''),
});
export type DecisionFields = z.infer<typeof decisionFields>;

export const REJECT_NEEDS_REASON =
  'Give a reason to reject. It is recorded in the audit log and can be shared with the supporter.';

/** A rejection without a reason is not accepted. Null when the reason will do. */
export function reasonProblem(decision: CaseDecision, reason: string): string | null {
  if (decision === 'reject' && reason.trim().length < REASON_MIN) return REJECT_NEEDS_REASON;
  return null;
}

export function stateAfter(decision: CaseDecision): CaseState {
  if (decision === 'approve') return 'approved';
  if (decision === 'reject') return 'rejected';
  return 'escalated';
}

/** Only an approved submission is ever shown to supporters. */
export function isVisibleToSupporters(state: CaseState): boolean {
  return state === 'approved';
}
