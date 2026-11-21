'use client';

import { CircleAlert } from 'lucide-react';
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';
import styles from './forms.module.css';

interface FieldChrome {
  label: ReactNode;
  /** Shown under the label. Never rely on placeholder text alone. */
  hint?: ReactNode;
  error?: string | null;
  /** Marks the field "(optional)". Required fields are the default and are not starred. */
  optional?: boolean;
}

function describedBy(hintId: string | undefined, errorId: string | undefined) {
  return [hintId, errorId].filter(Boolean).join(' ') || undefined;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional ? <span className={styles.optional}>(optional)</span> : null}
      </label>
      {hint ? (
        <span className={styles.hint} id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className={styles.error} id={`${id}-error`}>
          <CircleAlert aria-hidden="true" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

export type TextInputProps = FieldChrome & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextInput({ label, hint, error, optional, className, ...rest }: TextInputProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        className={cx(styles.control, className)}
        aria-describedby={describedBy(
          hint ? `${id}-hint` : undefined,
          error ? `${id}-error` : undefined,
        )}
        aria-invalid={error ? true : undefined}
        required={!optional && rest.required}
        {...rest}
      />
    </FieldShell>
  );
}

export type TextareaProps = FieldChrome & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function Textarea({ label, hint, error, optional, className, ...rest }: TextareaProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        className={cx(styles.control, className)}
        aria-describedby={describedBy(
          hint ? `${id}-hint` : undefined,
          error ? `${id}-error` : undefined,
        )}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export type SelectProps = FieldChrome &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
    options: Array<{ value: string; label: string }>;
    /** Text for the empty first option, e.g. "Choose one". */
    placeholder?: string;
  };

export function Select({
  label,
  hint,
  error,
  optional,
  options,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        className={cx(styles.control, className)}
        aria-describedby={describedBy(
          hint ? `${id}-hint` : undefined,
          error ? `${id}-error` : undefined,
        )}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Draws the option as a bordered card. */
  card?: boolean;
}

export function Checkbox({ label, hint, error, card = false, className, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={cx(styles.choice, card && styles.choiceCard, className)} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          aria-describedby={describedBy(
            hint ? `${id}-hint` : undefined,
            error ? `${id}-error` : undefined,
          )}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        <span className={styles.choiceText}>
          <span>{label}</span>
          {hint ? (
            <span className={styles.choiceHint} id={`${id}-hint`}>
              {hint}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <span className={styles.error} id={`${id}-error`}>
          <CircleAlert aria-hidden="true" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

export interface RadioGroupProps {
  legend: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: ReactNode; hint?: ReactNode }>;
}

export function RadioGroup({
  legend,
  hint,
  error,
  optional,
  name,
  value,
  onChange,
  options,
}: RadioGroupProps) {
  const id = useId();
  return (
    <fieldset
      className={styles.fieldset}
      aria-describedby={describedBy(
        hint ? `${id}-hint` : undefined,
        error ? `${id}-error` : undefined,
      )}
    >
      <legend>
        {legend}
        {optional ? <span className={styles.optional}>(optional)</span> : null}
      </legend>
      {hint ? (
        <span className={styles.hint} id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      <div className={styles.choices}>
        {options.map((option) => (
          <label className={cx(styles.choice, styles.choiceCard)} key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.choiceText}>
              <span>{option.label}</span>
              {option.hint ? <span className={styles.choiceHint}>{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <span className={styles.error} id={`${id}-error`} style={{ marginTop: '0.5rem' }}>
          <CircleAlert aria-hidden="true" />
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

export interface SwitchProps {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Announced and shown beside the switch. Defaults to "On" / "Off". */
  stateLabels?: { on: string; off: string };
}

/** An on/off setting that takes effect immediately. State is shown in words, not colour alone. */
export function Switch({ label, hint, checked, onChange, disabled, stateLabels }: SwitchProps) {
  const id = useId();
  const labels = stateLabels ?? { on: 'On', off: 'Off' };
  return (
    <div className={styles.switchRow}>
      <div className={styles.choiceText}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {hint ? (
          <span id={`${id}-hint`} className={styles.choiceHint}>
            {hint}
          </span>
        ) : null}
      </div>
      <div className={styles.switchControl}>
        <span className={styles.switchState} aria-hidden="true">
          {checked ? labels.on : labels.off}
        </span>
        <button
          type="button"
          role="switch"
          className={styles.switch}
          aria-checked={checked}
          aria-labelledby={`${id}-label`}
          aria-describedby={hint ? `${id}-hint` : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
        />
      </div>
    </div>
  );
}

export interface SegmentedControlProps {
  /** Accessible name for the group, e.g. "View". */
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; icon?: ReactNode }>;
}

/** A small either/or switcher (for example Map / List), built on radio buttons. */
export function SegmentedControl({ label, name, value, onChange, options }: SegmentedControlProps) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label className={styles.segment} key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            {option.icon}
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
