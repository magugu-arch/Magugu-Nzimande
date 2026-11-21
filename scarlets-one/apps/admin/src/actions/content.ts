'use server';

import { getStore } from '@/lib/instance';
import { zonedInputToUtc } from '@/lib/time';
import { act, fields, text, type ActionResult } from './shared';

export async function createContentAction(formData: FormData): Promise<ActionResult> {
  return act(
    (actor) => getStore().createContent(actor, fields(formData)),
    (record) => `/content/${record.item.id}`,
  );
}

export async function saveContentAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().updateContent(actor, text(formData, 'id'), fields(formData)));
}

export async function requestReviewAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().requestReview(actor, text(formData, 'id')));
}

/** One form, two ways to approve: publish now, or schedule for later. */
export async function approveContentAction(formData: FormData): Promise<ActionResult> {
  const id = text(formData, 'id');
  const confirmed = text(formData, 'confirmed') === 'yes';
  if (text(formData, 'intent') === 'schedule') {
    const publishAt = zonedInputToUtc(text(formData, 'publishAt')) ?? '';
    return act((actor) => getStore().schedulePublish(actor, id, { publishAt, confirmed }));
  }
  return act((actor) => getStore().publishContent(actor, id, { confirmed }));
}

export async function returnContentToDraftAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().returnContentToDraft(actor, text(formData, 'id')));
}

export async function archiveContentAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().archiveContent(actor, text(formData, 'id')));
}

export async function pinContentAction(formData: FormData): Promise<ActionResult> {
  return act((actor) =>
    getStore().setContentPinned(actor, text(formData, 'id'), text(formData, 'pinned') === 'yes'),
  );
}
