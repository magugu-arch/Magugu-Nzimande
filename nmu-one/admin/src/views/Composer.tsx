'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import type { NotificationCategory, NotificationPriority } from '@core/domain/models';
import { PushPreview } from '@/components/PushPreview';
import { Card, describedBy, Empty, Field, Notice, PageHeader } from '@/components/ui';
import { describeSegment, estimateReach, fmt } from '@/lib/audience';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { CATEGORY_LABELS, destinations, PRIORITY } from '@/lib/labels';
import { canPublishInto } from '@/lib/operators';
import {
  currentOperator,
  saveCampaign,
  useConsole,
  validateDraft,
  type CampaignDraft,
} from '@/lib/store';
import { clock } from '@core/time/clock';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as NotificationCategory[];
const PRIORITIES: NotificationPriority[] = ['high', 'normal', 'low'];

export function Composer() {
  const data = useConsole();
  const op = currentOperator(data);
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('edit');
  const existing = editId ? data.campaigns.find((c) => c.id === editId) : undefined;

  const allowedCategories = CATEGORIES.filter((c) => canPublishInto(op, c));
  const segments = data.segments.filter(
    (s) => !op.faculty || (s.faculties !== 'all' && s.faculties.every((f) => f === op.faculty)),
  );

  const [draft, setDraft] = useState<CampaignDraft>(() =>
    existing
      ? {
          title: existing.title,
          body: existing.body,
          category: existing.category,
          priority: existing.priority,
          segmentId: existing.segmentId,
          deepLink: existing.deepLink,
          actionLabel: existing.actionLabel,
          sendAt: existing.sendAt,
          expiresAt: existing.expiresAt,
          respectQuietHours: existing.respectQuietHours,
          channels: existing.channels,
        }
      : {
          title: '',
          body: '',
          category: allowedCategories[0] ?? 'community',
          priority: 'normal',
          segmentId: segments[0]?.id ?? '',
          deepLink: '/events',
          actionLabel: 'Open in NMU ONE',
          sendAt: null,
          expiresAt: null,
          respectQuietHours: true,
          channels: { push: true, inApp: true },
        },
  );
  const [schedule, setSchedule] = useState<'on-approval' | 'at'>(
    existing?.sendAt ? 'at' : 'on-approval',
  );
  const [errors, setErrors] = useState<string[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  if (allowedCategories.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Notifications" title="New notification" />
        <Empty
          title="Your role can’t write notifications"
          action={
            <Link className="btn" href="/notifications/">
              Back to notifications
            </Link>
          }
        >
          Switch to a communications officer or faculty publisher to try the composer.
        </Empty>
      </>
    );
  }
  if (editId && (!existing || !['draft', 'changes-requested'].includes(existing.status))) {
    return (
      <>
        <PageHeader eyebrow="Notifications" title="Edit notification" />
        <Empty
          title="This notification can’t be edited"
          action={
            <Link className="btn" href="/notifications/">
              Back to notifications
            </Link>
          }
        >
          Only drafts and notices sent back for changes can be edited.
        </Empty>
      </>
    );
  }

  const segment = data.segments.find((s) => s.id === draft.segmentId);
  const changesNote = existing?.history
    .filter((h) => h.action === 'changes-requested')
    .at(-1)?.note;

  const submit = (forApproval: boolean) => {
    const final = { ...draft, sendAt: schedule === 'at' ? draft.sendAt : null };
    if (forApproval) {
      const problems = validateDraft(final, op, data.segments, clock.now());
      if (schedule === 'at' && !final.sendAt)
        problems.unshift('Choose a send time, or send on approval.');
      setErrors(problems);
      if (problems.length) {
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
    }
    const r = saveCampaign(final, editId, forApproval);
    if (r.ok && r.id) router.push(`/notifications/view/?id=${r.id}`);
    else if (!r.ok) {
      setErrors([r.message]);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  const err = (match: RegExp) => errors.find((e) => match.test(e));

  return (
    <>
      <PageHeader
        eyebrow="Notifications · Create"
        title={existing ? 'Edit notification' : 'New notification'}
        description={`Writing as ${op.name}. You can publish into: ${allowedCategories.map((c) => CATEGORY_LABELS[c]).join(', ')}${op.faculty ? `, for ${op.faculty} only` : ''}.`}
      />
      {changesNote ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warning" title="The approver asked for changes">
            {changesNote}
          </Notice>
        </div>
      ) : null}
      {errors.length ? (
        <div
          className="notice tone-danger"
          role="alert"
          tabIndex={-1}
          ref={summaryRef}
          style={{ marginBottom: 16 }}
        >
          <strong>
            Fix {errors.length === 1 ? 'this' : `these ${errors.length} things`} before submitting
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit(true);
          }}
        >
          <Card title="Message">
            <div className="stack">
              <Field
                id="title"
                label="Title"
                hint={`${draft.title.length}/65 characters — what someone sees on their lock screen.`}
                error={err(/title/i)}
              >
                <input
                  id="title"
                  type="text"
                  value={draft.title}
                  maxLength={80}
                  aria-describedby={describedBy('title', { hint: true, error: err(/title/i) })}
                  aria-invalid={Boolean(err(/title/i))}
                  onChange={(e) => set('title', e.target.value)}
                />
              </Field>
              <Field
                id="body"
                label="Message"
                hint={`${draft.body.length}/240 characters. Say what changed and what to do.`}
                error={err(/message/i)}
              >
                <textarea
                  id="body"
                  value={draft.body}
                  maxLength={300}
                  aria-describedby={describedBy('body', { hint: true, error: err(/message/i) })}
                  aria-invalid={Boolean(err(/message/i))}
                  onChange={(e) => set('body', e.target.value)}
                />
              </Field>
              <div className="form-grid">
                <Field id="category" label="Category">
                  <select
                    id="category"
                    value={draft.category}
                    onChange={(e) => set('category', e.target.value as NotificationCategory)}
                  >
                    {allowedCategories.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </Field>
                <fieldset>
                  <legend>Priority</legend>
                  <div className="stack-sm">
                    {PRIORITIES.map((p) => (
                      <label className="check" key={p}>
                        <input
                          type="radio"
                          name="priority"
                          value={p}
                          checked={draft.priority === p}
                          onChange={() => set('priority', p)}
                        />
                        <span>
                          {PRIORITY[p].label} <span className="hint">— {PRIORITY[p].hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          </Card>

          <Card title="Audience">
            <Field
              id="segment"
              label="Who receives it"
              hint={
                op.faculty
                  ? `Faculty publishers reach ${op.faculty} audiences only.`
                  : 'Audiences are built on the Audiences page.'
              }
              error={err(/audience|faculty/i)}
            >
              <select
                id="segment"
                value={draft.segmentId}
                aria-describedby={describedBy('segment', {
                  hint: true,
                  error: err(/audience|faculty/i),
                })}
                onChange={(e) => set('segmentId', e.target.value)}
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            {segment ? (
              <p className="small muted" style={{ marginTop: 10 }} aria-live="polite">
                About <strong>{fmt(estimateReach(segment))}</strong> people ·{' '}
                {describeSegment(segment)}
              </p>
            ) : null}
          </Card>

          <Card
            title="Action"
            description="Every notice should open the screen where someone can act on it."
          >
            <div className="form-grid">
              <Field id="deeplink" label="Opens" error={err(/link/i)}>
                <select
                  id="deeplink"
                  value={draft.deepLink ?? ''}
                  aria-describedby={describedBy('deeplink', { error: err(/link/i) })}
                  onChange={(e) => set('deepLink', e.target.value || null)}
                >
                  <option value="">Nothing — information only</option>
                  {destinations(data).map((d) => (
                    <option key={d.href} value={d.href}>
                      {d.label} ({d.href})
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="action-label" label="Button text" error={err(/button/i)}>
                <input
                  id="action-label"
                  type="text"
                  aria-describedby={describedBy('action-label', { error: err(/button/i) })}
                  value={draft.actionLabel}
                  disabled={!draft.deepLink}
                  maxLength={30}
                  onChange={(e) => set('actionLabel', e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card title="Schedule & delivery">
            <div className="stack">
              <fieldset>
                <legend>Send</legend>
                <div className="stack-sm">
                  <label className="check">
                    <input
                      type="radio"
                      name="schedule"
                      checked={schedule === 'on-approval'}
                      onChange={() => setSchedule('on-approval')}
                    />
                    As soon as it’s approved
                  </label>
                  <label className="check">
                    <input
                      type="radio"
                      name="schedule"
                      checked={schedule === 'at'}
                      onChange={() => setSchedule('at')}
                    />
                    At a set time
                  </label>
                </div>
              </fieldset>
              <div className="form-grid">
                {schedule === 'at' ? (
                  <Field id="send-at" label="Send at (SAST)" error={err(/send time/i)}>
                    <input
                      id="send-at"
                      type="datetime-local"
                      value={toLocalInput(draft.sendAt)}
                      aria-invalid={Boolean(err(/send time/i))}
                      aria-describedby={describedBy('send-at', { error: err(/send time/i) })}
                      onChange={(e) => set('sendAt', fromLocalInput(e.target.value))}
                    />
                  </Field>
                ) : null}
                <Field
                  id="expires"
                  label="Expires (optional, SAST)"
                  hint="After this it leaves the inbox and Home."
                  error={err(/expiry/i)}
                >
                  <input
                    id="expires"
                    type="datetime-local"
                    value={toLocalInput(draft.expiresAt)}
                    aria-describedby={describedBy('expires', { hint: true, error: err(/expiry/i) })}
                    onChange={(e) => set('expiresAt', fromLocalInput(e.target.value))}
                  />
                </Field>
              </div>
              <fieldset>
                <legend>Channels</legend>
                <div className="row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.channels.push}
                      onChange={(e) =>
                        set('channels', { ...draft.channels, push: e.target.checked })
                      }
                    />
                    Push notification
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.channels.inApp}
                      onChange={(e) =>
                        set('channels', { ...draft.channels, inApp: e.target.checked })
                      }
                    />
                    NMU ONE inbox
                  </label>
                </div>
              </fieldset>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.respectQuietHours}
                  onChange={(e) => set('respectQuietHours', e.target.checked)}
                />
                Respect each person’s quiet hours (22:00–06:00 by default) — push waits until
                morning
              </label>
            </div>
          </Card>

          <div className="row">
            <button type="submit" className="btn primary">
              Submit for approval
            </button>
            <button type="button" className="btn" onClick={() => submit(false)}>
              Save draft
            </button>
            <Link className="btn ghost" href="/notifications/">
              Cancel
            </Link>
          </div>
        </form>

        <div className="stack" style={{ position: 'sticky', top: 16 }}>
          <Card title="Preview">
            <PushPreview
              title={draft.title}
              body={draft.body}
              actionLabel={draft.deepLink ? draft.actionLabel : ''}
              priority={draft.priority}
              at={draft.sendAt && schedule === 'at' ? draft.sendAt : clock.now().toISOString()}
            />
          </Card>
          <Notice tone="info" title="What happens next">
            An approver who isn’t you reviews it. Approved notices go out at the time you set,
            respecting quiet hours, and the results appear on the notification’s page.
          </Notice>
        </div>
      </div>
    </>
  );
}
