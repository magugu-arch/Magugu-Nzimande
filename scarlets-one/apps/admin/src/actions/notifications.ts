'use server';

import { getStore } from '@/lib/instance';
import { zonedInputToUtc } from '@/lib/time';
import { act, fields, text, type ActionResult } from './shared';

/** The compose form: schedule the push, or send it to the test device only. */
export async function composeNotificationAction(formData: FormData): Promise<ActionResult> {
  const { intent, ...input } = fields(formData);
  if (intent === 'test') {
    return act((actor) => getStore().sendTestNotification(actor, { draft: input }));
  }
  const sendAt = zonedInputToUtc(input.sendAt ?? '') ?? '';
  return act((actor) => getStore().scheduleNotification(actor, { ...input, sendAt }));
}

export async function sendTestAction(formData: FormData): Promise<ActionResult> {
  return act((actor) =>
    getStore().sendTestNotification(actor, { notificationId: text(formData, 'id') }),
  );
}

export async function cancelNotificationAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().cancelNotification(actor, text(formData, 'id')));
}
