import type { Metadata } from 'next';
import Link from 'next/link';
import { integrationGates } from '@scarlets/adapters';
import { rolePermissions } from '@scarlets/domain';
import { Card, Chip, DemoTag, PageHeader, TableWrap } from '@/components/ui';
import { formatDateTime, plural } from '@/lib/format';
import { getStore, storeStartedAt } from '@/lib/instance';
import { mayAct, permissionActions, roleLabels } from '@/lib/rbac';
import { requireActor } from '@/lib/session';

export const metadata: Metadata = { title: 'Overview' };

interface Stat {
  href: string;
  label: string;
  value: number;
  detail: string;
}

export default async function OverviewPage() {
  const actor = await requireActor();
  const store = getStore();
  const counts = store.counts();
  const may = (permission: Parameters<typeof mayAct>[1]) => mayAct(actor.role, permission);

  // A role sees counts only for the sections it can open.
  const stats: Stat[] = [];
  if (may('content.read')) {
    stats.push({
      href: '/content',
      label: 'Content drafts',
      value: counts.content.draft,
      detail: `${plural(counts.content.review, 'draft')} waiting for approval · ${counts.content.scheduled} scheduled · ${counts.content.published} published`,
    });
  }
  if (may('moderation.review')) {
    stats.push({
      href: '/moderation',
      label: 'Waiting for moderation',
      value: counts.moderation.pending,
      detail: `${counts.moderation.escalated} escalated to safeguarding`,
    });
  }
  if (may('campaigns.read')) {
    stats.push({
      href: '/campaigns',
      label: 'Campaigns running',
      value: counts.campaigns.running,
      detail: `${plural(counts.campaigns.draft, 'draft')} · ${counts.campaigns.approved} approved`,
    });
  }
  if (may('fixtures.override')) {
    stats.push({
      href: '/fixtures',
      label: 'Fixtures',
      value: counts.fixtures.total,
      detail: `${counts.fixtures.hidden} hidden · ${plural(counts.fixtures.notices, 'notice')}`,
    });
  }
  if (may('notifications.schedule')) {
    stats.push({
      href: '/notifications',
      label: 'Pushes scheduled',
      value: counts.notifications.scheduled,
      detail: `${counts.notifications.sent} sent (simulated) · ${plural(counts.notifications.tests, 'test')}`,
    });
  }
  if (may('roles.manage')) {
    stats.push({
      href: '/roles',
      label: 'Staff accounts',
      value: counts.staff,
      detail: 'Demo accounts, named after their role',
    });
  }
  if (may('audit.read')) {
    stats.push({
      href: '/audit',
      label: 'Audit records',
      value: counts.audit.total,
      detail: `${counts.audit.refused} refused`,
    });
  }

  const mine = rolePermissions[actor.role];

  return (
    <div className="stack">
      <PageHeader eyebrow="Overview" title="Club operations console">
        Where the club runs the supporter app: what is published, what is waiting for a decision,
        and which integrations are still on mock data.
      </PageHeader>

      <section aria-label="Counts" className="stats">
        {stats.map((stat) => (
          <Link key={stat.href} href={stat.href} className="stat">
            <span className="eyebrow">{stat.label}</span>
            <span className="stat__value">{stat.value}</span>
            <span className="stat__detail">{stat.detail}</span>
          </Link>
        ))}
      </section>

      <div className="pair">
        <Card title="Your access" eyebrow={`Signed in as ${roleLabels[actor.role]}`} id="access">
          <p>
            {actor.name} can {mine.length === 0 ? 'do nothing here' : 'do the following'}. The
            sidebar shows only the sections this role can open, and the server checks the role again
            each time something is changed.
          </p>
          <ul className="plain-list" style={{ marginTop: 'var(--s-md)' }}>
            {mine.map((permission) => (
              <li key={permission}>
                {permissionActions[permission].replace(/^./, (c) => c.toUpperCase())}{' '}
                <code>{permission}</code>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Demo store" eyebrow="Where this data lives" id="store" aside={<DemoTag />}>
          <p>
            Everything in this console is mock data held in memory on the server. It was seeded from
            the shared demo data when the server started and resets when it restarts.
          </p>
          <dl className="facts" style={{ marginTop: 'var(--s-md)' }}>
            <dt>Seeded</dt>
            <dd>{storeStartedAt().toISOString().replace('T', ' ').slice(0, 16)} UTC, real time</dd>
            <dt>Demo clock</dt>
            <dd>{formatDateTime(store.now().toISOString())}</dd>
            <dt>Why a demo clock</dt>
            <dd>
              It starts two weeks before the example home fixture, so schedules and campaign dates
              behave the same on any day the demo is run.
            </dd>
          </dl>
        </Card>
      </div>

      <Card
        title="Integration gates"
        eyebrow="What the club must supply"
        id="gates"
        aside={
          <Chip tone="warn">
            {integrationGates.filter((gate) => gate.status === 'mock').length} of{' '}
            {integrationGates.length} on mock
          </Chip>
        }
      >
        <p className="lede" style={{ marginTop: 0, marginBottom: 'var(--s-lg)' }}>
          Each provider stays on its mock until the named owner supplies what is listed and the
          integration has been tested against an authorised sandbox. Nothing moves to live on
          assumption.
        </p>
        <TableWrap label="Integration gates">
          <table>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
                <th scope="col">Needed before it can go live</th>
              </tr>
            </thead>
            <tbody>
              {integrationGates.map((gate) => (
                <tr key={gate.id}>
                  <th scope="row">
                    <code>{gate.provider}</code>
                  </th>
                  <td>
                    {gate.status === 'mock' ? (
                      <Chip tone="warn">On mock data</Chip>
                    ) : (
                      <Chip tone="good">Configured</Chip>
                    )}
                  </td>
                  <td>{gate.owner}</td>
                  <td>
                    <ul className="plain-list">
                      {gate.needs.map((need) => (
                        <li key={need}>{need}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
