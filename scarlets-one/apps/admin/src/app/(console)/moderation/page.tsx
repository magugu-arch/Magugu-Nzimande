import type { Metadata } from 'next';
import { activitySeed } from '@scarlets/adapters';
import { decideCaseAction, reopenCaseAction } from '@/actions/moderation';
import { ActionForm, SubmitButton } from '@/components/action-form';
import {
  Card,
  Chip,
  DemoTag,
  Denied,
  Empty,
  Media,
  PageHeader,
  TableWrap,
  type Tone,
} from '@/components/ui';
import { caseStateLabels, formatDateTime, plural, reportReasonLabels } from '@/lib/format';
import { getStore } from '@/lib/instance';
import { REASON_MAX } from '@/lib/moderation-rules';
import { mayAct } from '@/lib/rbac';
import { requireActor } from '@/lib/session';
import type { CaseState, ModerationCase } from '@/lib/types';

export const metadata: Metadata = { title: 'Moderation' };

const stateTone: Record<CaseState, Tone> = {
  pending: 'warn',
  approved: 'good',
  rejected: 'neutral',
  escalated: 'strong',
};

function DecisionForm({
  item,
  labels,
}: {
  item: ModerationCase;
  labels: { approve: string; reject: string };
}) {
  const reasonId = `reason-${item.id}`;
  return (
    <ActionForm action={decideCaseAction} className="form">
      <input type="hidden" name="id" value={item.id} />
      <div className="field">
        <label htmlFor={reasonId}>Reason</label>
        <textarea
          id={reasonId}
          name="reason"
          rows={2}
          maxLength={REASON_MAX}
          aria-describedby={`${reasonId}-hint`}
        />
        <p className="hint" id={`${reasonId}-hint`}>
          Required to reject. Recorded with an escalation. Goes in the audit log.
        </p>
      </div>
      <div className="row">
        <SubmitButton variant="primary" name="decision" value="approve">
          {labels.approve}
        </SubmitButton>
        <SubmitButton name="decision" value="reject">
          {labels.reject}
        </SubmitButton>
        <SubmitButton name="decision" value="escalate">
          Escalate to safeguarding
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function ModerationPage() {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'moderation.review')) {
    return <Denied actor={actor} permission="moderation.review" section="Moderation" />;
  }
  const store = getStore();
  const cases = store.listCases();
  const stories = new Map(store.listStories().map((story) => [story.id, story]));
  const activities = new Map(activitySeed.map((activity) => [activity.id, activity]));

  const pendingPhotos = cases.filter((c) => c.kind === 'fan_cam' && c.state === 'pending');
  const pendingReports = cases.filter((c) => c.kind === 'story_report' && c.state === 'pending');
  const escalated = cases.filter((c) => c.state === 'escalated');
  const decided = cases.filter((c) => c.state === 'approved' || c.state === 'rejected');

  const describe = (item: ModerationCase) =>
    item.kind === 'fan_cam'
      ? `Fan Cam photo from ${item.submitter}`
      : `Report on “${stories.get(item.storyId)?.title.en ?? item.storyId}”`;

  return (
    <div className="stack">
      <PageHeader eyebrow="Moderation" title="Fan Zone review queue">
        Nothing a supporter sends is shown to anyone else until a moderator approves it. Approve,
        reject with a reason, or escalate to safeguarding. Every decision is recorded.
      </PageHeader>

      <section className="stack" aria-labelledby="photos-title">
        <div className="row">
          <h2 id="photos-title">Fan Cam photos waiting</h2>
          <Chip tone={pendingPhotos.length > 0 ? 'warn' : 'good'}>
            {plural(pendingPhotos.length, 'photo')} pending
          </Chip>
        </div>
        {pendingPhotos.length === 0 ? (
          <Empty>No photos are waiting. New submissions appear here, hidden, until reviewed.</Empty>
        ) : (
          <ul className="items">
            {pendingPhotos.map((item) =>
              item.kind !== 'fan_cam' ? null : (
                <li key={item.id} className="item">
                  <Media id={item.mediaId} size="card" />
                  <div className="item__body">
                    <div className="row">
                      <Chip tone="warn">Pending: not visible to supporters</Chip>
                      <DemoTag />
                    </div>
                    <h3>{describe(item)}</h3>
                    <dl className="facts">
                      <dt>Caption</dt>
                      <dd>{item.caption ?? 'No caption'}</dd>
                      <dt>Sent</dt>
                      <dd>{formatDateTime(item.submittedAt)}</dd>
                      <dt>Activity</dt>
                      <dd>
                        {activities.get(item.activityId)?.title.en ?? 'Fan Cam'} ({item.activityId})
                      </dd>
                    </dl>
                    <ul className="checks" aria-label="Consent recorded with the photo">
                      <li>Consent recorded: sender is 18 or over, or a parent or guardian</li>
                      <li>Consent recorded: people in the photo agreed</li>
                      <li>Consent recorded: display and moderation</li>
                    </ul>
                    {item.reviewerPrompt ? (
                      <p className="note">
                        <strong>Check before approving.</strong> {item.reviewerPrompt}
                      </p>
                    ) : null}
                  </div>
                  <div className="item__actions">
                    <DecisionForm item={item} labels={{ approve: 'Approve', reject: 'Reject' }} />
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="stack" aria-labelledby="reports-title">
        <div className="row">
          <h2 id="reports-title">Reported supporter stories</h2>
          <Chip tone={pendingReports.length > 0 ? 'warn' : 'good'}>
            {plural(pendingReports.length, 'report')} open
          </Chip>
        </div>
        {pendingReports.length === 0 ? (
          <Empty>No reports are open.</Empty>
        ) : (
          <ul className="items">
            {pendingReports.map((item) => {
              if (item.kind !== 'story_report') return null;
              const story = stories.get(item.storyId);
              const held = story?.moderation !== 'approved';
              return (
                <li key={item.id} className="item">
                  {story ? <Media id={story.mediaId} size="card" /> : <div />}
                  <div className="item__body">
                    <div className="row">
                      <Chip tone={held ? 'strong' : 'warn'}>
                        {held
                          ? 'Story held: hidden while reviewed'
                          : 'Story still visible to supporters'}
                      </Chip>
                      <DemoTag />
                    </div>
                    <h3>{story?.title.en ?? item.storyId}</h3>
                    <dl className="facts">
                      <dt>Reported as</dt>
                      <dd>{reportReasonLabels[item.reason]}</dd>
                      <dt>Report</dt>
                      <dd>{item.note}</dd>
                      <dt>Reported</dt>
                      <dd>
                        {formatDateTime(item.submittedAt)} by {item.reporter}
                      </dd>
                      <dt>Story text</dt>
                      <dd>{story?.body.en}</dd>
                    </dl>
                    <p className="hint">
                      Privacy and safety reports hold the story at once. Other reports leave it up
                      until a moderator decides.
                    </p>
                  </div>
                  <div className="item__actions">
                    <DecisionForm
                      item={item}
                      labels={{ approve: 'Keep published', reject: 'Remove story' }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card
        title="Escalated to safeguarding"
        id="escalated"
        aside={
          <Chip tone={escalated.length > 0 ? 'strong' : 'neutral'}>
            {escalated.length} escalated
          </Chip>
        }
      >
        <p className="hint" style={{ marginTop: 0, marginBottom: 'var(--s-md)' }}>
          Escalated items stay hidden and leave this queue. They are handled by the club’s
          safeguarding lead, outside this console; the contact route is for the club to supply.
        </p>
        {escalated.length === 0 ? (
          <Empty>Nothing has been escalated.</Empty>
        ) : (
          <TableWrap label="Escalated cases">
            <table>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Escalated by</th>
                  <th scope="col">When</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {escalated.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{describe(item)}</th>
                    <td>{item.decision?.by}</td>
                    <td>{item.decision ? formatDateTime(item.decision.at) : ''}</td>
                    <td>{item.decision?.reason ?? 'No note given'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card title="Decided" id="decided" aside={<DemoTag />}>
        {decided.length === 0 ? (
          <Empty>No decisions yet. Approved and rejected items are listed here.</Empty>
        ) : (
          <TableWrap label="Decided cases">
            <table>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Decision</th>
                  <th scope="col">By</th>
                  <th scope="col">Reason</th>
                  <th scope="col">
                    <span className="sr-only">Reopen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {decided.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <div className="cell-title">
                        {item.kind === 'fan_cam' ? (
                          <Media id={item.mediaId} size="thumb" decorative />
                        ) : null}
                        <div>
                          {describe(item)}
                          <span className="cell-sub">
                            {item.state === 'approved'
                              ? 'Visible to supporters'
                              : 'Hidden from supporters'}
                          </span>
                        </div>
                      </div>
                    </th>
                    <td>
                      <Chip tone={stateTone[item.state]}>{caseStateLabels[item.state]}</Chip>
                    </td>
                    <td>
                      {item.decision?.by}
                      <span className="cell-sub">
                        {item.decision ? formatDateTime(item.decision.at) : ''}
                      </span>
                    </td>
                    <td>{item.decision?.reason ?? <span className="meta">None given</span>}</td>
                    <td className="actions">
                      <ActionForm action={reopenCaseAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <SubmitButton aria-label={`Reopen ${describe(item)}`}>Reopen</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
