import type { ComponentProps, ReactNode } from 'react';
import styles from './fields.module.css';

type Base = { name: string; label: string; hint?: ReactNode; error?: string; optional?: boolean };

function describedBy(name: string, hint?: ReactNode, error?: string) {
  return [hint ? `${name}-hint` : '', error ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined;
}

function Meta({ name, hint, error }: { name: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint && (
        <span id={`${name}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${name}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </>
  );
}

function Label({ name, label, optional }: { name: string; label: string; optional?: boolean }) {
  return (
    <label htmlFor={name} className={styles.label}>
      {label}
      {optional && <span className={styles.optional}> (optional)</span>}
    </label>
  );
}

export function TextField({ name, label, hint, error, optional, className, ...input }: Base & Omit<ComponentProps<'input'>, 'name'>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label name={name} label={label} optional={optional} />
      <input
        id={name}
        name={name}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        required={!optional}
        {...input}
      />
      <Meta name={name} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({ name, label, hint, error, optional, className, ...input }: Base & Omit<ComponentProps<'textarea'>, 'name'>) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label name={name} label={label} optional={optional} />
      <textarea
        id={name}
        name={name}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        required={!optional}
        rows={4}
        {...input}
      />
      <Meta name={name} hint={hint} error={error} />
    </div>
  );
}

export function Select({
  name,
  label,
  hint,
  error,
  optional,
  options,
  placeholder = 'Choose…',
  className,
  ...input
}: Base & Omit<ComponentProps<'select'>, 'name'> & { options: readonly { key: string; label: string }[]; placeholder?: string }) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <Label name={name} label={label} optional={optional} />
      <select
        id={name}
        name={name}
        className={`${styles.input} ${styles.select}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        required={!optional}
        {...input}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <Meta name={name} hint={hint} error={error} />
    </div>
  );
}

export function Checkbox({ name, label, hint, error, className, ...input }: Omit<Base, 'optional'> & Omit<ComponentProps<'input'>, 'name' | 'type'> & { label: string }) {
  return (
    <div className={[styles.check, className].filter(Boolean).join(' ')}>
      <input
        id={name}
        name={name}
        type="checkbox"
        className={styles.box}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        {...input}
      />
      <label htmlFor={name}>{label}</label>
      <Meta name={name} hint={hint} error={error} />
    </div>
  );
}

/** Large tappable radio options — event type, format, collaboration type. */
export function ChoiceGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  options: readonly { key: string; label: string; detail?: string }[];
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
}) {
  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? `${name}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.choices}>
        {options.map((o) => (
          <label key={o.key} className={styles.choice}>
            <input
              type="radio"
              name={name}
              value={o.key}
              checked={value === undefined ? undefined : value === o.key}
              onChange={() => onChange?.(o.key)}
              required
            />
            <span>
              <span className={styles.choiceLabel}>{o.label}</span>
              {o.detail && <span className={styles.choiceDetail}>{o.detail}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <span id={`${name}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </fieldset>
  );
}

export function FormAlert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export const fieldStyles = styles;
