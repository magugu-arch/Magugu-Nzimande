'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'navy';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  labelledBy,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  labelledBy?: string;
}) {
  const id = useId();
  const headingId = labelledBy ?? id;
  return (
    <section className="card" aria-labelledby={title ? headingId : undefined}>
      {title ? (
        <div className="card-head">
          <div className="stack-sm">
            <h2 id={headingId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({
  tone = 'neutral',
  children,
  plain,
}: {
  tone?: Tone;
  children: ReactNode;
  plain?: boolean;
}) {
  return <span className={`badge tone-${tone}${plain ? ' plain' : ''}`}>{children}</span>;
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: Exclude<Tone, 'neutral' | 'navy'>;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`notice tone-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title ? <strong>{title}</strong> : null}
      {children ? <div>{children}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** A labelled horizontal meter. The text carries the value; the bar repeats it. */
export function Meter({
  label,
  value,
  max,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  detail: string;
}) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="meter">
      <div className="spread small">
        <span className="strong">{label}</span>
        <span className="muted">{detail}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

/** Tabs that filter a list: plain toggle buttons, so arrow keys aren't required. */
export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="tab"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.count !== undefined ? ` (${o.count})` : ''}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
  disabled,
  describedBy,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

/**
 * Native modal dialog: the browser traps focus, closes on Escape and returns
 * focus to the opener.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose}>
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="dialog-body">{children}</div>
      {footer ? <div className="dialog-foot">{footer}</div> : null}
    </dialog>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="error-text" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** aria-describedby for a control inside <Field>: its hint and its error. */
export const describedBy = (id: string, opts: { hint?: boolean; error?: unknown }) =>
  [opts.hint ? `${id}-hint` : null, opts.error ? `${id}-error` : null].filter(Boolean).join(' ') ||
  undefined;

/** Explains why a control is missing, instead of silently hiding it. */
export function ReadOnlyNote({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}

/**
 * A table that scrolls sideways on narrow screens. When it overflows it
 * becomes a focusable, named region so keyboard users can scroll it too.
 */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="table-wrap"
      tabIndex={scrolls ? 0 : undefined}
      role={scrolls ? 'region' : undefined}
      aria-label={scrolls ? `${label} (scrolls sideways)` : undefined}
    >
      {children}
    </div>
  );
}
