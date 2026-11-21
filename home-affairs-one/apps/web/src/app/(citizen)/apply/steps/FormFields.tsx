'use client';

import type { EvidenceItem, FormField, FormStep } from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Checkbox,
  Disclosure,
  RadioGroup,
  Select,
  Stack,
  Tag,
  TextInput,
  Textarea,
} from '@hao/design-system';
import { ArrowRight, CircleAlert, FileCheck, Paperclip } from 'lucide-react';
import { useEffect, useRef, type FormEvent } from 'react';
import { formatRelative } from '@/lib/format';
import styles from '../apply.module.css';
import type { ApplicationFlow } from '../useApplication';
import { fieldAnchorId } from '../validation';
import {
  BackButton,
  ErrorSummary,
  focusField,
  Problem,
  ProfileGate,
  SaveProblem,
  StepActions,
} from './parts';

/** The wording the workflow uses for every placeholder; shown even if a label ever differs. */
const SYNTHETIC_NOTE = 'Synthetic placeholder — no real file';

/**
 * Evidence without a file input. The only thing that can be attached is a
 * labelled stand-in: real documents are never accepted by the prototype.
 */
function EvidenceField({
  field,
  item,
  error,
  flow,
}: {
  field: FormField;
  item: EvidenceItem | undefined;
  error: string | null;
  flow: ApplicationFlow;
}) {
  const labelId = `${fieldAnchorId(field.id)}-label`;
  const busy = flow.evidenceBusyField === field.id;
  const failure = flow.evidenceError?.fieldId === field.id ? flow.evidenceError.error : null;

  // Attaching swaps one button for another. Keep focus on whichever replaces the one pressed.
  const controls = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const attachedId = item?.evidenceId ?? null;
  useEffect(() => {
    if (pressed.current) controls.current?.querySelector<HTMLElement>('button')?.focus();
  }, [attachedId]);

  return (
    <div className={styles.evidence} role="group" aria-labelledby={labelId}>
      <p className={styles.evidenceLabel} id={labelId}>
        {field.label}
        {field.required ? null : <span className={styles.optional}>(optional)</span>}
      </p>
      {field.hint ? <p className={styles.hint}>{field.hint}</p> : null}
      <p className={styles.hint}>
        Real documents cannot be uploaded in this prototype, and no file is ever read from your
        device.
      </p>

      <div ref={controls}>
        {item ? (
          <div className={styles.evidenceCard}>
            <FileCheck aria-hidden="true" />
            <div className={styles.evidenceText}>
              <p className={styles.evidenceName}>{item.fileLabel}</p>
              {item.fileLabel === SYNTHETIC_NOTE ? null : <p>{SYNTHETIC_NOTE}</p>}
              <p className={styles.evidenceMeta}>
                Stands in for: {item.documentType}. Added {formatRelative(item.addedAt)}.{' '}
                {item.retention}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() => {
                pressed.current = true;
                void flow.removeEvidence(item);
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            iconStart={<Paperclip aria-hidden="true" />}
            loading={busy}
            onClick={() => {
              pressed.current = true;
              void flow.attachEvidence(field);
            }}
          >
            Attach a synthetic placeholder
          </Button>
        )}
      </div>

      {error ? (
        <p className={styles.fieldError}>
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {failure ? (
        <Problem title="We could not update the placeholder" error={failure}>
          <p>Nothing was attached or removed. You can try again.</p>
        </Problem>
      ) : null}
    </div>
  );
}

function FieldControl({ field, flow }: { field: FormField; flow: ApplicationFlow }) {
  const error = flow.problems.list.find((problem) => problem.fieldId === field.id)?.message ?? null;
  const value = flow.answers[field.id];
  const text = typeof value === 'string' ? value : '';
  const optional = !field.required;
  const setText = (next: string) => flow.setAnswer(field.id, next);

  if (field.type === 'evidence') {
    return (
      <EvidenceField
        field={field}
        item={flow.evidence.find((candidate) => candidate.fieldId === field.id)}
        error={error}
        flow={flow}
      />
    );
  }

  if (field.profileKey) {
    // Shown for confirmation only. It is corrected at the source, not retyped here.
    return (
      <TextInput
        label={
          <>
            {field.label}{' '}
            <Tag tone="info" className={styles.labelTag}>
              From your profile
            </Tag>
          </>
        }
        hint={
          <>
            {field.hint ? `${field.hint} ` : null}
            {text === '' ? (
              <>
                Your profile does not hold this yet. You can add it in{' '}
                <AppLink href="/profile/">Profile</AppLink>; this application is saved.
              </>
            ) : (
              'From your profile. If this is wrong, correct it in Profile before you submit.'
            )}
          </>
        }
        value={text}
        readOnly
        optional={optional}
        error={error}
      />
    );
  }

  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          label={field.label}
          hint={field.hint}
          optional={optional}
          error={error}
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      );
    case 'select':
      return (
        <Select
          label={field.label}
          hint={field.hint}
          optional={optional}
          error={error}
          placeholder="Choose one"
          options={field.options ?? []}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      );
    case 'radio':
      return (
        <RadioGroup
          legend={field.label}
          hint={field.hint}
          optional={optional}
          error={error}
          name={field.id}
          value={text}
          onChange={setText}
          options={field.options ?? []}
        />
      );
    case 'checkbox':
      return (
        <Checkbox
          label={
            optional ? (
              <>
                {field.label} <span className={styles.optional}>(optional)</span>
              </>
            ) : (
              field.label
            )
          }
          hint={field.hint}
          error={error}
          checked={value === true}
          onChange={(event) => flow.setAnswer(field.id, event.target.checked)}
        />
      );
    case 'date':
      return (
        <TextInput
          type="date"
          label={field.label}
          hint={field.hint}
          optional={optional}
          error={error}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      );
    default:
      return (
        <TextInput
          label={field.label}
          hint={field.hint}
          optional={optional}
          error={error}
          // Sample answers only: do not let the browser offer real details.
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      );
  }
}

/** One question group: the catalogue's intro, its fields, and why each one is asked. */
export function FormFields({ step, flow }: { step: FormStep; flow: ApplicationFlow }) {
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void flow.next();
  };
  const problems = flow.problems.list.filter((problem) => problem.stepId === step.id);

  return (
    <Stack gap={5}>
      <p className={styles.intro}>{step.intro}</p>
      <ProfileGate flow={flow} when={step.fields.some((field) => field.profileKey)}>
        <form onSubmit={onSubmit} noValidate>
          <Stack gap={5}>
            <ErrorSummary
              problems={problems}
              nonce={flow.problems.nonce}
              onSelect={(problem) => focusField(problem.fieldId)}
            />
            {step.fields.map((field) => (
              <div key={field.id} id={fieldAnchorId(field.id)} className={styles.field}>
                <FieldControl field={field} flow={flow} />
                {field.why ? (
                  <Disclosure summary="Why we ask">
                    <p>{field.why}</p>
                  </Disclosure>
                ) : null}
              </div>
            ))}
            <SaveProblem flow={flow} />
            <StepActions>
              <Button
                type="submit"
                size="lg"
                iconEnd={<ArrowRight aria-hidden="true" />}
                loading={flow.saving}
              >
                Continue
              </Button>
              <BackButton flow={flow} />
            </StepActions>
          </Stack>
        </form>
      </ProfileGate>
    </Stack>
  );
}
