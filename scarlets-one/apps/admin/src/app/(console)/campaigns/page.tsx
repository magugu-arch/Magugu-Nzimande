import type { Metadata } from 'next';
import Link from 'next/link';
import { placement } from '@scarlets/domain';
import { Card, Chip, DemoTag, Denied, Media, PageHeader, TableWrap } from '@/components/ui';
import { campaignTiming, campaignTimingLabels } from '@/lib/campaign-rules';
import {
  campaignStatusLabels,
  formatDate,
  placementLabelNames,
  placementNames,
} from '@/lib/format';
import { getStore } from '@/lib/instance';
import { mayAct } from '@/lib/rbac';
import { requireActor } from '@/lib/session';

export const metadata: Metadata = { title: 'Campaigns' };

export default async function CampaignsPage() {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'campaigns.read')) {
    return <Denied actor={actor} permission="campaigns.read" section="Campaigns" />;
  }
  const store = getStore();
  const now = store.now();
  const records = store.listCampaigns();
  const partners = new Map(store.listPartners().map((partner) => [partner.id, partner]));
  const running = store.runningCampaigns();
  const canWrite = mayAct(actor.role, 'campaigns.write');
  const canApprove = mayAct(actor.role, 'campaigns.approve');

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Campaigns"
        title="Partner campaigns"
        actions={
          canWrite ? (
            <Link className="btn btn--primary" href="/campaigns/new">
              New campaign draft
            </Link>
          ) : null
        }
      >
        {canApprove
          ? 'Partner admins draft campaigns; you approve them. Only one campaign can run in a placement at a time, and each carries a label supporters can see.'
          : canWrite
            ? 'You can draft campaigns. A club admin approves them before they run.'
            : 'You can read campaigns. You cannot change them.'}
      </PageHeader>

      <p className="note">
        <strong>No sponsor is named here.</strong> The four partners below are placeholder slots
        that stand where an approved partner will go. They are not real or approved partners.
      </p>

      <Card
        title="Running now, by placement"
        eyebrow="One campaign per placement"
        id="placements"
        aside={<DemoTag />}
      >
        <TableWrap label="What each placement is running now">
          <table>
            <thead>
              <tr>
                <th scope="col">Placement</th>
                <th scope="col">Running now</th>
                <th scope="col">Visible label</th>
                <th scope="col">Until</th>
              </tr>
            </thead>
            <tbody>
              {placement.options.map((where) => {
                const campaign = running[where];
                return (
                  <tr key={where}>
                    <th scope="row">{placementNames[where]}</th>
                    <td>
                      {campaign ? (
                        <Link href={`/campaigns/${campaign.id}`}>{campaign.title.en}</Link>
                      ) : (
                        <span className="meta">Nothing running: placement is free</span>
                      )}
                    </td>
                    <td>
                      {campaign ? (
                        <Chip>{placementLabelNames[campaign.label]}</Chip>
                      ) : (
                        <span className="meta">None</span>
                      )}
                    </td>
                    <td>
                      {campaign ? (
                        formatDate(campaign.endsAt)
                      ) : (
                        <span className="meta">Not applicable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card title="All campaigns" id="campaigns" aside={<DemoTag />}>
        <TableWrap label="All campaigns">
          <table>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Partner</th>
                <th scope="col">Placement and label</th>
                <th scope="col">Runs</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map(({ campaign, status }) => {
                const partner = partners.get(campaign.partnerId);
                const timing = campaignTiming(campaign, now);
                return (
                  <tr key={campaign.id}>
                    <th scope="row">
                      <div className="cell-title">
                        <Media id={campaign.mediaId} size="thumb" decorative />
                        <div>
                          <Link href={`/campaigns/${campaign.id}`}>{campaign.title.en}</Link>
                          <span className="cell-sub" lang={campaign.title.cy ? 'cy' : undefined}>
                            {campaign.title.cy ?? 'No Welsh title'}
                          </span>
                        </div>
                      </div>
                    </th>
                    <td>
                      {partner?.name ?? campaign.partnerId}
                      <span className="cell-sub">
                        {partner?.approved
                          ? 'Approved partner'
                          : 'Placeholder slot, not an approved partner'}
                      </span>
                    </td>
                    <td>
                      {placementNames[campaign.placement]}
                      <span className="cell-sub">Label: {placementLabelNames[campaign.label]}</span>
                    </td>
                    <td>
                      {formatDate(campaign.startsAt)} to {formatDate(campaign.endsAt)}
                    </td>
                    <td>
                      <div className="row">
                        <Chip tone={status === 'approved' ? 'good' : 'neutral'}>
                          {campaignStatusLabels[status]}
                        </Chip>
                        {status === 'approved' ? (
                          <Chip tone={timing === 'running' ? 'good' : 'neutral'}>
                            {campaignTimingLabels[timing]}
                          </Chip>
                        ) : null}
                      </div>
                    </td>
                    <td className="actions">
                      <Link
                        className="btn btn--secondary"
                        href={`/campaigns/${campaign.id}`}
                        aria-label={`Open ${campaign.title.en}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
