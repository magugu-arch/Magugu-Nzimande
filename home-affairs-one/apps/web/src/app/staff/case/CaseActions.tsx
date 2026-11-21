'use client';

import { announce } from '@hao/accessibility';
import type { ApplicationCase, StaffAction } from '@hao/api-contracts';
import {
  Button,
  Card,
  Checkbox,
  Notice,
  RadioGroup,
  Select,
  Stack,
  Tag,
  Textarea,
} from '@hao/design-system';
import type { GatewayError } from '@hao/shared-types';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation } from '@/lib/queries';
import consoleStyles from '../console.module.css';
import { Ref } from '../words';
import styles from './case.module.css';
import {
  canEscalate,
  canRecordDecision,
  canRequestInformation,
  canStartChecks,
  nextRoutineStep,
} from './workflow-rules';

type DecisionOutcome = Extract<StaffAction, { type: 'RECORD_DECISION' }>['outcome'];

const OUTCOMES: Array<{ value: DecisionOutcome; label: string }> = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'REFERRED', label: 'Referred for review' },
];

/** Placeholder categories. Real reason codes come from the service owners. */
const REASON_CATEGORIES = [
  'Requirements met (sample)',
  'Requirements not met (sample)',
  'Information incomplete (sample)',
  'Needs specialist review (sample)',
];

const MIN_TEXT = 5;

interface ActionProps {
  item: ApplicationCase;
  staffRef: string;
  onRecorded: (message: string) => void;
}

/**
 * One staff action against the case. Every attempt carries a new idempotency
 * key and the acting official's reference; the result is announced.
 */
function useStaffAction({ item, staffRef, onRecorded }: ActionProps) {
  const mutation = useGatewayMutation((gateway, action: StaffAction) =>
    gateway.workflow.recordStaffAction(item.caseId, action, staffRef, {
      idempotencyKey: newIdempotencyKey('staff-action'),
    }),
  );
  return {
    pending: mutation.isPending,
    error: mutation.error,
    run(action: StaffAction, message: string, after?: () => void) {
      mutation.mutate(action, {
        onSuccess: () => {
          announce(message);
          onRecorded(message);
          after?.();
        },
        onError: (error) => announce(`Not recorded. ${error.safeMessage}`),
      });
    },
  };
}

function ActionError({ error }: { error: GatewayError | null }) {
  if (!error) return null;
  return (
    <Notice tone="danger" role="alert" title="This action was not recorded">
      <p>{error.safeMessage}</p>
      <p>
        Reference for support: <Ref>{error.traceRef}</Ref>
      </p>
    </Notice>
  );
}

/** A small card per action. When the workflow will not take the action, it says why instead. */
function ActionCard({
  title,
  blocked,
  error,
  children,
}: {
  title: string;
  blocked: string | null;
  error: GatewayError | null;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Card
      as="section"
      padding="compact"
      tone={blocked ? 'sunken' : 'default'}
      aria-labelledby={headingId}
    >
      <Stack gap={3}>
        <div className={styles.actionHead}>
          <h3 id={headingId}>{title}</h3>
          {blocked ? <Tag tone="neutral">Not available now</Tag> : null}
        </div>
        {blocked ? <p className={consoleStyles.note}>{blocked}</p> : children}
        <ActionError error={error} />
      </Stack>
    </Card>
  );
}

const focusFirst = (form: HTMLFormElement | null, selector: string) =>
  form?.querySelector<HTMLElement>(selector)?.focus();

function StartChecks(props: ActionProps) {
  const action = useStaffAction(props);
  const rule = canStartChecks(props.item);
  return (
    <ActionCard
      title="Start checks"
      blocked={rule.allowed ? null : rule.reason}
      error={action.error}
    >
      <form
        className={styles.actionForm}
        onSubmit={(event) => {
          event.preventDefault();
          action.run({ type: 'START_VALIDATION' }, 'Recorded: checks started.');
        }}
      >
        <p className={consoleStyles.note}>
          Records that identity and evidence checks have started. The applicant sees the new status.
        </p>
        <div>
          <Button type="submit" loading={action.pending}>
            Start checks
          </Button>
        </div>
      </form>
    </ActionCard>
  );
}

function RequestInformation(props: ActionProps) {
  const action = useStaffAction(props);
  const rule = canRequestInformation(props.item);
  const form = useRef<HTMLFormElement>(null);
  const [request, setRequest] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = request.trim();
    if (text.length < MIN_TEXT) {
      setError(`Say what you need in at least ${MIN_TEXT} characters.`);
      focusFirst(form.current, 'textarea');
      return;
    }
    action.run(
      { type: 'REQUEST_INFORMATION', request: text },
      'Recorded: the applicant has been asked for information. The application is paused until they reply.',
      () => setRequest(''),
    );
  };

  return (
    <ActionCard
      title="Ask the applicant for information"
      blocked={rule.allowed ? null : rule.reason}
      error={action.error}
    >
      <form ref={form} className={styles.actionForm} onSubmit={submit} noValidate>
        <Textarea
          label="What do you need?"
          hint="This text is shown to the applicant. Do not include personal details."
          rows={3}
          maxLength={400}
          value={request}
          onChange={(event) => {
            setRequest(event.target.value);
            setError(null);
          }}
          error={error}
        />
        <div>
          <Button type="submit" variant="secondary" loading={action.pending}>
            Send request to the applicant
          </Button>
        </div>
      </form>
    </ActionCard>
  );
}

function Escalate(props: ActionProps) {
  const action = useStaffAction(props);
  const rule = canEscalate(props.item);
  const form = useRef<HTMLFormElement>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const alreadyThere = props.item.assignedQueue === 'Specialist review';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < MIN_TEXT) {
      setError(`Give a reason in at least ${MIN_TEXT} characters.`);
      focusFirst(form.current, 'textarea');
      return;
    }
    action.run(
      { type: 'ESCALATE', reason: text },
      'Recorded: the application has been referred to the specialist review queue.',
      () => setReason(''),
    );
  };

  return (
    <ActionCard
      title="Refer to a specialist team"
      blocked={rule.allowed ? null : rule.reason}
      error={action.error}
    >
      <form ref={form} className={styles.actionForm} onSubmit={submit} noValidate>
        {alreadyThere ? (
          <p className={consoleStyles.note}>
            This application is already in the specialist review queue.
          </p>
        ) : null}
        <Textarea
          label="Reason"
          hint="Not shown to the applicant. In this prototype the reason is checked but not kept. Do not include personal details."
          rows={3}
          maxLength={400}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
          error={error}
        />
        <div>
          <Button type="submit" variant="secondary" loading={action.pending}>
            Refer to specialist review
          </Button>
        </div>
      </form>
    </ActionCard>
  );
}

function Advance(props: ActionProps) {
  const action = useStaffAction(props);
  const next = nextRoutineStep(props.item);
  const [note, setNote] = useState('');

  return (
    <ActionCard
      title="Move to the next step"
      blocked={next.allowed ? null : next.reason}
      error={action.error}
    >
      <form
        className={styles.actionForm}
        onSubmit={(event) => {
          event.preventDefault();
          const text = note.trim();
          action.run(
            text ? { type: 'ADVANCE', note: text } : { type: 'ADVANCE' },
            'Recorded: the application moved to its next routine step.',
            () => setNote(''),
          );
        }}
      >
        <p className={consoleStyles.note}>
          This records the next routine workflow step
          {next.allowed ? (
            <>
              : <strong>{next.preview}</strong>
            </>
          ) : (
            '.'
          )}{' '}
          It never records a decision.
        </p>
        <Textarea
          label="Note"
          optional
          hint="Not shown to the applicant. In this prototype the note is not kept. Do not include personal details."
          rows={2}
          maxLength={400}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <div>
          <Button type="submit" variant="secondary" loading={action.pending}>
            Record the next step
          </Button>
        </div>
      </form>
    </ActionCard>
  );
}

function RecordDecision(props: ActionProps) {
  const action = useStaffAction(props);
  const rule = canRecordDecision(props.item);
  const form = useRef<HTMLFormElement>(null);
  const groupName = useId();
  const [outcome, setOutcome] = useState<DecisionOutcome | ''>('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [errors, setErrors] = useState<{ outcome?: string; reason?: string; reviewed?: string }>(
    {},
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (outcome === '') found.outcome = 'Choose an outcome.';
    if (reasonCategory === '') found.reason = 'Choose a reason category.';
    if (!reviewed) {
      found.reviewed = 'Confirm that you reviewed this case yourself before recording a decision.';
    }
    setErrors(found);
    if (outcome === '' || reasonCategory === '' || !reviewed) {
      focusFirst(
        form.current,
        found.outcome ? 'input[type="radio"]' : found.reason ? 'select' : 'input[type="checkbox"]',
      );
      return;
    }
    const words = OUTCOMES.find((option) => option.value === outcome)?.label ?? outcome;
    action.run(
      // `reviewedByHuman` is only ever sent as the literal `true`, and only when the box is ticked.
      { type: 'RECORD_DECISION', outcome, reasonCategory, reviewedByHuman: true },
      `Decision recorded: ${words.toLowerCase()}. It is attributed to you.`,
      () => {
        setOutcome('');
        setReasonCategory('');
        setReviewed(false);
      },
    );
  };

  return (
    <ActionCard
      title="Record a decision"
      blocked={rule.allowed ? null : rule.reason}
      error={action.error}
    >
      <form ref={form} className={styles.actionForm} onSubmit={submit} noValidate>
        <RadioGroup
          legend="Outcome"
          name={groupName}
          value={outcome}
          onChange={(value) => {
            setOutcome(OUTCOMES.find((option) => option.value === value)?.value ?? '');
            setErrors((current) => ({ ...current, outcome: undefined }));
          }}
          options={OUTCOMES}
          error={errors.outcome}
        />
        <Select
          label="Reason category"
          hint="Sample categories. Real reason codes come from the service owners."
          placeholder="Choose a category"
          value={reasonCategory}
          onChange={(event) => {
            setReasonCategory(event.target.value);
            setErrors((current) => ({ ...current, reason: undefined }));
          }}
          options={REASON_CATEGORIES.map((category) => ({ value: category, label: category }))}
          error={errors.reason}
        />
        <Checkbox
          card
          label="I have reviewed this case myself. This decision is mine, not an automated recommendation."
          checked={reviewed}
          onChange={(event) => {
            setReviewed(event.target.checked);
            setErrors((current) => ({ ...current, reviewed: undefined }));
          }}
          error={errors.reviewed}
        />
        <p className={consoleStyles.note}>
          The applicant will see the outcome and the review route. The decision is recorded against
          your staff reference, <Ref>{props.staffRef}</Ref>.
        </p>
        <div>
          <Button type="submit" loading={action.pending}>
            Record decision
          </Button>
        </div>
      </form>
    </ActionCard>
  );
}

/**
 * The actions an official can take on a case. Each is its own small form;
 * nothing here is suggested, pre-filled or decided by automation.
 */
export function CaseActions({ item, staffRef }: { item: ApplicationCase; staffRef: string }) {
  const [recorded, setRecorded] = useState<string | null>(null);
  const props: ActionProps = { item, staffRef, onRecorded: setRecorded };

  return (
    <Stack gap={4}>
      {recorded ? (
        <Notice tone="success" role="status" title="Action recorded">
          <p>{recorded}</p>
        </Notice>
      ) : null}
      <StartChecks {...props} />
      <RequestInformation {...props} />
      <Escalate {...props} />
      <Advance {...props} />
      <RecordDecision {...props} />
    </Stack>
  );
}
