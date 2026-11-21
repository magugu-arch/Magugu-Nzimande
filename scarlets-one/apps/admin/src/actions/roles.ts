'use server';

import { getStore } from '@/lib/instance';
import { act, text, type ActionResult } from './shared';

export async function changeRoleAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().changeRole(actor, text(formData, 'id'), text(formData, 'role')));
}

/**
 * A verification check, not a feature: it asks the store to adjust a reward
 * balance. No human role holds `rewards.adjust`, so the answer is always a
 * refusal, and the refusal lands in the audit log.
 */
export async function attemptRewardAdjustmentAction(_formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().adjustReward(actor));
}
