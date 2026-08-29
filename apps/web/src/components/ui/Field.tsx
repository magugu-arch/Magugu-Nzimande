'use client';

import { useId, type ComponentPropsWithoutRef } from 'react';

/**
 * A labelled input that carries its own error wiring. The error is tied to the
 * field with aria-describedby and announced through role="alert", so a mistake
 * is heard as well as seen.
 */
export function Field({
  label,
  error,
  hint,
  className,
  ...props
}: ComponentPropsWithoutRef<'input'> & {
  label: string;
  error?: string | null;
  hint?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          'mt-1.5 h-12 w-full rounded-sm border bg-white px-3.5 text-sm',
          error ? 'border-red' : 'border-line focus:border-line-strong',
        ].join(' ')}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-red">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  className,
  ...props
}: ComponentPropsWithoutRef<'textarea'> & { label: string; hint?: string }) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className="mt-1.5 w-full rounded-sm border border-line bg-white px-3.5 py-3 text-sm focus:border-line-strong"
        {...props}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
