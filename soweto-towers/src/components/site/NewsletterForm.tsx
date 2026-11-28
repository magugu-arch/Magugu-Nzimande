'use client';

import { useActionState } from 'react';
import { FormGuard } from '@/components/forms/FormGuard';
import { subscribe, type FormState } from '@/app/actions';
import styles from './NewsletterForm.module.css';

export function NewsletterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribe, null);

  if (state?.ok) {
    return (
      <p className={styles.done} role="status">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className={styles.form} noValidate>
      <label htmlFor="nl-address" className={styles.label}>
        Tower status, new dates and offers. WhatsApp or email.
      </label>
      <div className={styles.row}>
        <input
          id="nl-address"
          name="address"
          className={styles.input}
          placeholder="082 123 4567 or you@email.com"
          autoComplete="email"
          inputMode="email"
          defaultValue={state?.values?.address ?? ''}
          aria-invalid={!!state?.errors?.address}
          aria-describedby={state?.errors?.address ? 'nl-error' : undefined}
        />
        <button className="btn btn--primary btn--sm" disabled={pending}>
          {pending ? 'Joining…' : 'Join'}
        </button>
      </div>
      <label className={`check ${styles.consent}`}>
        <input type="checkbox" name="consent" defaultChecked={state?.values?.consent === 'on'} />
        <span>Yes, Soweto Towers may message me. I can opt out any time.</span>
      </label>
      <FormGuard />
      <input type="hidden" name="source" value="footer" />
      {state && !state.ok && (
        <p id="nl-error" className={styles.error} role="alert">
          {state.errors?.address ?? state.errors?.consent ?? state.message}
        </p>
      )}
    </form>
  );
}
