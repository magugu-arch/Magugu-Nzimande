'use client';

import { useActionState, useId, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { requestTable, type FormState } from '@/app/actions';
import { Check } from '@/components/ui/icons';
import { ymdInSast } from '@/lib/time';
import { FormGuard } from './FormGuard';
import styles from './forms.module.css';

const noSubscribe = () => () => {};
const todaySast = () => ymdInSast(new Date());

/** Table request for Chaf-Pozi. The crew confirms on WhatsApp; nothing is charged here. */
export function TableRequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestTable, null);
  // React resets a form after each submit; a failed one hands back what was typed.
  const kept: Record<string, string | undefined> = state?.ok ? {} : (state?.values ?? {});
  const id = useId();
  // Today's date is read on the client only, so the page itself stays prerendered.
  const minDate = useSyncExternalStore(noSubscribe, todaySast, () => undefined);
  const err = (name: string) => state?.errors?.[name];
  const describedBy = (name: string) => (err(name) ? `${id}-${name}-error` : undefined);

  if (state?.ok) {
    return (
      <div className={styles.success} role="status">
        <Check />
        <p>Request sent</p>
        <p className="muted">{state.message}</p>
      </div>
    );
  }

  const field = (name: string, label: string, input: ReactNode) => (
    <div className="field">
      <label className="field-label" htmlFor={`${id}-${name}`}>
        {label}
      </label>
      {input}
      {err(name) ? (
        <span className="field-error" id={`${id}-${name}-error`}>
          {err(name)}
        </span>
      ) : null}
    </div>
  );

  return (
    <form action={action} className={styles.form} noValidate>
      {state && !state.ok ? (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      ) : null}
      <div className={styles.row}>
        {field(
          'name',
          'Name',
          <input
            id={`${id}-name`}
            name="name"
            defaultValue={kept.name}
            className="input"
            autoComplete="name"
            required
            aria-invalid={!!err('name')}
            aria-describedby={describedBy('name')}
          />,
        )}
        {field(
          'phone',
          'Mobile (we confirm on WhatsApp)',
          <input
            id={`${id}-phone`}
            name="phone"
            defaultValue={kept.phone}
            type="tel"
            className="input"
            autoComplete="tel"
            inputMode="tel"
            required
            aria-invalid={!!err('phone')}
            aria-describedby={describedBy('phone')}
          />,
        )}
      </div>
      <div className={`${styles.row} ${styles.row3}`}>
        {field(
          'date',
          'Date',
          <input
            id={`${id}-date`}
            name="date"
            defaultValue={kept.date}
            type="date"
            min={minDate}
            className="input"
            required
            aria-invalid={!!err('date')}
            aria-describedby={describedBy('date')}
          />,
        )}
        {field(
          'time',
          'Time',
          <input
            id={`${id}-time`}
            name="time"
            defaultValue={kept.time}
            type="time"
            step={900}
            className="input"
            required
            aria-invalid={!!err('time')}
            aria-describedby={describedBy('time')}
          />,
        )}
        {field(
          'partySize',
          'People',
          <input
            id={`${id}-partySize`}
            name="partySize"
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            defaultValue={kept.partySize ?? 2}
            className="input"
            required
            aria-invalid={!!err('partySize')}
            aria-describedby={describedBy('partySize')}
          />,
        )}
      </div>
      {field(
        'email',
        'Email (optional)',
        <input
          id={`${id}-email`}
          name="email"
          defaultValue={kept.email}
          type="email"
          className="input"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!err('email')}
          aria-describedby={describedBy('email')}
        />,
      )}
      {field(
        'notes',
        'Anything we should know? (optional)',
        <textarea
          id={`${id}-notes`}
          name="notes"
          defaultValue={kept.notes}
          rows={3}
          className="input"
          placeholder="Celebrating something? Jumping first? Tell us the slot and we’ll plan around it."
        />,
      )}
      <FormGuard />
      <div className={styles.actions}>
        <button className="btn btn--primary" disabled={pending}>
          {pending ? 'Sending…' : 'Request a table'}
        </button>
        <span className={styles.note}>A request, not a booking: we confirm on WhatsApp.</span>
      </div>
    </form>
  );
}
