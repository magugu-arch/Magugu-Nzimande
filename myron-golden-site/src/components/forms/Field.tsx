'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { AlertIcon } from '../ui/icons';

/**
 * Accessible form parts. Every control has a real label (never a
 * placeholder standing in for one), hints and errors are tied to it with
 * aria-describedby, and invalid fields say so with aria-invalid.
 */

type Tone = 'dark' | 'light';

const controlClasses = (tone: Tone, invalid: boolean) =>
  cn(
    'block w-full rounded-xl px-4 text-[1rem] transition-[border-color,box-shadow,background-color] duration-200',
    'focus:outline-none focus-visible:outline-none',
    tone === 'dark'
      ? 'border border-ivory/15 bg-ink/60 text-ivory placeholder:text-ivory/35 hover:border-ivory/30 focus:border-gold focus:shadow-[0_0_0_3px_rgb(203_164_93/0.25)]'
      : 'border border-ink/15 bg-white text-ink placeholder:text-slate/70 hover:border-ink/30 focus:border-gold-deep focus:shadow-[0_0_0_3px_rgb(138_106_46/0.2)]',
    invalid && (tone === 'dark' ? 'border-[#e8a598]' : 'border-[#b4412f]'),
  );

const errorText = (tone: Tone) => (tone === 'dark' ? 'text-[#f0b4a8]' : 'text-[#9e3524]');

interface BaseProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  tone?: Tone;
  className?: string;
}

function Wrapper({
  name,
  label,
  hint,
  error,
  required,
  tone = 'dark',
  className,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-2 block text-[0.9rem] font-semibold">
        {label}
        {required ? null : (
          <span
            className={cn('ml-1.5 font-normal', tone === 'dark' ? 'text-ivory/55' : 'text-slate')}
          >
            (optional)
          </span>
        )}
      </label>
      {hint ? (
        <p
          id={`${name}-hint`}
          className={cn(
            '-mt-1 mb-2 text-[0.85rem]',
            tone === 'dark' ? 'text-ivory/60' : 'text-slate',
          )}
        >
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={`${name}-error`}
          className={cn('mt-2 flex items-start gap-1.5 text-[0.875rem]', errorText(tone))}
        >
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (name: string, hint?: string, error?: string) =>
  [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(' ') ||
  undefined;

export function TextField({
  type = 'text',
  defaultValue,
  autoComplete,
  inputMode,
  ...props
}: BaseProps & {
  type?: 'text' | 'email' | 'date' | 'tel';
  defaultValue?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric';
}) {
  const { name, hint, error, required, tone = 'dark' } = props;
  return (
    <Wrapper {...props}>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cn(
          controlClasses(tone, !!error),
          'h-12',
          tone === 'dark' && '[color-scheme:dark]',
        )}
      />
    </Wrapper>
  );
}

export function TextArea({
  defaultValue,
  rows = 5,
  ...props
}: BaseProps & { defaultValue?: string; rows?: number }) {
  const { name, hint, error, required, tone = 'dark' } = props;
  return (
    <Wrapper {...props}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cn(controlClasses(tone, !!error), 'min-h-28 resize-y py-3 leading-relaxed')}
      />
    </Wrapper>
  );
}

export function SelectField({
  options,
  defaultValue,
  placeholder = 'Choose one',
  ...props
}: BaseProps & {
  options: readonly string[] | readonly { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const { name, hint, error, required, tone = 'dark' } = props;
  const normalised = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <Wrapper {...props}>
      <div className="relative">
        <select
          id={name}
          name={name}
          required={required}
          defaultValue={defaultValue ?? ''}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, hint, error)}
          className={cn(controlClasses(tone, !!error), 'h-12 appearance-none pr-10')}
        >
          <option value="" disabled={required}>
            {placeholder}
          </option>
          {normalised.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 opacity-60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </Wrapper>
  );
}

export function CheckboxField({
  name,
  label,
  error,
  defaultChecked,
  tone = 'dark',
  value = 'on',
  id,
}: {
  name: string;
  label: ReactNode;
  error?: string;
  defaultChecked?: boolean;
  tone?: Tone;
  value?: string;
  id?: string;
}) {
  const inputId = id ?? name;
  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-start gap-3 text-[0.925rem] leading-snug"
      >
        <input
          id={inputId}
          name={name}
          type="checkbox"
          value={value}
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'mt-0.5 size-5 shrink-0 cursor-pointer rounded',
            tone === 'dark' ? 'accent-gold' : 'accent-gold-deep',
          )}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p
          id={`${inputId}-error`}
          className={cn('mt-2 flex items-start gap-1.5 text-[0.875rem]', errorText(tone))}
        >
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Spam trap: invisible to people and assistive tech, tempting to bots. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="website">Leave this field empty</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/**
 * Lists every problem at the top of the form and takes focus, so keyboard and
 * screen-reader users learn about errors immediately. Each item jumps to its
 * field.
 */
export function ErrorSummary({
  message,
  errors,
  labels,
  tone = 'dark',
}: {
  message: string;
  errors: Record<string, string>;
  labels: Record<string, string>;
  tone?: Tone;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [message, errors]);
  const entries = Object.entries(errors).filter(([k]) => k !== 'form');
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className={cn(
        'rounded-2xl p-5 outline-none',
        tone === 'dark'
          ? 'bg-[#3a1d18] ring-1 ring-[#e8a598]/40'
          : 'bg-[#fbeae6] ring-1 ring-[#b4412f]/30',
      )}
    >
      <p className={cn('flex items-center gap-2 font-semibold', errorText(tone))}>
        <AlertIcon size={18} />
        {message}
      </p>
      {entries.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-6 text-[0.9rem]">
          {entries.map(([field, text]) => (
            <li key={field}>
              <a href={`#${field}`} className="underline">
                {labels[field] ?? field}: {text}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
