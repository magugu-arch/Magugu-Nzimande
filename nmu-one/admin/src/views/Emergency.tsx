'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PushPreview } from '@/components/PushPreview';
import { Card, Dialog, Empty, Notice, PageHeader } from '@/components/ui';
import { estimateReach, fmt } from '@/lib/audience';
import { allows } from '@/lib/operators';
import { currentOperator, sendEmergency, useConsole } from '@/lib/store';
import { clock } from '@core/time/clock';

/**
 * Emergency notices (brief §11, §13). They skip the approval queue because
 * minutes matter, so the safeguards move here: only approvers may send, a
 * reason is required, the sender confirms the reach, and the audit log flags
 * the send for review.
 */
export function Emergency() {
  const data = useConsole();
  const op = currentOperator(data);
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    body: '',
    segmentId: 'seg-everyone',
    deepLink: '/safety',
    actionLabel: 'Open Safety',
    reason: '',
  });
  const [confirming, setConfirming] = useState(false);
  const segment = data.segments.find((s) => s.id === form.segmentId);
  const ready =
    form.title.trim().length >= 6 &&
    form.body.trim().length >= 10 &&
    form.reason.trim().length >= 5;

  if (!allows(op, 'send-emergency')) {
    return (
      <>
        <PageHeader eyebrow="Notifications" title="Send an emergency notice" />
        <Empty
          title="Only approvers can send emergency notices"
          action={
            <Link className="btn" href="/notifications/">
              Back to notifications
            </Link>
          }
        >
          If there is an emergency, contact an approver or Protection Services now. In danger, call
          10111 or 112.
        </Empty>
      </>
    );
  }

  const update = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader
        eyebrow="Notifications · Emergency"
        title="Send an emergency notice"
        description="For immediate danger or disruption only. It goes out now, sounds on every phone and ignores quiet hours."
      />
      <div style={{ marginBottom: 16 }}>
        <Notice tone="warning" title="Say only what Protection Services has confirmed">
          State what is happening, where, and what people should do. Don’t speculate. Follow-ups use
          normal notices.
        </Notice>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) setConfirming(true);
          }}
        >
          <Card title="Message">
            <div className="stack">
              <div className="field">
                <label htmlFor="em-title">Title</label>
                <input
                  id="em-title"
                  type="text"
                  required
                  maxLength={65}
                  value={form.title}
                  onChange={update('title')}
                />
              </div>
              <div className="field">
                <label htmlFor="em-body">What people should do</label>
                <textarea
                  id="em-body"
                  required
                  maxLength={240}
                  value={form.body}
                  onChange={update('body')}
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="em-segment">Audience</label>
                  <select id="em-segment" value={form.segmentId} onChange={update('segmentId')}>
                    {data.segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="em-link">Opens</label>
                  <select id="em-link" value={form.deepLink} onChange={update('deepLink')}>
                    <option value="/safety">Safety</option>
                    <option value="/campus-map">Campus map</option>
                    <option value="/transport">Shuttle</option>
                    <option value="/notifications">Notifications inbox</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="em-reason">
                  Why is this an emergency? (recorded in the audit log)
                </label>
                <input
                  id="em-reason"
                  type="text"
                  required
                  value={form.reason}
                  onChange={update('reason')}
                />
              </div>
            </div>
          </Card>
          <div className="row">
            <button type="submit" className="btn danger solid" aria-disabled={!ready}>
              Review and send
            </button>
            <Link className="btn ghost" href="/notifications/">
              Cancel
            </Link>
          </div>
          {!ready ? (
            <p className="hint">Fill in the title, message and reason to continue.</p>
          ) : null}
        </form>
        <Card title="Preview">
          <PushPreview
            title={form.title}
            body={form.body}
            actionLabel={form.actionLabel}
            priority="emergency"
            at={clock.now().toISOString()}
          />
        </Card>
      </div>
      <Dialog
        open={confirming}
        title="Send this emergency notice now?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn danger solid"
              onClick={() => {
                const r = sendEmergency(form);
                if (r.ok) {
                  setConfirming(false);
                  router.push('/notifications/');
                }
              }}
            >
              Send to {segment ? fmt(estimateReach(segment)) : 0} people now
            </button>
          </>
        }
      >
        <p>
          “{form.title}” will interrupt about{' '}
          <strong>{segment ? fmt(estimateReach(segment)) : 0}</strong> people ({segment?.name}
          ), including anyone in quiet hours. This can’t be undone.
        </p>
      </Dialog>
    </>
  );
}
