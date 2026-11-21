'use server';

import { getStore } from '@/lib/instance';
import { act, fields, text, type ActionResult } from './shared';

export async function setFixtureVisibilityAction(formData: FormData): Promise<ActionResult> {
  return act((actor) =>
    getStore().setFixtureVisibility(
      actor,
      text(formData, 'id'),
      text(formData, 'visible') === 'yes',
    ),
  );
}

/**
 * Everything the browser sent is passed to the store, which accepts a notice
 * type and a note and refuses anything else. There is no score field to fill
 * in, and adding one to the request gets it refused.
 */
export async function setFixtureNoticeAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().setFixtureNotice(actor, text(formData, 'id'), fields(formData)));
}

export async function clearFixtureNoticeAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().clearFixtureNotice(actor, text(formData, 'id')));
}
