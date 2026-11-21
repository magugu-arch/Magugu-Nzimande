'use server';

import { getStore } from '@/lib/instance';
import { act, text, type ActionResult } from './shared';

/** The button pressed is the decision: approve, reject or escalate. */
export async function decideCaseAction(formData: FormData): Promise<ActionResult> {
  return act((actor) =>
    getStore().decideCase(actor, text(formData, 'id'), {
      decision: text(formData, 'decision'),
      reason: text(formData, 'reason'),
    }),
  );
}

export async function reopenCaseAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().reopenCase(actor, text(formData, 'id')));
}
