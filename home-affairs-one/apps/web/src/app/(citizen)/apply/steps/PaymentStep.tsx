'use client';

import type { SandboxOutcome } from '@hao/api-contracts';
import { Button, Card, DescriptionList, Notice, RadioGroup, Stack } from '@hao/design-system';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatSampleAmount } from '@/lib/format';
import styles from '../apply.module.css';
import type { ApplicationFlow } from '../useApplication';
import { BackButton, Problem, SaveProblem, StepActions } from './parts';

const OUTCOMES: Array<{ value: SandboxOutcome; label: string; hint: string }> = [
  { value: 'APPROVE', label: 'Approve', hint: 'The payment goes through.' },
  { value: 'DECLINE', label: 'Decline', hint: 'The payment is refused.' },
  { value: 'TIMEOUT', label: 'Time out', hint: 'The payment page does not answer in time.' },
];

/**
 * The payment sandbox. No money moves and no card details are asked for; the
 * outcome picker is there so reviewers can see the declined and timed-out paths.
 */
export function PaymentStep({ flow }: { flow: ApplicationFlow }) {
  const [outcome, setOutcome] = useState<SandboxOutcome>('APPROVE');
  const amountCents = flow.feeCents ?? 0;
  const last = flow.lastPayment;

  // Paying swaps the button for the receipt. Move focus to the receipt so it is not lost.
  const receiptRef = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const taken = flow.paymentTaken;
  useEffect(() => {
    if (taken && pressed.current) receiptRef.current?.focus();
  }, [taken]);

  return (
    <Stack gap={5}>
      <Card tone="info">
        <Stack gap={3}>
          <h3 className={styles.sandboxTitle}>
            <FlaskConical aria-hidden="true" />
            Payment sandbox — no money moves and no card details are asked for
          </h3>
          <DescriptionList
            items={[
              {
                term: 'Sample amount',
                description: `${formatSampleAmount(amountCents)} — sample amount for the payment sandbox, not a real fee`,
              },
              { term: 'For', description: flow.service.title },
            ]}
          />
        </Stack>
      </Card>

      {taken ? (
        <div ref={receiptRef} tabIndex={-1} className={styles.summary}>
          <Notice tone="success" title="The sandbox approved the payment">
            {flow.receipt?.receiptNumber ? (
              <p>
                Receipt number: <strong>{flow.receipt.receiptNumber}</strong>
              </p>
            ) : null}
            <p>No money moved. The receipt is kept with this application.</p>
          </Notice>
        </div>
      ) : (
        <>
          <RadioGroup
            legend="How should the sandbox respond?"
            hint="For reviewers: pick a result to see how each one is handled."
            name="apply-sandbox-outcome"
            value={outcome}
            onChange={(value) => {
              const picked = OUTCOMES.find((option) => option.value === value);
              if (picked) setOutcome(picked.value);
            }}
            options={OUTCOMES}
          />
          {last?.status === 'DECLINED' ? (
            <Notice tone="danger" role="alert" title="Payment declined">
              <p>The sandbox declined this payment. Nothing was charged. You can try again.</p>
            </Notice>
          ) : null}
          {last?.status === 'TIMED_OUT' ? (
            <Notice tone="attention" role="alert" title="Payment did not complete">
              <p>
                The payment did not complete in time. We have not submitted your application. You
                can try again.
              </p>
            </Notice>
          ) : null}
          {flow.payError ? (
            <Problem title="We could not reach the payment sandbox" error={flow.payError}>
              <p>Nothing was charged. You can try again.</p>
            </Problem>
          ) : null}
        </>
      )}

      <SaveProblem flow={flow} />
      <StepActions>
        {taken ? (
          <Button
            size="lg"
            iconEnd={<ArrowRight aria-hidden="true" />}
            loading={flow.saving}
            onClick={() => void flow.next()}
          >
            Continue
          </Button>
        ) : (
          <Button
            size="lg"
            loading={flow.paying}
            onClick={() => {
              pressed.current = true;
              void flow.pay(outcome);
            }}
          >
            Pay sample amount
          </Button>
        )}
        <BackButton flow={flow} />
      </StepActions>
    </Stack>
  );
}
