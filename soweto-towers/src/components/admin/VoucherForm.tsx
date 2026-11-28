'use client';

import { issueVoucherAction } from '@/app/admin/actions';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

export function VoucherForm({ presets }: { presets: { label: string; value: number }[] }) {
  return (
    <ActionForm
      action={issueVoucherAction}
      renderDetail={(path) => (
        <>
          Share this link with the recipient:{' '}
          <a href={path} target="_blank" rel="noopener">
            {typeof window !== 'undefined' ? `${window.location.origin}${path}` : path}
          </a>
        </>
      )}
    >
      <div className={`${styles.fields} ${styles.fields2}`}>
        <div className="field">
          <label className="field-label" htmlFor="v-label">
            What it’s for
          </label>
          <input id="v-label" name="label" className="input" list="voucher-presets" maxLength={80} placeholder="Complimentary bungee jump" required />
          <datalist id="voucher-presets">
            {presets.map((p) => (
              <option key={p.label} value={p.label} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="v-value">
            Value in rand
          </label>
          <input id="v-value" name="value" className="input" inputMode="numeric" placeholder="630" required />
          <span className="field-hint">Bungee R630 · Jump + Film R760 · Full Tower R1,090</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="v-name">
            Recipient
          </label>
          <input id="v-name" name="recipientName" className="input" maxLength={80} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="v-email">
            Recipient email <span className={styles.muted}>(optional)</span>
          </label>
          <input id="v-email" name="recipientEmail" type="email" className="input" maxLength={120} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="v-phone">
            Recipient mobile <span className={styles.muted}>(optional)</span>
          </label>
          <input id="v-phone" name="recipientPhone" className="input" inputMode="tel" maxLength={20} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="v-message">
            Message <span className={styles.muted}>(optional)</span>
          </label>
          <input id="v-message" name="message" className="input" maxLength={280} placeholder="Thanks for an amazing collab!" />
        </div>
      </div>
      <p className={`${styles.small} ${styles.muted}`}>
        Complimentary vouchers are valid for a year and work like gift vouchers at checkout. Use them for creators, prizes and service recovery; every one is
        logged.
      </p>
      <div>
        <SubmitButton className="btn btn--primary" pendingLabel="Issuing…">
          Issue voucher
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
