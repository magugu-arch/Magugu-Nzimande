'use client';

import { AppLink, Button, Card, Checkbox, DescriptionList, Stack, Tag } from '@hao/design-system';
import { ArrowRight } from 'lucide-react';
import type { FormEvent } from 'react';
import { Photo } from '@/components/Photo';
import { formatSampleAmount } from '@/lib/format';
import styles from '../apply.module.css';
import { STEP } from '../flow';
import type { ApplicationFlow } from '../useApplication';
import {
  DECLARATION_FIELD_ID,
  fieldAnchorId,
  summariseStep,
  type FieldProblem,
} from '../validation';
import {
  BackButton,
  ErrorSummary,
  focusField,
  ProfileGate,
  SaveProblem,
  StepActions,
} from './parts';

/** Shown beside the review on wide screens only. Context, never information. */
export function ReviewAside() {
  return (
    <div className={styles.reviewAside}>
      <Photo asset="A58" ratio="4 / 5" sizes="17rem" />
      <p>
        Take your time reading it through. Nothing is sent until you press “Submit application” on
        the last step.
      </p>
    </div>
  );
}

/** Review before submit: every answer by step, the fee line, then the person's own declaration. */
export function ReviewStep({ flow }: { flow: ApplicationFlow }) {
  const { service } = flow;
  const declarationError =
    flow.problems.list.find((problem) => problem.fieldId === DECLARATION_FIELD_ID)?.message ?? null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void flow.next();
  };
  const onSelect = (problem: FieldProblem) => {
    if (problem.stepId === STEP.review) focusField(problem.fieldId);
    else flow.goTo(problem.stepId, problem.fieldId);
  };

  return (
    <Stack gap={5}>
      <p className={styles.intro}>
        Check your answers. You can change anything before you submit. Nothing is sent from this
        step.
      </p>
      <ProfileGate flow={flow}>
        <form onSubmit={onSubmit} noValidate>
          <Stack gap={5}>
            <ErrorSummary
              problems={flow.problems.list}
              nonce={flow.problems.nonce}
              onSelect={onSelect}
            />

            {flow.formSteps.map((step) => (
              <Card as="section" key={step.id} aria-labelledby={`apply-review-${step.id}`}>
                <div className={styles.reviewHead}>
                  <h3 id={`apply-review-${step.id}`}>{step.title}</h3>
                  <AppLink
                    href="#apply-step"
                    onClick={(event) => {
                      event.preventDefault();
                      flow.goTo(step.id);
                    }}
                  >
                    Change <span className="visually-hidden">{step.title.toLowerCase()}</span>
                  </AppLink>
                </div>
                <DescriptionList
                  items={summariseStep(step, flow.answers, flow.evidence).map((row) => ({
                    term: row.label,
                    description: row.missing ? (
                      <span className={styles.missing}>
                        {row.text} <Tag tone="attention">Needs an answer</Tag>
                      </span>
                    ) : (
                      row.text
                    ),
                  }))}
                />
              </Card>
            ))}

            <Card as="section" tone="sunken" aria-labelledby="apply-review-fee">
              <h3 id="apply-review-fee">Fee</h3>
              {service.fee.kind === 'SAMPLE' ? (
                <p>
                  <strong>{formatSampleAmount(service.fee.amountCents)}</strong> — sample amount for
                  the payment sandbox, not a real fee.
                  {flow.feeCents !== null
                    ? ' You pay it in the sandbox before you submit. No money moves.'
                    : null}
                </p>
              ) : (
                <p>{service.fee.note}</p>
              )}
            </Card>

            <Card as="section" aria-labelledby="apply-review-declaration">
              <Stack gap={3}>
                <h3 id="apply-review-declaration">Declaration</h3>
                <p className={styles.hint}>
                  Only you can make this declaration. We never tick it for you, and the tick is not
                  saved with your draft.
                </p>
                <div id={fieldAnchorId(DECLARATION_FIELD_ID)}>
                  <Checkbox
                    card
                    label="I confirm that the information I have given is true and complete, and I understand this is a prototype with sample data."
                    checked={flow.declared}
                    onChange={(event) => flow.tickDeclaration(event.target.checked)}
                    error={declarationError}
                  />
                </div>
              </Stack>
            </Card>

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
