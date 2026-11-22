'use client';

import { Button, Card, Notice, SampleNotice, Stack } from '@hao/design-system';
import { ArrowRight } from 'lucide-react';
import { Photo } from '@/components/Photo';
import { formatSampleAmount } from '@/lib/format';
import styles from '../apply.module.css';
import { splitJourney } from '../flow';
import type { ApplicationFlow } from '../useApplication';
import { SaveProblem, StepActions } from './parts';

/** Content first: what this involves, what to have ready and what it costs, before any field. */
export function BeforeStep({ flow }: { flow: ApplicationFlow }) {
  const { service } = flow;
  const online = splitJourney(service.journey).before;
  const resuming = flow.draft !== null;

  return (
    <Stack gap={5}>
      <section className={styles.block} aria-labelledby="apply-involves">
        <h3 id="apply-involves">What this involves</h3>
        <ol className={styles.journey}>
          {online.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.block} aria-labelledby="apply-ready">
        <h3 id="apply-ready">What to have ready</h3>
        <SampleNotice />
        <ul className={styles.requirements}>
          {service.requirements.map((requirement) => (
            <li key={requirement.id}>
              <strong>{requirement.label}</strong>
              <span>{requirement.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.block} aria-labelledby="apply-fee">
        <h3 id="apply-fee">What it costs</h3>
        {service.fee.kind === 'SAMPLE' ? (
          <p>
            <strong>{formatSampleAmount(service.fee.amountCents)}</strong> — sample amount for the
            payment sandbox, not a real fee.
          </p>
        ) : (
          <p>{service.fee.note}</p>
        )}
      </section>

      {service.needsServicePoint ? (
        <Card padding="flush" className={styles.photoCard}>
          <Photo asset="A24" ratio="16 / 9" sizes="(min-width: 60rem) 44rem, 100vw" decorative />
          <div className={styles.photoCardBody}>
            <h3>Part of this is done in person</h3>
            <p>
              After your details are checked, you choose where to complete the in-person step.
              Nothing biometric is ever captured by this app.
            </p>
          </div>
        </Card>
      ) : null}

      <Notice tone="neutral" title="Your information">
        <p>
          We ask only for what this service needs and tell you why. Your answers are saved on this
          device as you go.
        </p>
      </Notice>

      <SaveProblem flow={flow} />

      <StepActions>
        <Button
          size="lg"
          iconEnd={<ArrowRight aria-hidden="true" />}
          loading={flow.saving}
          onClick={() => void flow.next()}
        >
          {resuming ? 'Continue' : 'Start'}
        </Button>
      </StepActions>
    </Stack>
  );
}
