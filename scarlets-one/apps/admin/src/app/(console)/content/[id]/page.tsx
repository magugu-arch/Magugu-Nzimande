import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  approveContentAction,
  archiveContentAction,
  pinContentAction,
  requestReviewAction,
  returnContentToDraftAction,
  saveContentAction,
} from '@/actions/content';
import { ActionForm, SubmitButton } from '@/components/action-form';
import { ContentFields } from '@/components/content-fields';
import { ContentPreview } from '@/components/content-preview';
import { Card, Chip, DemoTag, Denied, PageHeader } from '@/components/ui';
import {
  categoryLabels,
  contentStatusLabels,
  formatDateTime,
  kindLabels,
  translationLabels,
} from '@/lib/format';
import { getStore } from '@/lib/instance';
import { mayAct, roleLabels } from '@/lib/rbac';
import { requireActor } from '@/lib/session';
import { DAY, utcToZonedInput } from '@/lib/time';

export const metadata: Metadata = { title: 'Content item' };

export default async function ContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'content.read')) {
    return <Denied actor={actor} permission="content.read" section="Content" />;
  }
  const { id } = await params;
  const store = getStore();
  const record = store.getContent(id);
  if (!record) notFound();
  const { item } = record;

  const canWrite = mayAct(actor.role, 'content.write');
  const canPublish = mayAct(actor.role, 'content.publish');
  const editable =
    item.status !== 'archived' && (canPublish || (canWrite && item.status === 'draft'));
  const awaitingRelease = item.status === 'draft' || item.status === 'scheduled';
  const defaultWhen =
    item.status === 'scheduled'
      ? item.publishAt
      : new Date(store.now().getTime() + DAY).toISOString();

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`Content · ${categoryLabels[item.category]} · ${kindLabels[item.kind]}`}
        title={item.title.en}
        actions={
          <Link className="btn btn--secondary" href="/content">
            Back to content
          </Link>
        }
      >
        <span className="row">
          <Chip
            tone={
              item.status === 'published'
                ? 'good'
                : item.status === 'scheduled'
                  ? 'warn'
                  : 'neutral'
            }
          >
            {contentStatusLabels[item.status]}
          </Chip>
          <Chip tone={item.translation === 'approved' ? 'good' : 'warn'}>
            {translationLabels[item.translation]}
          </Chip>
          {item.pinned ? <Chip>Pinned</Chip> : null}
          {record.review ? <Chip tone="warn">Approval requested</Chip> : null}
          <DemoTag />
        </span>
      </PageHeader>

      <div className="split">
        <div className="stack">
          <Card title="Text in English and Welsh" id="edit">
            {editable ? (
              // Remount with fresh values whenever the saved item changes.
              <ActionForm key={record.updatedAt} action={saveContentAction} className="form">
                <input type="hidden" name="id" value={item.id} />
                <ContentFields item={item} canApproveWelsh={canPublish} />
                <div className="row">
                  <SubmitButton variant={item.status === 'draft' ? 'primary' : 'secondary'}>
                    {item.status === 'draft' ? 'Save draft' : 'Save changes'}
                  </SubmitButton>
                  {item.status !== 'draft' ? (
                    <p className="hint">
                      This item is {contentStatusLabels[item.status].toLowerCase()}: a saved change
                      is what supporters see.
                    </p>
                  ) : null}
                </div>
              </ActionForm>
            ) : (
              <p className="note">
                {item.status === 'archived'
                  ? 'This item is archived. A club admin can return it to draft to edit it.'
                  : canWrite
                    ? `Editors can change drafts only. This item is ${contentStatusLabels[item.status].toLowerCase()}: a club admin can edit it or return it to draft.`
                    : `${roleLabels[actor.role]}s can read content but not change it.`}
              </p>
            )}
          </Card>

          <Card title="Publication" id="publication">
            <dl className="facts">
              <dt>Status</dt>
              <dd>{contentStatusLabels[item.status]}</dd>
              <dt>Publish time</dt>
              <dd>{item.status === 'draft' ? 'Not set' : formatDateTime(item.publishAt)}</dd>
              <dt>Approved by</dt>
              <dd>
                {record.approval
                  ? `${record.approval.by}, ${formatDateTime(record.approval.at)}`
                  : item.status === 'published'
                    ? 'Seeded as published (demo data)'
                    : 'Not yet approved'}
              </dd>
              <dt>Last change</dt>
              <dd>
                {record.updatedBy}, {formatDateTime(record.updatedAt)}
              </dd>
              {record.review ? (
                <>
                  <dt>Approval requested</dt>
                  <dd>
                    {record.review.requestedBy}, {formatDateTime(record.review.requestedAt)}
                  </dd>
                </>
              ) : null}
            </dl>

            {canPublish && awaitingRelease ? (
              <ActionForm
                action={approveContentAction}
                className="form"
                style={{ marginTop: 'var(--s-xl)' }}
              >
                <input type="hidden" name="id" value={item.id} />
                <h3>Approve for publication</h3>
                <label className="choice">
                  <input type="checkbox" name="confirmed" value="yes" />
                  <span>
                    I have checked the preview in English and Welsh
                    <small>
                      {item.translation === 'approved'
                        ? 'Welsh is approved.'
                        : item.translation === 'draft'
                          ? 'Welsh is a draft: it will be shown as it is, without club sign-off.'
                          : 'Welsh is missing: Welsh readers will see English with a fallback label.'}
                    </small>
                  </span>
                </label>
                <div className="field">
                  <label htmlFor="publishAt">Scheduled time (UK time)</label>
                  <input
                    id="publishAt"
                    name="publishAt"
                    type="datetime-local"
                    defaultValue={utcToZonedInput(defaultWhen)}
                    aria-describedby="publishAt-hint"
                  />
                  <p className="hint" id="publishAt-hint">
                    Used only by “Schedule”. The item publishes itself at this time.
                  </p>
                </div>
                <div className="row">
                  <SubmitButton variant="primary" name="intent" value="publish">
                    Publish now
                  </SubmitButton>
                  <SubmitButton name="intent" value="schedule">
                    {item.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                  </SubmitButton>
                </div>
              </ActionForm>
            ) : null}

            {canPublish ? (
              <div className="row" style={{ marginTop: 'var(--s-xl)' }}>
                {item.status === 'published' || item.status === 'scheduled' ? (
                  <ActionForm action={pinContentAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="pinned" value={item.pinned ? 'no' : 'yes'} />
                    <SubmitButton>{item.pinned ? 'Unpin' : 'Pin to top'}</SubmitButton>
                  </ActionForm>
                ) : null}
                {item.status !== 'draft' ? (
                  <ActionForm action={returnContentToDraftAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton>Return to draft</SubmitButton>
                  </ActionForm>
                ) : null}
                {item.status !== 'archived' ? (
                  <ActionForm action={archiveContentAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton>Archive</SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            ) : null}

            {!canPublish && canWrite && item.status === 'draft' ? (
              <div style={{ marginTop: 'var(--s-xl)' }}>
                {record.review ? (
                  <p className="note">
                    Waiting for a club admin. Editors cannot publish: publishing needs{' '}
                    <code>content.publish</code>.
                  </p>
                ) : (
                  <ActionForm action={requestReviewAction} className="stack stack--tight">
                    <input type="hidden" name="id" value={item.id} />
                    <p className="hint">
                      Editors cannot publish. Send the draft to a club admin, who previews it and
                      publishes or schedules it.
                    </p>
                    <div className="row">
                      <SubmitButton variant="primary">Request approval</SubmitButton>
                    </div>
                  </ActionForm>
                )}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="stack">
          <ContentPreview item={item} locale="en" />
          <ContentPreview item={item} locale="cy" />
        </div>
      </div>
    </div>
  );
}
