import { AlertCircle, Check } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/**
 * Form controls: an underline, not a box — the page stays a page. Every
 * control has a real <label>, errors are announced and tied to the input
 * with aria-describedby, and targets are at least 44px tall.
 */

type Tone = 'dark' | 'light';

const control = (tone: Tone, invalid: boolean) =>
  `block w-full min-h-12 bg-transparent border-0 border-b px-0 py-3 text-base outline-none transition-colors placeholder:opacity-40 focus-visible:outline-none ${
    tone === 'dark'
      ? `text-white ${invalid ? 'border-white' : 'border-white/30 focus:border-white'}`
      : `text-black ${invalid ? 'border-black' : 'border-black/30 focus:border-black'}`
  }`;

function Shell({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="ui-label flex items-baseline justify-between gap-4 opacity-80">
        <span>{label}</span>
        {optional && <span className="normal-case tracking-normal opacity-60">Optional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 font-sans text-xs opacity-60">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 flex items-center gap-2 font-sans text-sm">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

type FieldProps = { label: string; hint?: string; error?: string; optional?: boolean; tone?: Tone };

export function TextField({ label, hint, error, optional, tone = 'dark', id, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={fid}
        className={control(tone, !!error)}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...rest}
      />
    </Shell>
  );
}

export function TextArea({ label, hint, error, optional, tone = 'dark', id, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={fid}
        rows={4}
        className={`${control(tone, !!error)} resize-y`}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({ label, hint, error, optional, tone = 'dark', id, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Shell id={fid} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={fid}
        className={`${control(tone, !!error)} appearance-none ${tone === 'dark' ? '[&>option]:bg-black' : ''}`}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
    </Shell>
  );
}

export function Checkbox({ label, error, tone = 'dark', id, checked, ...rest }: { label: ReactNode; error?: string; tone?: Tone } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div>
      <label htmlFor={fid} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 font-sans text-sm leading-relaxed">
        <span className="relative mt-0.5 inline-flex size-5 shrink-0">
          <input
            id={fid}
            type="checkbox"
            checked={checked}
            className={`peer size-5 cursor-pointer appearance-none border ${tone === 'dark' ? 'border-white/60 checked:bg-white' : 'border-black/60 checked:bg-black'}`}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${fid}-error` : undefined}
            {...rest}
          />
          <Check aria-hidden className={`pointer-events-none absolute inset-0.5 size-4 opacity-0 peer-checked:opacity-100 ${tone === 'dark' ? 'text-black' : 'text-white'}`} />
        </span>
        <span className="opacity-80">{label}</span>
      </label>
      {error && (
        <p id={`${fid}-error`} role="alert" className="mt-1 flex items-center gap-2 font-sans text-sm">
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Hidden from people, tempting to bots. See server/security.ts. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Company
        <input tabIndex={-1} autoComplete="off" name="company" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function Alert({ tone = 'dark', kind, children }: { tone?: Tone; kind: 'error' | 'success'; children: ReactNode }) {
  const Icon = kind === 'error' ? AlertCircle : Check;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 border px-4 py-3 font-sans text-sm leading-relaxed ${tone === 'dark' ? 'border-white/30' : 'border-black/30'}`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
