'use client';

import type { ApplicationDraft, ServiceDefinition } from '@hao/api-contracts';
import type { Session } from '@hao/auth-client';
import { AppLink, Card, Container, cx, Notice, PageHeader, Stepper } from '@hao/design-system';
import { meetsTier } from '@hao/shared-types';
import { useEffect, useRef } from 'react';
import { serviceHref } from '@/lib/catalogue';
import { formatRelative } from '@/lib/format';
import styles from './apply.module.css';
import { STEP, stepIndex } from './flow';
import { BeforeStep } from './steps/BeforeStep';
import { DoneStep } from './steps/DoneStep';
import { FormFields } from './steps/FormFields';
import { focusField } from './steps/parts';
import { PaymentStep } from './steps/PaymentStep';
import { ReviewAside, ReviewStep } from './steps/ReviewStep';
import { SubmitStep } from './steps/SubmitStep';
import { VerifyStep } from './steps/VerifyStep';
import { useApplication, type ApplicationFlow } from './useApplication';

function StepContent({ flow }: { flow: ApplicationFlow }) {
  if (flow.stepId === STEP.done) return <DoneStep flow={flow} />;
  const step = flow.steps[stepIndex(flow.steps, flow.stepId)];
  if (!step) return null;
  switch (step.kind) {
    case 'before':
      return <BeforeStep flow={flow} />;
    case 'form':
      return <FormFields step={step.form} flow={flow} />;
    case 'review':
      return <ReviewStep flow={flow} />;
    case 'verify':
      return <VerifyStep flow={flow} />;
    case 'payment':
      return <PaymentStep flow={flow} />;
    case 'submit':
      return <SubmitStep flow={flow} />;
  }
}

function savedLabel(flow: ApplicationFlow): string {
  if (flow.saving) return 'Saving…';
  if (flow.saveError) return 'Not saved yet';
  return flow.savedAt ? `Saved ${formatRelative(flow.savedAt)}` : '';
}

export interface ApplyFlowProps {
  service: ServiceDefinition;
  session: Session;
  /** The saved draft to start from. Read once: later copies of the draft are ignored. */
  initialDraft: ApplicationDraft | null;
  onDraftCreated?: (draftId: string) => void;
}

/**
 * One application from start to confirmation: a stepper, one question group
 * per screen, and a heading that takes focus after every step change.
 */
export function ApplyFlow({ service, session, initialDraft, onDraftCreated }: ApplyFlowProps) {
  const flow = useApplication({ service, session, initialDraft, onDraftCreated });
  const topRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { nav, pendingFocus } = flow;

  useEffect(() => {
    if (nav === 0) return; // Do not take focus when the page first opens.
    topRef.current?.scrollIntoView({ block: 'start' });
    if (pendingFocus && focusField(pendingFocus)) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [nav, pendingFocus]);

  const done = flow.stepId === STEP.done;
  const index = stepIndex(flow.steps, flow.stepId);
  const step = flow.steps[index];
  const heading = done ? 'Application received' : (step?.title ?? '');
  // "My applications" needs a verified session; a basic one finds its drafts on the home screen.
  const exitHref = meetsTier(session.tier, 'A2') ? '/applications/' : '/home/';

  return (
    <Container className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <PageHeader
            eyebrow={done ? 'Application sent' : 'Application'}
            title={service.title}
            back={
              flow.stepId === STEP.before
                ? { href: serviceHref(service.code), label: 'About this service' }
                : undefined
            }
          />

          <div ref={topRef} className={styles.top}>
            {done ? null : (
              <div className={styles.progress}>
                <Stepper steps={flow.steps.map((item) => item.title)} current={index} />
                <div className={styles.statusRow}>
                  <p className={styles.saved} aria-live="polite">
                    {savedLabel(flow)}
                  </p>
                  {flow.draft ? (
                    <AppLink
                      href={exitHref}
                      className={styles.exit}
                      onClick={(event) => {
                        // Save what is on screen first, so the link does what it says.
                        event.preventDefault();
                        void flow.saveAndExit(exitHref);
                      }}
                    >
                      Save and exit
                    </AppLink>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <section
            key={flow.stepId}
            id="apply-step"
            className={cx('rise', styles.step)}
            aria-labelledby="apply-step-heading"
          >
            <h2
              id="apply-step-heading"
              ref={headingRef}
              tabIndex={-1}
              className={styles.stepHeading}
            >
              {heading}
            </h2>
            {flow.flash ? (
              <Notice tone={flow.flash.tone} role="status">
                <p>{flow.flash.text}</p>
              </Notice>
            ) : null}
            <StepContent flow={flow} />
          </section>
        </div>

        <aside className={styles.aside} aria-label="About this application">
          {step?.kind === 'review' ? <ReviewAside /> : null}
          <Card tone="sunken" padding="compact">
            <p className={styles.asideTitle}>
              {done ? 'Your application is with us' : 'Stop and come back any time'}
            </p>
            <p className={styles.hint}>
              {done
                ? 'You can follow this application from “My applications”.'
                : 'Your answers are saved on this device each time you continue.'}{' '}
              <AppLink href="/help/">Get help</AppLink>
            </p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
