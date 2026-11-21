'use client';

import {
  Check,
  CircleAlert,
  CloudOff,
  FlaskConical,
  Hourglass,
  Inbox,
  Signpost,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { Button, IconButton } from './button';
import { cx } from './cx';
import styles from './feedback.module.css';

/* Skeleton --------------------------------------------------------- */

export function Skeleton({
  width = '100%',
  height = '1rem',
  radius,
}: {
  width?: string;
  height?: string;
  radius?: string;
}) {
  return (
    <span
      className={styles.skeleton}
      style={{ width, height, borderRadius: radius } as CSSProperties}
      aria-hidden="true"
    />
  );
}

/** A loading placeholder shaped like a short list of cards. Announced once, politely. */
export function LoadingState({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className={styles.skeletonStack} role="status" aria-live="polite">
      <span className="visually-hidden">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height="5.25rem" radius="14px" />
      ))}
    </div>
  );
}

/* State panels ----------------------------------------------------- */

interface StateProps {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  headingLevel?: 2 | 3;
}

function StatePanel({
  title,
  children,
  actions,
  icon,
  headingLevel = 2,
  className,
  role,
}: StateProps & { className?: string; role?: 'alert' | 'status' }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={cx(styles.state, className)} role={role}>
      <span className={styles.stateIcon} aria-hidden="true">
        {icon}
      </span>
      <Heading className={styles.stateTitle}>{title}</Heading>
      {children ? <div className={styles.stateBody}>{children}</div> : null}
      {actions ? <div className={styles.stateActions}>{actions}</div> : null}
    </div>
  );
}

/** Nothing here yet — always says what the person can do next. */
export function EmptyState({ icon = <Inbox />, ...props }: StateProps) {
  return <StatePanel icon={icon} {...props} />;
}

export interface ErrorStateProps {
  title?: ReactNode;
  /** A message that is safe to show the public (from `GatewayError.safeMessage`). */
  message: ReactNode;
  /** Trace reference the person can quote to support. Never a stack trace. */
  traceRef?: string;
  onRetry?: () => void;
  retrying?: boolean;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  traceRef,
  onRetry,
  retrying,
  actions,
  headingLevel,
}: ErrorStateProps) {
  return (
    <StatePanel
      className={styles.stateError}
      role="alert"
      icon={<CircleAlert />}
      title={title}
      headingLevel={headingLevel}
      actions={
        <>
          {onRetry ? (
            <Button onClick={onRetry} loading={retrying}>
              Try again
            </Button>
          ) : null}
          {actions}
        </>
      }
    >
      <p>{message}</p>
      {traceRef ? <p className={styles.trace}>Reference for support: {traceRef}</p> : null}
    </StatePanel>
  );
}

export function OfflineState({
  onRetry,
  retrying,
  children,
  headingLevel,
}: {
  onRetry?: () => void;
  retrying?: boolean;
  children?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  return (
    <StatePanel
      className={styles.stateOffline}
      role="status"
      icon={<CloudOff />}
      title="You are offline"
      headingLevel={headingLevel}
      actions={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        ) : null
      }
    >
      {children ?? (
        <p>
          Anything you have already saved stays on this device. We will pick up where you left off
          when you are back online.
        </p>
      )}
    </StatePanel>
  );
}

export interface UnavailableStateProps {
  title: ReactNode;
  /** Why it cannot be done here. */
  reason: ReactNode;
  /** What the person should do instead. */
  whatNext: ReactNode;
  /** Other channels or routes that work today. */
  alternatives?: ReactNode[];
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}

/** "No dead ends": explains why, what to do next, the alternatives and how to get help. */
export function UnavailableState({
  title,
  reason,
  whatNext,
  alternatives,
  actions,
  headingLevel,
}: UnavailableStateProps) {
  return (
    <StatePanel
      className={styles.stateUnavailable}
      icon={<Signpost />}
      title={title}
      headingLevel={headingLevel}
      actions={actions}
    >
      <p>{reason}</p>
      <p>
        <strong>What to do next:</strong> {whatNext}
      </p>
      {alternatives?.length ? (
        <ul className={styles.alternatives}>
          {alternatives.map((alternative, index) => (
            <li key={index}>{alternative}</li>
          ))}
        </ul>
      ) : null}
    </StatePanel>
  );
}

/* Sample / future labels ------------------------------------------- */

/**
 * Marks sample service content. The brief forbids inventing DHA requirements,
 * fees or timeframes, so anything of that kind carries this label.
 */
export function SampleNotice({ children }: { children?: ReactNode }) {
  return (
    <p className={styles.sample}>
      <FlaskConical aria-hidden="true" />
      <span>
        <strong>Sample content.</strong>{' '}
        {children ??
          'Requirements, fees and timeframes are placeholders until Home Affairs service owners supply and verify them.'}
      </span>
    </p>
  );
}

/** Marks a capability that is gated behind a feature flag and future approval. */
export function FutureNotice({ children }: { children?: ReactNode }) {
  return (
    <p className={styles.sample}>
      <Hourglass aria-hidden="true" />
      <span>
        <strong>Future capability.</strong>{' '}
        {children ?? 'Shown as a concept. Subject to legal, security and operational approval.'}
      </span>
    </p>
  );
}

/* Timeline --------------------------------------------------------- */

export interface TimelineItem {
  key: string;
  label: ReactNode;
  state: 'done' | 'current' | 'upcoming';
  /** e.g. a formatted timestamp. Only show times that come from real events. */
  meta?: ReactNode;
  detail?: ReactNode;
}

const STATE_WORD: Record<TimelineItem['state'], string> = {
  done: 'Completed',
  current: 'In progress now',
  upcoming: 'Not started',
};

export function Timeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <ol className={styles.timeline} aria-label={label}>
      {items.map((item) => (
        <li
          key={item.key}
          className={cx(
            styles.timelineItem,
            item.state === 'done' && styles.timelineDone,
            item.state === 'current' && styles.timelineCurrent,
            item.state === 'upcoming' && styles.timelineUpcoming,
          )}
          aria-current={item.state === 'current' ? 'step' : undefined}
        >
          <span className={styles.marker} aria-hidden="true">
            {item.state === 'done' ? <Check /> : null}
            {item.state === 'current' ? <span className={styles.currentDot} /> : null}
          </span>
          <div className={styles.timelineText}>
            <p className={styles.timelineLabel}>
              <span className="visually-hidden">{STATE_WORD[item.state]}: </span>
              {item.label}
            </p>
            {item.meta ? <p className={styles.timelineMeta}>{item.meta}</p> : null}
            {item.detail ? <div className={styles.timelineDetail}>{item.detail}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* Stepper ---------------------------------------------------------- */

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const safeCurrent = Math.min(Math.max(current, 0), Math.max(steps.length - 1, 0));
  return (
    <div className={styles.stepper}>
      <div className={styles.stepperTop}>
        <span className={styles.stepperTitle}>{steps[safeCurrent]}</span>
        <span className={styles.stepperCount}>
          Step {safeCurrent + 1} of {steps.length}
        </span>
      </div>
      <ol className={styles.stepperBar} aria-hidden="true">
        {steps.map((step, index) => (
          <li
            key={step}
            data-state={index < safeCurrent ? 'done' : index === safeCurrent ? 'current' : 'todo'}
          />
        ))}
      </ol>
    </div>
  );
}

/* Dialog ----------------------------------------------------------- */

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Buttons, primary last. */
  actions?: ReactNode;
}

/** A modal built on the native <dialog>: focus is trapped and Escape closes it. */
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <div className={styles.dialogHead}>
        <h2 id={titleId}>{title}</h2>
        <IconButton label="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <div className={styles.dialogBody}>{children}</div>
      {actions ? <div className={styles.dialogActions}>{actions}</div> : null}
    </dialog>
  );
}
