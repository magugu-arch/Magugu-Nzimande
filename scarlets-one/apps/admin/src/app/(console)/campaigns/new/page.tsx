import type { Metadata } from 'next';
import Link from 'next/link';
import { createCampaignAction } from '@/actions/campaigns';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { CampaignFields } from '@/components/campaign-fields';
import { Card, Denied, PageHeader } from '@/components/ui';
import { getStore } from '@/lib/instance';
import { mayAct } from '@/lib/rbac';
import { requireActor } from '@/lib/session';
import { DAY } from '@/lib/time';

export const metadata: Metadata = { title: 'New campaign draft' };

export default async function NewCampaignPage() {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'campaigns.write')) {
    return <Denied actor={actor} permission="campaigns.write" section="New campaign draft" />;
  }
  const store = getStore();
  const start = new Date(store.now().getTime() + 7 * DAY);
  start.setUTCHours(0, 0, 0, 0);
  const defaults = {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 30 * DAY).toISOString(),
  };
  return (
    <div className="stack">
      <PageHeader eyebrow="Campaigns" title="New campaign draft">
        A draft does not run. A club admin approves it, and approval is refused if the placement
        already has a campaign for any of the same dates.
      </PageHeader>
      <Card title="Campaign details" id="new-campaign">
        <ActionForm action={createCampaignAction} className="form">
          <CampaignFields partners={store.listPartners()} defaults={defaults} />
          <div className="row">
            <SubmitButton variant="primary">Save draft</SubmitButton>
            <Link className="btn btn--quiet" href="/campaigns">
              Cancel
            </Link>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
