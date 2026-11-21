'use server';

import { getStore } from '@/lib/instance';
import { zonedInputToUtc } from '@/lib/time';
import { act, fields, text, type ActionResult } from './shared';

/** Dates are typed in UK time and stored in UTC. */
function campaignInput(formData: FormData): Record<string, string> {
  const input = fields(formData);
  return {
    ...input,
    startsAt: zonedInputToUtc(input.startsAt ?? '') ?? '',
    endsAt: zonedInputToUtc(input.endsAt ?? '') ?? '',
  };
}

export async function createCampaignAction(formData: FormData): Promise<ActionResult> {
  return act(
    (actor) => getStore().createCampaign(actor, campaignInput(formData)),
    (record) => `/campaigns/${record.campaign.id}`,
  );
}

export async function saveCampaignAction(formData: FormData): Promise<ActionResult> {
  return act((actor) =>
    getStore().updateCampaign(actor, text(formData, 'id'), campaignInput(formData)),
  );
}

export async function approveCampaignAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().approveCampaign(actor, text(formData, 'id')));
}

export async function returnCampaignToDraftAction(formData: FormData): Promise<ActionResult> {
  return act((actor) => getStore().returnCampaignToDraft(actor, text(formData, 'id')));
}
