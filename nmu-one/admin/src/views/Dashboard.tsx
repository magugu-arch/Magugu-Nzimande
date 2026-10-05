'use client';

import Link from 'next/link';
import { greetingFor } from '@core/time/sast';
import { Badge, Card, Empty, Meter, PageHeader, Stat } from '@/components/ui';
import { estimateReach, fmt, metricsFor, pct } from '@/lib/audience';
import { when } from '@/lib/format';
import { STATUS } from '@/lib/labels';
import { allows, canApprove, OPERATOR_ROLE_LABELS } from '@/lib/operators';
import { currentOperator, useConsole } from '@/lib/store';
import { clock } from '@core/time/clock';

export function Dashboard() {
  const data = useConsole();
  const op = currentOperator(data);
  const now = clock.now();
  const weekAgo = now.getTime() - 7 * 86_400_000;

  const pending = data.campaigns.filter((c) => c.status === 'pending-approval');
  const myQueue = pending.filter((c) => canApprove(op, c).ok);
  const scheduled = data.campaigns
    .filter((c) => c.status === 'scheduled')
    .sort((a, b) => (a.sendAt ?? '').localeCompare(b.sendAt ?? ''));
  const sentWeek = data.campaigns.filter(
    (c) => c.status === 'sent' && c.sentAt && new Date(c.sentAt).getTime() >= weekAgo,
  );
  const openReports = data.moderation.filter((m) => m.status === 'open');
  const mine = data.campaigns.filter(
    (c) => c.authorId === op.id && ['draft', 'changes-requested'].includes(c.status),
  );
  const latest = data.campaigns
    .filter((c) => c.status === 'sent')
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))
    .slice(0, 3);
  const soldOut = data.vendors.flatMap((v) =>
    v.items.filter((i) => !i.available).map((i) => ({ v, i })),
  );

  const attention: {
    key: string;
    text: string;
    href: string;
    tone: 'warning' | 'danger' | 'info';
  }[] = [
    ...(allows(op, 'approve')
      ? myQueue.map((c) => ({
          key: c.id,
          text: `Approve “${c.title}”`,
          href: `/notifications/view/?id=${c.id}`,
          tone: 'warning' as const,
        }))
      : []),
    ...(allows(op, 'approve')
      ? data.events
          .filter((e) => e.status === 'pending-approval')
          .map((e) => ({
            key: e.id,
            text: `Publish or decline “${e.title}”`,
            href: '/approvals/',
            tone: 'warning' as const,
          }))
      : []),
    ...mine.map((c) => ({
      key: c.id,
      text:
        c.status === 'changes-requested'
          ? `Changes requested on “${c.title}”`
          : `Finish your draft “${c.title}”`,
      href: `/notifications/view/?id=${c.id}`,
      tone: (c.status === 'changes-requested' ? 'danger' : 'info') as 'danger' | 'info',
    })),
    ...(allows(op, 'moderate') && openReports.length
      ? [
          {
            key: 'mod',
            text: `${openReports.length} reported listing${openReports.length === 1 ? '' : 's'} to review`,
            href: '/moderation/',
            tone: 'warning' as const,
          },
        ]
      : []),
    ...(allows(op, 'manage-commerce') && soldOut.length
      ? [
          {
            key: 'sold',
            text: `${soldOut.length} menu item${soldOut.length === 1 ? ' is' : 's are'} marked sold out`,
            href: '/commerce/',
            tone: 'info' as const,
          },
        ]
      : []),
  ];

  const services = data.services;
  const ready = services.filter((s) => s.status !== 'awaiting-integration').length;

  return (
    <>
      <PageHeader
        eyebrow={`${OPERATOR_ROLE_LABELS[op.role]} · ${op.department}`}
        title={`${greetingFor(now)}, ${op.name.split(' ')[0]}`}
        description="What needs you today across NMU ONE."
        actions={
          allows(op, 'compose') ? (
            <Link className="btn primary" href="/notifications/new/">
              New notification
            </Link>
          ) : null
        }
      />
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat
          label="Awaiting approval"
          value={fmt(pending.length)}
          note={
            allows(op, 'approve') ? `${myQueue.length} you can approve` : 'Approvers review these'
          }
        />
        <Stat
          label="Scheduled"
          value={fmt(scheduled.length)}
          note={scheduled[0] ? `Next: ${when(scheduled[0].sendAt)}` : 'Nothing scheduled'}
        />
        <Stat label="Sent this week" value={fmt(sentWeek.length)} />
        <Stat label="Open reports" value={fmt(openReports.length)} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Needs your attention">
          {attention.length === 0 ? (
            <Empty title="You’re all caught up">Nothing needs your role right now.</Empty>
          ) : (
            <ul className="list">
              {attention.map((a) => (
                <li key={a.key} className="spread">
                  <Link href={a.href} className="strong">
                    {a.text}
                  </Link>
                  <Badge tone={a.tone}>
                    {a.tone === 'danger' ? 'Action' : a.tone === 'warning' ? 'Review' : 'To do'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Latest notifications" action={<Link href="/analytics/">Analytics</Link>}>
          {latest.length === 0 ? (
            <Empty title="Nothing sent yet" />
          ) : (
            <ul className="list">
              {latest.map((c) => {
                const segment = data.segments.find((s) => s.id === c.segmentId);
                const m = metricsFor(c, segment, now);
                return (
                  <li key={c.id} className="stack-sm">
                    <div className="spread">
                      <Link href={`/notifications/view/?id=${c.id}`} className="strong">
                        {c.title}
                      </Link>
                      <span className="small muted">{when(c.sentAt)}</span>
                    </div>
                    {m ? (
                      <Meter
                        label="Opened"
                        value={m.opened}
                        max={m.delivered}
                        detail={`${pct(m.opened, m.delivered)} of ${fmt(m.delivered)} delivered`}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Coming up">
          {scheduled.length === 0 ? (
            <Empty title="Nothing scheduled" />
          ) : (
            <ul className="list">
              {scheduled.map((c) => {
                const segment = data.segments.find((s) => s.id === c.segmentId);
                return (
                  <li key={c.id} className="spread">
                    <div className="stack-sm">
                      <Link href={`/notifications/view/?id=${c.id}`} className="strong">
                        {c.title}
                      </Link>
                      <span className="small muted">
                        {when(c.sendAt)} · ~{segment ? fmt(estimateReach(segment)) : 0} people
                      </span>
                    </div>
                    <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Integration readiness"
          action={<Link href="/services/">Service directory</Link>}
        >
          <div className="stack">
            <Meter
              label="Live or in pilot"
              value={ready}
              max={services.length}
              detail={`${ready} of ${services.length} services`}
            />
            <p className="small muted">
              {services.length - ready} services are waiting for their NMU system to be connected
              through the BFF; pilot services run on demo data until then. Campus Protection numbers
              and help articles are waiting for their owners’ sign-off.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
