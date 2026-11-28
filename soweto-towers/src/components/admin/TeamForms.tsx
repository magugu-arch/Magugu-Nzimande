'use client';

import { useRef } from 'react';
import { addStaffAction, changePasswordAction, disableTotpAction, enableTotpAction } from '@/app/admin/actions';
import { ActionForm, SubmitButton } from './forms';
import styles from './admin.module.css';

// No 0/O, 1/l/I: easy to read out over the phone.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function suggestPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join('')).join('-');
}

export function AddStaffForm() {
  const password = useRef<HTMLInputElement>(null);
  return (
    <ActionForm action={addStaffAction}>
      <div className={`${styles.fields} ${styles.fields2}`}>
        <div className="field">
          <label className="field-label" htmlFor="st-name">
            Name
          </label>
          <input id="st-name" name="name" className="input" autoComplete="off" maxLength={80} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="st-email">
            Work email
          </label>
          <input id="st-email" name="email" type="email" className="input" autoComplete="off" maxLength={120} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="st-role">
            Role
          </label>
          <select id="st-role" name="role" className="input" defaultValue="crew" aria-describedby="st-role-hint">
            <option value="crew">Crew</option>
            <option value="admin">Admin</option>
          </select>
          <span className="field-hint" id="st-role-hint">
            Crew run the day: bookings, scanning, inbox, events and vouchers. Admins can also change prices, slots, hours and the team.
          </span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="st-password">
            Temporary password
          </label>
          <div className={styles.inputRow}>
            <input
              ref={password}
              id="st-password"
              name="password"
              className={`input ${styles.mono}`}
              autoComplete="off"
              spellCheck={false}
              minLength={10}
              maxLength={200}
              required
            />
            <button
              type="button"
              className="btn btn--light btn--sm"
              onClick={() => {
                if (password.current) password.current.value = suggestPassword();
              }}
            >
              Suggest
            </button>
          </div>
          <span className="field-hint">At least 10 characters. Tell them in person or by phone, then ask them to change it under Your sign-in.</span>
        </div>
      </div>
      <div>
        <SubmitButton pendingLabel="Adding…">Add to the team</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EnableTotpForm({ secret }: { secret: string }) {
  return (
    <ActionForm action={enableTotpAction}>
      <input type="hidden" name="secret" value={secret} />
      <div className="field" style={{ maxWidth: 260 }}>
        <label className="field-label" htmlFor="totp-code">
          6-digit code from the app
        </label>
        <input
          id="totp-code"
          name="code"
          className={`input ${styles.mono}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Checking…">Turn on two-step sign-in</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DisableTotpForm() {
  return (
    <ActionForm action={disableTotpAction}>
      <div className={styles.toolbar}>
        <div className="field" style={{ flex: '0 1 220px' }}>
          <label className="field-label" htmlFor="totp-off">
            Current code
          </label>
          <input
            id="totp-off"
            name="code"
            className={`input ${styles.mono}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </div>
        <div style={{ flex: '0 0 auto', alignSelf: 'end' }}>
          <SubmitButton className="btn btn--light" pendingLabel="Checking…">
            Turn off
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

export function ChangePasswordForm({ email }: { email: string }) {
  return (
    <ActionForm action={changePasswordAction}>
      {/* Lets password managers file the new password under the right account. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className={`${styles.fields} ${styles.fields3}`}>
        <div className="field">
          <label className="field-label" htmlFor="pw-current">
            Current password
          </label>
          <input id="pw-current" name="current" type="password" className="input" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pw-new">
            New password
          </label>
          <input id="pw-new" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pw-repeat">
            New password again
          </label>
          <input id="pw-repeat" name="repeat" type="password" className="input" autoComplete="new-password" minLength={10} required />
        </div>
      </div>
      <div>
        <SubmitButton className="btn btn--light">Change password</SubmitButton>
      </div>
    </ActionForm>
  );
}
