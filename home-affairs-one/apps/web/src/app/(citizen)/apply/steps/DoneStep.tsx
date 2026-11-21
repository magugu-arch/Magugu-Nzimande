'use client';

import { Card, DescriptionList, LinkButton, Notice, Stack } from '@hao/design-system';
import { maskReference, STATUS_INFO } from '@hao/shared-types';
import { ArrowRight } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import styles from '../apply.module.css';
import { splitJourney } from '../flow';
import type { ApplicationFlow } from '../useApplication';
import { StepActions } from './parts';

/** "Received", never "approved": the reference, the receipt and what happens next. No timeframes. */
export function DoneStep({ flow }: { flow: ApplicationFlow }) {
  const opened = flow.submitted;
  if (!opened) return null;
  const next = splitJourney(flow.service.journey).after;

  const facts = [
    { term: 'Reference', description: maskReference(opened.caseId) },
    { term: 'Full reference', description: opened.caseId },
  ];
  if (flow.receipt?.receiptNumber) {
    facts.push({ term: 'Receipt number', description: flow.receipt.receiptNumber });
  }
  facts.push(
    { term: 'Status', description: STATUS_INFO[opened.status].userLabel },
    { term: 'Received', description: formatDateTime(opened.submittedAt) },
  );

  return (
    <Stack gap={5}>
      <Notice tone="success">
        <p>{STATUS_INFO.SUBMITTED.rule}</p>
      </Notice>

      <Card>
        <DescriptionList items={facts} />
        <p className={styles.hint}>
          Messages we send outside this app only ever show the masked reference.
        </p>
      </Card>

      <section className={styles.block} aria-labelledby="apply-next">
        <h3 id="apply-next">What happens next</h3>
        {opened.nextAction ? (
          <p>
            <strong>Your next step:</strong> {opened.nextAction.description}.
          </p>
        ) : null}
        {next.length > 0 ? (
          <ol className={styles.journey}>
            {next.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <p className={styles.hint}>
          We do not show timeframes. Each update appears in your application as it happens.
        </p>
      </section>

      <StepActions>
        <LinkButton
          href={`/applications/case/?id=${encodeURIComponent(opened.caseId)}`}
          size="lg"
          iconEnd={<ArrowRight aria-hidden="true" />}
        >
          Track this application
        </LinkButton>
        <LinkButton href="/home/" variant="secondary" size="lg">
          Back to home
        </LinkButton>
      </StepActions>
    </Stack>
  );
}
