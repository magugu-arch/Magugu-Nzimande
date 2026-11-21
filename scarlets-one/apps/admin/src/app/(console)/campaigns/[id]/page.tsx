import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveText } from '@scarlets/domain';
import {
  approveCampaignAction,
  returnCampaignToDraftAction,
  saveCampaignAction,
} from '@/actions/campaigns';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { CampaignFields } from '@/components/campaign-fields';
import { Card, Chip, DemoTag, Denied, Media, PageHeader } from '@/components/ui';
import { campaignTiming, campaignTimingLabels, findPlacementConflict } from '@/lib/campaign-rules';
import {
  campaignStatusLabels,
  formatDate,
  formatDateTime,
  placementLabelNames,
  placementNames,
} from '@/lib/format';
import { getStore } from '@/lib/instance';
import { mayAct, roleLabels } from '@/lib/rbac';
import { requireActor } from '@/lib/session';

export const metadata: Metadata = { title: 'Campaign' };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'campaigns.read')) {
    return <Denied actor={actor} permission="campaigns.read" section="Campaigns" />;
  }
  const { id } = await params;
  const store = getStore();
  const record = store.getCampaign(id);
  if (!record) notFound();
  const { campaign, status } = record;
  const partners = store.listPartners();
  const partner = partners.find((candidate) => candidate.id === campaign.partnerId);
  const canWrite = mayAct(actor.role, 'campaigns.write');
  const canApprove = mayAct(actor.role, 'campaigns.approve');
  const editable = canApprove || (canWrite && status === 'draft');
  const timing = campaignTiming(campaign, store.now());
  const clash =
    status === 'draft'
      ? findPlacementConflict(
          campaign,
          store
            .listCampaigns()
            .filter((other) => other.status === 'approved')
            .map((other) => other.campaign),
        )
      : null;

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`Campaigns · ${placementNames[campaign.placement]}`}
        title={campaign.title.en}
        actions={
          <Link className="btn btn--secondary" href="/campaigns">
            Back to campaigns
          </Link>
        }
      >
        <span className="row">
          <Chip tone={status === 'approved' ? 'good' : 'neutral'}>
            {campaignStatusLabels[status]}
          </Chip>
          {status === 'approved' ? <Chip>{campaignTimingLabels[timing]}</Chip> : null}
          <Chip>Label: {placementLabelNames[campaign.label]}</Chip>
          <DemoTag />
        </span>
      </PageHeader>

      <div className="split">
        <Card title="Campaign details" id="edit">
          {editable ? (
            <ActionForm key={record.updatedAt} action={saveCampaignAction} className="form">
              <input type="hidden" name="id" value={campaign.id} />
              <CampaignFields campaign={campaign} partners={partners} defaults={campaign} />
              <div className="row">
                <SubmitButton variant={status === 'draft' ? 'primary' : 'secondary'}>
                  {status === 'draft' ? 'Save draft' : 'Save changes'}
                </SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <p className="note">
              {canWrite
                ? 'Partner admins can change drafts only. This campaign is approved: a club admin can edit it or return it to draft.'
                : `${roleLabels[actor.role]}s can read campaigns but not change them.`}
            </p>
          )}
        </Card>

        <div className="stack">
          <Card
            title="As supporters see it"
            eyebrow={`${placementNames[campaign.placement]} tile`}
            id="tile"
          >
            <div className="tile">
              <Media id={campaign.mediaId} size="card" />
              <div className="stack stack--tight">
                <div className="row">
                  <Chip tone="strong">{placementLabelNames[campaign.label]}</Chip>
                </div>
                <p className="preview__summary" style={{ color: 'var(--c-text)', fontWeight: 600 }}>
                  {campaign.title.en}
                </p>
                <p className="meta">{campaign.body.en}</p>
              </div>
            </div>
            <dl className="facts" style={{ marginTop: 'var(--s-lg)' }}>
              <dt>Welsh</dt>
              <dd lang={campaign.title.cy ? 'cy' : undefined}>
                {campaign.title.cy
                  ? resolveText(campaign.title, 'cy').value
                  : 'No Welsh title: English shown with a fallback label'}
              </dd>
              <dt>Partner</dt>
              <dd>
                {partner?.name ?? campaign.partnerId}
                <span className="cell-sub">
                  {partner?.approved
                    ? 'Approved partner'
                    : 'Placeholder slot, not an approved partner'}
                </span>
              </dd>
              <dt>Link</dt>
              <dd>{campaign.cta ? `${campaign.cta.label.en} (${campaign.cta.url})` : 'No link'}</dd>
              <dt>Terms</dt>
              <dd>
                {campaign.terms
                  ? campaign.terms.en
                  : 'None supplied by the partner, so no redemption is offered'}
              </dd>
            </dl>
          </Card>

          <Card title="Approval" id="approval">
            <dl className="facts">
              <dt>Status</dt>
              <dd>{campaignStatusLabels[status]}</dd>
              <dt>Runs</dt>
              <dd>
                {formatDate(campaign.startsAt)} to {formatDate(campaign.endsAt)}
              </dd>
              <dt>Approved by</dt>
              <dd>
                {record.approval
                  ? `${record.approval.by}, ${formatDateTime(record.approval.at)}`
                  : status === 'approved'
                    ? 'Seeded as approved (demo data)'
                    : 'Not yet approved'}
              </dd>
              <dt>Last change</dt>
              <dd>
                {record.updatedBy}, {formatDateTime(record.updatedAt)}
              </dd>
            </dl>

            {clash ? (
              <p className="note" style={{ marginTop: 'var(--s-lg)' }}>
                <strong>This cannot be approved as it stands.</strong>{' '}
                {placementNames[campaign.placement]} already has “{clash.title.en}” approved from{' '}
                {formatDate(clash.startsAt)} to {formatDate(clash.endsAt)}. Only one campaign can
                run in a placement at a time.
              </p>
            ) : null}

            {canApprove ? (
              <div className="row" style={{ marginTop: 'var(--s-lg)' }}>
                {status === 'draft' ? (
                  <ActionForm action={approveCampaignAction}>
                    <input type="hidden" name="id" value={campaign.id} />
                    <SubmitButton variant="primary">Approve campaign</SubmitButton>
                  </ActionForm>
                ) : (
                  <ActionForm action={returnCampaignToDraftAction}>
                    <input type="hidden" name="id" value={campaign.id} />
                    <SubmitButton>Return to draft</SubmitButton>
                  </ActionForm>
                )}
              </div>
            ) : (
              <p className="hint" style={{ marginTop: 'var(--s-lg)' }}>
                Approval needs <code>campaigns.approve</code>, which only a club admin holds.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
