'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/app/admin/actions';
import styles from './admin.module.css';

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** A form bound to a Server Action, with an inline result message. */
export function ActionForm({
  action,
  children,
  className,
  renderDetail,
  id,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  renderDetail?: (detail: string) => ReactNode;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state && !state.ok) ref.current?.focus();
  }, [state]);
  return (
    <form action={formAction} className={className ?? styles.form} id={id} noValidate>
      {children}
      {state && (
        <p ref={ref} tabIndex={-1} role={state.ok ? 'status' : 'alert'} className={`${styles.message} ${state.ok ? styles.messageOk : styles.messageErr}`}>
          {state.message}
          {state.detail && <span className={styles.messageDetail}>{renderDetail ? renderDetail(state.detail) : state.detail}</span>}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel = 'Saving…',
  className = 'btn btn--dark',
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-disabled={pending} name={name} value={value}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Small button forms for list actions (mark replied, void, remove). */
export function PlainActionButton({
  action,
  fields,
  children,
  className = 'btn btn--light btn--sm',
  confirmText,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      className={styles.inline}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton className={className} pendingLabel="…">
        {children}
      </SubmitButton>
    </form>
  );
}
