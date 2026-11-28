'use client';

import { broadcastAction } from '@/app/admin/actions';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

export function BroadcastForm({ devices }: { devices: number }) {
  return (
    <ActionForm action={broadcastAction}>
      <div className={`${styles.fields} ${styles.fields2}`}>
        <div className="field">
          <label className="field-label" htmlFor="b-title">
            Title
          </label>
          <input id="b-title" name="title" className="input" maxLength={60} placeholder="Sunset jumps tonight" required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="b-url">
            Opens page
          </label>
          <input id="b-url" name="url" className="input" defaultValue="/book" maxLength={120} />
        </div>
        <div className={`field ${styles.span2}`}>
          <label className="field-label" htmlFor="b-body">
            Message
          </label>
          <input id="b-body" name="body" className="input" maxLength={180} placeholder="Clear skies and short queues. Last slot 18:00." required />
        </div>
      </div>
      <p className={`${styles.small} ${styles.muted}`}>
        Goes to the {devices} {devices === 1 ? 'device' : 'devices'} that switched on tower-status alerts. Keep it useful: weather, queues, new dates.
      </p>
      <div>
        <SubmitButton className="btn btn--primary" pendingLabel="Sending…">
          Send push alert
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
