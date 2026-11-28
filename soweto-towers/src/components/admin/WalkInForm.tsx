'use client';

import { logWalkInAction } from '@/app/admin/actions';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

export function WalkInForm({ options }: { options: { id: string; name: string; price: number }[] }) {
  return (
    <ActionForm action={logWalkInAction}>
      <div className={styles.toolbar}>
        <div className="field">
          <label className="field-label" htmlFor="walkin-activity">
            Activity
          </label>
          <select id="walkin-activity" name="activityId" className="input" defaultValue="bungee-jump">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · R{o.price}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '0 1 110px' }}>
          <label className="field-label" htmlFor="walkin-qty">
            People
          </label>
          <input id="walkin-qty" name="qty" className="input" type="number" min={1} max={60} defaultValue={1} inputMode="numeric" />
        </div>
        <SubmitButton pendingLabel="Logging…">Log gate sale</SubmitButton>
      </div>
    </ActionForm>
  );
}
