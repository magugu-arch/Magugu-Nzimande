'use client';

import { Button, Card, DescriptionList, Notice, Stack } from '@hao/design-system';
import { Send } from 'lucide-react';
import styles from '../apply.module.css';
import { STEP } from '../flow';
import type { ApplicationFlow } from '../useApplication';
import { BackButton, Problem, StepActions } from './parts';

/**
 * The only place an application is sent from, and only by the person pressing
 * the button. Nothing here submits on its own.
 */
export function SubmitStep({ flow }: { flow: ApplicationFlow }) {
  const checks = [
    {
      term: 'Declaration',
      description: flow.declared ? 'Ticked by you on the review step' : 'Not ticked yet',
    },
  ];
  if (flow.steps.some((step) => step.id === STEP.verify)) {
    checks.push({
      term: 'Identity check',
      description: flow.verified ? 'Confirmed by you' : 'Needs confirming again',
    });
  }
  if (flow.feeCents !== null) {
    checks.push({
      term: 'Sandbox payment',
      description: flow.receipt?.receiptNumber
        ? `Approved — receipt ${flow.receipt.receiptNumber}`
        : flow.paymentTaken
          ? 'Approved'
          : 'Not paid yet',
    });
  }

  return (
    <Stack gap={5}>
      <p className={styles.intro}>
        This is the last step. Nothing has been sent yet: when you press “Submit application” we
        send your answers to be checked.
      </p>
      <Card tone="sunken" padding="compact">
        <DescriptionList items={checks} />
      </Card>
      <Notice tone="info">
        <p>
          Receiving your application does not mean it is approved. A decision is only ever recorded
          by an authorised official.
        </p>
      </Notice>

      {flow.submitError ? (
        <Problem title="We could not submit your application" error={flow.submitError}>
          <p>Your answers are saved. You can go back to check them, then try again.</p>
        </Problem>
      ) : null}

      <StepActions>
        <Button
          size="lg"
          iconStart={<Send aria-hidden="true" />}
          loading={flow.submitting}
          onClick={() => void flow.submit()}
        >
          Submit application
        </Button>
        <BackButton flow={flow} />
      </StepActions>
    </Stack>
  );
}
