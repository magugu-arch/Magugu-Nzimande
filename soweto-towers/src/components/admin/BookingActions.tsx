'use client';

import { attachClipAction, cancelBookingAction, resendConfirmationAction } from '@/app/admin/actions';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

export function ResendForm({ bookingRef }: { bookingRef: string }) {
  return (
    <ActionForm action={resendConfirmationAction}>
      <input type="hidden" name="ref" value={bookingRef} />
      <div>
        <SubmitButton className="btn btn--light" pendingLabel="Sending…">
          Re-send confirmation
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CancelForm({ bookingRef, paid }: { bookingRef: string; paid: boolean }) {
  return (
    <ActionForm action={cancelBookingAction}>
      <input type="hidden" name="ref" value={bookingRef} />
      <div className="field">
        <label className="field-label" htmlFor="cancel-reason">
          Reason <span className={styles.muted}>(for the audit log)</span>
        </label>
        <input id="cancel-reason" name="reason" className="input" maxLength={300} placeholder="e.g. Moved to another day by phone" />
      </div>
      <label className="check">
        <input type="checkbox" name="confirm" />
        <span>
          Cancel this booking and release its places.
          {paid ? ' Any refund is done separately in the PayFast dashboard.' : ''}
        </span>
      </label>
      <div>
        <SubmitButton className={`btn ${styles.dangerBtn}`} pendingLabel="Cancelling…">
          Cancel booking
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ClipForm({ bookingRef, people }: { bookingRef: string; people: string[] }) {
  return (
    <ActionForm action={attachClipAction}>
      <input type="hidden" name="ref" value={bookingRef} />
      <div className={`${styles.fields} ${styles.fields2}`}>
        <div className="field">
          <label className="field-label" htmlFor="clip-kind">
            Type
          </label>
          <select id="clip-kind" name="kind" className="input" defaultValue="scream">
            <option value="scream">Scream Clip (10 seconds, free)</option>
            <option value="full">Full HD edit (paid)</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="clip-who">
            Jumper <span className={styles.muted}>(optional)</span>
          </label>
          <select id="clip-who" name="participant" className="input" defaultValue="">
            <option value="">Whole booking</option>
            {people.map((p, i) => (
              <option key={`${p}-${i}`} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className={`field ${styles.span2}`}>
          <label className="field-label" htmlFor="clip-url">
            Link to the video
          </label>
          <input id="clip-url" name="url" type="url" className="input" placeholder="https://…" inputMode="url" required />
          <span className="field-hint">An unlisted YouTube link or a file link from your storage. Scream Clips message the jumper on WhatsApp.</span>
        </div>
      </div>
      <div>
        <SubmitButton pendingLabel="Saving…">Attach video</SubmitButton>
      </div>
    </ActionForm>
  );
}
