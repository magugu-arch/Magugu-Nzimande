'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import type { FormState } from '@/app/actions';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { CheckIcon } from '../ui/icons';
import { ErrorSummary } from './Field';

/**
 * Shared behaviour for every form: one `form_start` event on first input,
 * a `lead_success` event and a confirmation that takes focus on success,
 * and the error summary on failure.
 */
export function useFormAnalytics(form: string, state: FormState) {
  const started = useRef(false);
  const reported = useRef<FormState | null>(null);

  useEffect(() => {
    if (state.status === 'success' && reported.current !== state) {
      reported.current = state;
      track(form === 'newsletter' ? 'newsletter_signup' : 'lead_success', { form });
    }
  }, [form, state]);

  return {
    onFocusCapture: () => {
      if (started.current) return;
      started.current = true;
      track('form_start', { form });
    },
  };
}

export function SuccessPanel({
  title,
  message,
  preview,
  tone = 'dark',
  children,
}: {
  title: string;
  message: string;
  preview: boolean;
  tone?: 'dark' | 'light';
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className={cn(
        'rounded-[1.5rem] p-7 outline-none md:p-9',
        tone === 'dark' ? 'bg-charcoal ring-1 ring-gold/30' : 'bg-white ring-1 ring-ink/10',
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-gold text-ink">
        <CheckIcon size={24} />
      </span>
      <h3 className="mt-5 font-display text-[1.875rem] leading-tight font-semibold">{title}</h3>
      <p className={cn('mt-3 max-w-xl', tone === 'dark' ? 'text-ivory/80' : 'text-slate')}>
        {message}
      </p>
      {preview ? (
        <p
          className={cn(
            'mt-4 rounded-xl px-4 py-3 text-[0.875rem]',
            tone === 'dark' ? 'bg-ink/60 text-gold-bright' : 'bg-stone text-ink',
          )}
        >
          Preview mode: the details passed validation and were logged on the server. Nothing was
          sent, because no delivery destination is connected yet.
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function FormErrors({
  state,
  labels,
  tone,
}: {
  state: FormState;
  labels: Record<string, string>;
  tone?: 'dark' | 'light';
}) {
  if (state.status !== 'error') return null;
  return <ErrorSummary message={state.message} errors={state.errors} labels={labels} tone={tone} />;
}

/** Field error, value and checked-state lookups for the current state. */
export function formHelpers(state: FormState) {
  const errors = state.status === 'error' ? state.errors : {};
  const values = state.status === 'error' ? state.values : {};
  return {
    error: (name: string) => errors[name],
    value: (name: string) => {
      const v = values[name];
      return typeof v === 'string' ? v : undefined;
    },
    checked: (name: string, value = 'on') => {
      const v = values[name];
      return Array.isArray(v) ? v.includes(value) : v === value;
    },
  };
}
