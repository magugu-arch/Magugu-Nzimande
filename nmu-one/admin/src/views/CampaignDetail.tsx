'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Funnel } from '@/components/charts';
import { PushPreview } from '@/components/PushPreview';
import { Badge, Card, Dialog, Empty, Notice, PageHeader } from '@/components/ui';
import { describeSegment, estimateReach, fmt, metricsFor, pct } from '@/lib/audience';
import { when } from '@/lib/format';
import { CATEGORY_LABELS, PRIORITY, STAGES, stageIndex, STATUS } from '@/lib/labels';
import { allows, canApprove } from '@/lib/operators';
import {
  approveCampaign,
  currentOperator,
  deliverNow,
  requestChanges,
  saveCampaign,
  useConsole,
  withdrawCampaign,
} from '@/lib/store';
import type { CampaignEvent } from '@/lib/types';
import { clock } from '@core/time/clock';

const ACTION_TEXT: Record<CampaignEvent['action'], string> = {
  created: 'Created',
  edited: 'Edited',
  submitted: 'Submitted for approval',
  approved: 'Approved',
  'changes-requested': 'Asked for changes',
  scheduled: 'Scheduled',
  sent: 'Delivered',
  withdrawn: 'Withdrawn',
  'emergency-sent': 'Sent as an emergency notice',
};

export function CampaignDetail() {
  const data = useConsole();
  const op = currentOperator(data);
  const id = useSearchParams().get('id');
  const c = data.campaigns.find((x) => x.id === id);
  const [dialog, setDialog] = useState<'approve' | 'changes' | null>(null);
  const [note, setNote] = useState('');

  if (!c) {
    return (
      <>
        <PageHeader eyebrow="Notifications" title="Notification not found" />
        <Empty
          title="This notification doesn’t exist"
          action={
            <Link className="btn" href="/notifications/">
              Back to notifications
            </Link>
          }
        >
          It may have been removed when the demo data was reset.
        </Empty>
      </>
    );
  }

  const segment = data.segments.find((s) => s.id === c.segmentId);
  const now = clock.now();
  const metrics = metricsFor(c, segment, now);
  const stage = stageIndex(c);
  const name = (who: string) =>
    who === 'system' ? 'Scheduler' : (data.operators.find((o) => o.id === who)?.name ?? who);
  const approval = canApprove(op, c);
  const isAuthor = c.authorId === op.id;
  const editable =
    (isAuthor || op.role === 'super-admin') && ['draft', 'changes-requested'].includes(c.status);
  const withdrawable =
    (isAuthor || allows(op, 'approve')) &&
    ['draft', 'pending-approval', 'changes-requested', 'scheduled'].includes(c.status);

  const submitDraft = () =>
    saveCampaign(
      {
        title: c.title,
        body: c.body,
        category: c.category,
        priority: c.priority,
        segmentId: c.segmentId,
        deepLink: c.deepLink,
        actionLabel: c.actionLabel,
        sendAt: c.sendAt,
        expiresAt: c.expiresAt,
        respectQuietHours: c.respectQuietHours,
        channels: c.channels,
      },
      c.id,
      true,
    );

  return (
    <>
      <PageHeader
        eyebrow={`Notifications · ${CATEGORY_LABELS[c.category]}`}
        title={c.title}
        description={
          <>
            <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>{' '}
            <Badge tone={PRIORITY[c.priority].tone} plain>
              {PRIORITY[c.priority].label} priority
            </Badge>
          </>
        }
        actions={
          <>
            {editable ? (
              <>
                <Link className="btn" href={`/notifications/new/?edit=${c.id}`}>
                  Edit
                </Link>
                <button type="button" className="btn primary" onClick={submitDraft}>
                  Submit for approval
                </button>
              </>
            ) : null}
            {c.status === 'pending-approval' && allows(op, 'approve') && approval.ok ? (
              <>
                <button type="button" className="btn" onClick={() => setDialog('changes')}>
                  Request changes
                </button>
                <button type="button" className="btn primary" onClick={() => setDialog('approve')}>
                  Approve
                </button>
              </>
            ) : null}
            {c.status === 'scheduled' && allows(op, 'approve') ? (
              <button type="button" className="btn primary" onClick={() => deliverNow(c.id)}>
                Send now
              </button>
            ) : null}
            {withdrawable ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (window.confirm(`Withdraw “${c.title}”? It won’t be sent.`))
                    withdrawCampaign(c.id);
                }}
              >
                Withdraw
              </button>
            ) : null}
          </>
        }
      />

      {c.status === 'pending-approval' && !approval.ok ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="info" title="Waiting for an approver">
            {approval.reason}
          </Notice>
        </div>
      ) : null}

      <Card title="Progress">
        {stage < 0 ? (
          <p className="muted">Withdrawn — this notice will not be sent.</p>
        ) : (
          <ol className="stepper" aria-label="Workflow progress">
            {STAGES.map((s, i) => {
              const state =
                i < stage || (c.status === 'sent' && i <= stage)
                  ? 'done'
                  : i === stage
                    ? 'current'
                    : 'todo';
              return (
                <li
                  key={s}
                  data-state={state}
                  aria-current={state === 'current' ? 'step' : undefined}
                >
                  {s}
                  <span className="visually-hidden">
                    {state === 'done'
                      ? ' — done'
                      : state === 'current'
                        ? ' — current step'
                        : ' — to do'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="stack">
          {metrics ? (
            <Card
              title="Measure"
              description={`Since ${when(c.sentAt)}. Opens keep climbing for a few hours after sending.`}
            >
              <div className="stat-row">
                <div className="stat">
                  <span className="stat-label">Delivered</span>
                  <span className="stat-value">{pct(metrics.delivered, metrics.targeted)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Opened</span>
                  <span className="stat-value">{pct(metrics.opened, metrics.delivered)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Acted</span>
                  <span className="stat-value">{pct(metrics.actioned, metrics.opened)}</span>
                </div>
              </div>
              <Funnel
                title={`Delivery funnel for “${c.title}”`}
                stages={[
                  { id: 'targeted', label: 'Targeted', value: metrics.targeted },
                  { id: 'delivered', label: 'Delivered', value: metrics.delivered },
                  { id: 'opened', label: 'Opened', value: metrics.opened },
                  {
                    id: 'actioned',
                    label: c.deepLink ? `Tapped “${c.actionLabel}”` : 'Acted',
                    value: metrics.actioned,
                  },
                ]}
              />
              <p className="hint" style={{ marginTop: 8 }}>
                Synthetic figures for the demo. Live mode reports totals only — never who opened
                what.
              </p>
            </Card>
          ) : null}

          <Card title="Details">
            <dl className="details">
              <dt>Message</dt>
              <dd>{c.body}</dd>
              <dt>Audience</dt>
              <dd>
                {segment ? (
                  <>
                    {segment.name} · about {fmt(estimateReach(segment))} people
                    <div className="cell-sub">{describeSegment(segment)}</div>
                  </>
                ) : (
                  'Audience removed'
                )}
              </dd>
              <dt>Opens</dt>
              <dd>
                {c.deepLink ? (
                  <>
                    <span className="code">{c.deepLink}</span> — “{c.actionLabel}”
                  </>
                ) : (
                  'Nothing (information only)'
                )}
              </dd>
              <dt>Send</dt>
              <dd>
                {c.sentAt
                  ? `Delivered ${when(c.sentAt)}`
                  : c.sendAt
                    ? when(c.sendAt)
                    : 'As soon as it’s approved'}
              </dd>
              <dt>Expires</dt>
              <dd>{c.expiresAt ? when(c.expiresAt) : 'Doesn’t expire'}</dd>
              <dt>Delivery</dt>
              <dd>
                {[c.channels.push ? 'Push' : null, c.channels.inApp ? 'NMU ONE inbox' : null]
                  .filter(Boolean)
                  .join(' and ')}
                {' · '}
                {c.respectQuietHours ? 'respects quiet hours' : 'ignores quiet hours'}
              </dd>
              <dt>Author</dt>
              <dd>{name(c.authorId)}</dd>
              <dt>Approver</dt>
              <dd>{c.approverId ? name(c.approverId) : 'Not yet approved'}</dd>
            </dl>
          </Card>

          <Card title="History">
            <ol className="timeline">
              {[...c.history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <div className="strong">{ACTION_TEXT[h.action]}</div>
                  <div className="small muted">
                    {name(h.by)} · {when(h.at)}
                  </div>
                  {h.note ? <div className="small">“{h.note}”</div> : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <Card title="Preview">
          <PushPreview
            title={c.title}
            body={c.body}
            actionLabel={c.deepLink ? c.actionLabel : ''}
            priority={c.priority}
            at={c.sentAt ?? c.sendAt ?? now.toISOString()}
          />
        </Card>
      </div>

      <Dialog
        open={dialog !== null}
        title={dialog === 'approve' ? 'Approve this notification?' : 'Ask for changes'}
        onClose={() => {
          setDialog(null);
          setNote('');
        }}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                const r =
                  dialog === 'approve'
                    ? await approveCampaign(c.id, note)
                    : await requestChanges(c.id, note);
                if (r.ok) {
                  setDialog(null);
                  setNote('');
                }
              }}
            >
              {dialog === 'approve'
                ? c.sendAt && new Date(c.sendAt) > now
                  ? 'Approve and schedule'
                  : 'Approve and send'
                : 'Send back to author'}
            </button>
          </>
        }
      >
        <p>
          {dialog === 'approve'
            ? `About ${segment ? fmt(estimateReach(segment)) : 0} people will receive “${c.title}” ${
                c.sendAt && new Date(c.sendAt) > now ? `at ${when(c.sendAt)}` : 'now'
              }.`
            : `${name(c.authorId)} will see your note and can edit and resubmit.`}
        </p>
        <div className="field">
          <label htmlFor="approval-note">
            {dialog === 'approve' ? 'Note (optional)' : 'What should change?'}
          </label>
          <textarea id="approval-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Dialog>
    </>
  );
}
