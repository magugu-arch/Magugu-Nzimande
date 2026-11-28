'use client';

import { useEffect, useRef } from 'react';
import { markChatRead, replyToChat, setTableStatusAction } from '@/app/admin/actions';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

/** Clears the unread count once the thread is actually on screen (not on prefetch). */
export function MarkRead({ id, unread }: { id: string; unread: number }) {
  useEffect(() => {
    if (unread > 0) markChatRead(id).catch(() => {});
  }, [id, unread]);
  return null;
}

/** Keeps the newest message in view as the thread refreshes. */
export function ThreadScroller({ children, count }: { children: React.ReactNode; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    <div ref={ref} className={styles.thread} aria-live="polite">
      {children}
    </div>
  );
}

export function ReplyForm({ conversationId, suggestions }: { conversationId: string; suggestions: string[] }) {
  const area = useRef<HTMLTextAreaElement>(null);
  return (
    <ActionForm action={replyToChat}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="field">
        <label className="field-label" htmlFor="reply">
          Reply
        </label>
        <textarea ref={area} id="reply" name="body" className="input" rows={3} maxLength={2000} placeholder="Write your reply" required />
      </div>
      {suggestions.length > 0 && (
        <div className="cluster" style={{ ['--cluster' as string]: '6px' }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className={`pill pill--outline ${styles.suggestion}`}
              onClick={() => {
                if (area.current) {
                  area.current.value = area.current.value ? `${area.current.value} ${s}` : s;
                  area.current.focus();
                }
              }}
            >
              {s.length > 42 ? `${s.slice(0, 40)}…` : s}
            </button>
          ))}
        </div>
      )}
      <div>
        <SubmitButton pendingLabel="Sending…">Send reply</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TableActions({ id, status }: { id: string; status: string }) {
  return (
    <ActionForm action={setTableStatusAction} className={styles.rowActions}>
      <input type="hidden" name="id" value={id} />
      {status !== 'confirmed' && (
        <SubmitButton className="btn btn--dark btn--sm" name="status" value="confirmed" pendingLabel="…">
          Confirm by WhatsApp
        </SubmitButton>
      )}
      {status === 'requested' && (
        <SubmitButton className="btn btn--light btn--sm" name="status" value="declined" pendingLabel="…">
          Decline
        </SubmitButton>
      )}
      {status !== 'requested' && (
        <SubmitButton className="btn btn--light btn--sm" name="status" value="requested" pendingLabel="…">
          Reopen
        </SubmitButton>
      )}
    </ActionForm>
  );
}
