'use client';

import { addHoursOverrideAction, saveCapacityAction, savePricesAction } from '@/app/admin/actions';
import type { CapacityConfig } from '@/lib/data/settings-types';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

const resourceLabels: Record<keyof CapacityConfig['perSlot'], string> = {
  bridge: 'Bridge (bungee + straightjacket)',
  scad: 'SCAD freefall',
  zipline: 'Zipline',
  lift: 'Lift ride',
  arena: 'Paintball arena (groups per hour)',
};

export function CapacityForm({ cfg }: { cfg: CapacityConfig }) {
  return (
    <ActionForm action={saveCapacityAction}>
      <div className={`${styles.fields} ${styles.fields3}`}>
        <div className="field">
          <label className="field-label" htmlFor="slotMinutes">
            Slot length
          </label>
          <select id="slotMinutes" name="slotMinutes" className="input" defaultValue={String(cfg.slotMinutes)}>
            {[15, 20, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="onlineSharePct">
            Sold online, %
          </label>
          <input
            id="onlineSharePct"
            name="onlineSharePct"
            type="number"
            min={10}
            max={100}
            className="input"
            defaultValue={Math.round(cfg.onlineShare * 100)}
          />
          <span className="field-hint">The rest of each slot stays free for walk-ins.</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="horizonDays">
            Bookable this many days ahead
          </label>
          <input id="horizonDays" name="horizonDays" type="number" min={7} max={400} className="input" defaultValue={cfg.horizonDays} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cutoffMinutes">
            Same-day cut-off, minutes before a slot
          </label>
          <input id="cutoffMinutes" name="cutoffMinutes" type="number" min={0} max={600} className="input" defaultValue={cfg.cutoffMinutes} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="holdMinutes">
            Hold places while paying, minutes
          </label>
          <input id="holdMinutes" name="holdMinutes" type="number" min={5} max={120} className="input" defaultValue={cfg.holdMinutes} />
        </div>
      </div>
      <fieldset className={`${styles.fields} ${styles.fields3}`} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label" style={{ marginBottom: 8 }}>
          Places per slot, before the online share
        </legend>
        {(Object.keys(resourceLabels) as (keyof CapacityConfig['perSlot'])[]).map((r) => (
          <div className="field" key={r}>
            <label className="field-label" htmlFor={`perSlot_${r}`} style={{ fontWeight: 500 }}>
              {resourceLabels[r]}
            </label>
            <input id={`perSlot_${r}`} name={`perSlot_${r}`} type="number" min={0} max={200} className="input" defaultValue={cfg.perSlot[r]} />
          </div>
        ))}
      </fieldset>
      <p className={`${styles.small} ${styles.muted}`}>
        A straightjacket jump uses two bridge places, because preparation takes longer. Confirm these numbers with the jump masters.
      </p>
      <div>
        <SubmitButton>Save capacity</SubmitButton>
      </div>
    </ActionForm>
  );
}

export type PriceRow = {
  id: string;
  name: string;
  basePrice: number;
  price: number;
  group: { min: number; base: number; price: number } | null;
  disabled: boolean;
};

export function PricesForm({ rows }: { rows: PriceRow[] }) {
  return (
    <ActionForm action={savePricesAction}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Adventure</th>
              <th>Price (R)</th>
              <th>Group price (R)</th>
              <th>Online</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  {r.price !== r.basePrice && <span className={`${styles.small} ${styles.muted}`}> · list R{r.basePrice}</span>}
                </td>
                <td style={{ minWidth: 110 }}>
                  <input
                    aria-label={`${r.name} price`}
                    name={`price_${r.id}`}
                    type="number"
                    min={1}
                    max={20000}
                    className={`input ${styles.inputSm}`}
                    defaultValue={r.price}
                  />
                </td>
                <td style={{ minWidth: 130 }}>
                  {r.group ? (
                    <>
                      <input
                        aria-label={`${r.name} group price`}
                        name={`group_${r.id}`}
                        type="number"
                        min={1}
                        max={20000}
                        className={`input ${styles.inputSm}`}
                        defaultValue={r.group.price}
                      />
                      <span className="field-hint">From {r.group.min} people</span>
                    </>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td>
                  <label className="check">
                    <input type="checkbox" name={`off_${r.id}`} defaultChecked={r.disabled} />
                    <span className={styles.small}>Pause</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`${styles.small} ${styles.muted}`}>
        Paused adventures disappear from the booking flow and the homepage. Package prices follow from these, with the package saving taken off.
      </p>
      <div>
        <SubmitButton className="btn btn--primary">Save prices</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function HoursOverrideForm({ min }: { min: string }) {
  return (
    <ActionForm action={addHoursOverrideAction}>
      <div className={styles.toolbar}>
        <div className="field" style={{ flex: '0 1 180px' }}>
          <label className="field-label" htmlFor="ho-date">
            Date
          </label>
          <input id="ho-date" name="date" type="date" min={min} className="input" required />
        </div>
        <div className="field" style={{ flex: '0 1 150px' }}>
          <label className="field-label" htmlFor="ho-opens">
            Opens at
          </label>
          <input id="ho-opens" name="opensAt" type="time" step={1800} className="input" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ho-note">
            Note <span className={styles.muted}>(optional)</span>
          </label>
          <input id="ho-note" name="note" className="input" maxLength={120} placeholder="e.g. Public holiday" />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="closed" />
        <span>Closed all day</span>
      </label>
      <div>
        <SubmitButton>Add</SubmitButton>
      </div>
    </ActionForm>
  );
}
