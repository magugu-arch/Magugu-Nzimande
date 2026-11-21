'use client';

import { AppLink, Button, Notice } from '@hao/design-system';
import type { GatewayError } from '@hao/shared-types';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { QueryBoundary } from '@/components/QueryBoundary';
import styles from '../apply.module.css';
import type { ApplicationFlow } from '../useApplication';
import { fieldAnchorId, type FieldProblem } from '../validation';

/** Moves focus to the first control of a field. Returns false when the field is not on screen. */
export function focusField(fieldId: string): boolean {
  const control = document
    .getElementById(fieldAnchorId(fieldId))
    ?.querySelector<HTMLElement>('input, select, textarea, button');
  if (!control) return false;
  control.focus();
  return true;
}

/** The button row under a step: the main action first, full width on phones. */
export function StepActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function BackButton({ flow }: { flow: ApplicationFlow }) {
  return (
    <Button variant="quiet" iconStart={<ChevronLeft aria-hidden="true" />} onClick={flow.back}>
      Back
    </Button>
  );
}

/** A failed action: the safe message and the reference to quote to support. Nothing else. */
export function Problem({
  title,
  error,
  children,
}: {
  title: string;
  error: GatewayError;
  children?: ReactNode;
}) {
  return (
    <Notice tone="danger" role="alert" title={title}>
      <p>{error.safeMessage}</p>
      <p className={styles.trace}>Reference for support: {error.traceRef}</p>
      {children}
    </Notice>
  );
}

/**
 * Lists what needs attention, as links that go to each field. Focus moves here
 * every time "Continue" finds a problem, so it is heard and seen first.
 */
export function ErrorSummary({
  problems,
  nonce,
  onSelect,
}: {
  problems: FieldProblem[];
  /** Changes on every failed "Continue", including a repeat of the same problems. */
  nonce: number;
  onSelect: (problem: FieldProblem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nonce > 0) ref.current?.focus();
  }, [nonce]);

  if (problems.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} className={styles.summary}>
      <Notice tone="danger" role="alert" title="There is a problem">
        <ul className={styles.summaryList}>
          {problems.map((problem) => (
            <li key={`${problem.stepId}:${problem.fieldId}`}>
              <AppLink
                href={`#${fieldAnchorId(problem.fieldId)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(problem);
                }}
              >
                {problem.message}
              </AppLink>
            </li>
          ))}
        </ul>
      </Notice>
    </div>
  );
}

/**
 * Steps that show profile details wait for them here: loading, offline and
 * error-with-retry come from `QueryBoundary`. Once the details have loaded they
 * are kept, so a later failed refresh never takes the form away mid-answer.
 */
export function ProfileGate({
  flow,
  when = true,
  children,
}: {
  flow: ApplicationFlow;
  /** False for a step that shows nothing from the profile, so it never waits for it. */
  when?: boolean;
  children: ReactNode;
}) {
  if (!when || !flow.usesProfile || flow.profile.data) return <>{children}</>;
  return (
    <>
      <QueryBoundary
        query={flow.profile}
        loadingLabel="Loading your profile details"
        loadingRows={2}
        headingLevel={3}
      >
        {() => null}
      </QueryBoundary>
      <StepActions>
        <BackButton flow={flow} />
      </StepActions>
    </>
  );
}

/**
 * A save that did not go through. The answers are still on screen; nothing
 * moves on until a save succeeds.
 */
export function SaveProblem({ flow }: { flow: ApplicationFlow }) {
  if (!flow.saveError) return null;
  return (
    <Problem title="We could not save your answers" error={flow.saveError}>
      <p>Your answers are still on this screen. Nothing has been lost.</p>
      <div className={styles.noticeAction}>
        <Button variant="secondary" size="sm" loading={flow.saving} onClick={flow.retrySave}>
          Try again
        </Button>
      </div>
    </Problem>
  );
}
