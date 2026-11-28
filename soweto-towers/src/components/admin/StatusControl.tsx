'use client';

import { updateTowerStatus } from '@/app/admin/actions';
import type { TowerStatus } from '@/lib/status-types';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

const options = [
  { value: 'auto', label: 'Auto', hint: 'Follow the schedule', className: '' },
  { value: 'open', label: 'Open', hint: 'Jumping now', className: styles.segOpen },
  { value: 'hold', label: 'Weather hold', hint: 'Paused for rain or lightning', className: styles.segHold },
  { value: 'closed', label: 'Closed', hint: 'Closed for the day', className: styles.segClosed },
] as const;

export function StatusControl({ current }: { current: TowerStatus }) {
  return (
    <ActionForm action={updateTowerStatus}>
      <fieldset className={styles.segments} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="visually-hidden">Tower status</legend>
        {options.map((o) => (
          <label key={o.value} className={`${styles.segment} ${o.className}`}>
            <input type="radio" name="state" value={o.value} defaultChecked={current.state === o.value} />
            <strong>{o.label}</strong>
            <span>{o.hint}</span>
          </label>
        ))}
      </fieldset>
      <div className={`${styles.fields} ${styles.fields2}`}>
        <div className="field">
          <label className="field-label" htmlFor="status-note">
            Note on the website <span className={styles.muted}>(optional)</span>
          </label>
          <input
            id="status-note"
            name="note"
            className="input"
            maxLength={200}
            defaultValue={current.note ?? ''}
            placeholder="e.g. Storm passing, back on the bridge by 14:30"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="status-queue">
            Queue, in minutes <span className={styles.muted}>(optional)</span>
          </label>
          <input
            id="status-queue"
            name="queueMinutes"
            className="input"
            type="number"
            min={0}
            max={300}
            inputMode="numeric"
            defaultValue={current.queueMinutes ?? ''}
          />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="notify" defaultChecked />
        <span>Tell today’s visitors and push subscribers when we pause, close or reopen</span>
      </label>
      <div>
        <SubmitButton className="btn btn--primary" pendingLabel="Updating…">
          Update status
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
