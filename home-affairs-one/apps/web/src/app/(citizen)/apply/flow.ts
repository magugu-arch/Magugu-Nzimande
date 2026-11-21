/**
 * The shape of the application journey: which steps exist, in what order, and
 * where a saved draft resumes. Pure functions only — no React, no gateway.
 */
import type { ApplicationDraft, FormStep, ServiceDefinition } from '@hao/api-contracts';
import { tierForSignIn, type Session } from '@hao/auth-client';
import { meetsTier, type AssuranceTier } from '@hao/shared-types';

/** Step ids that are not form steps. Form steps keep the ids the catalogue gives them. */
export const STEP = {
  before: 'before',
  review: 'review',
  verify: 'verify',
  payment: 'payment',
  submit: 'submit',
  done: 'done',
} as const;

export type ApplyStep =
  | { id: string; kind: 'before' | 'review' | 'verify' | 'payment' | 'submit'; title: string }
  | { id: string; kind: 'form'; title: string; form: FormStep };

/** The sample amount to take in the payment sandbox, or `null` when this service takes none. */
export function sampleFeeCents(service: Pick<ServiceDefinition, 'fee'>): number | null {
  return service.fee.kind === 'SAMPLE' && service.fee.amountCents > 0
    ? service.fee.amountCents
    : null;
}

/**
 * Every step of the journey in order. "Confirm it is you" only appears when the
 * session is below the tier the service needs; payment only when there is a
 * sample amount to pay.
 */
export function buildSteps(
  service: Pick<ServiceDefinition, 'form' | 'fee'>,
  options: { includeVerify: boolean },
): ApplyStep[] {
  const steps: ApplyStep[] = [{ id: STEP.before, kind: 'before', title: 'Before you start' }];
  for (const form of service.form?.steps ?? []) {
    steps.push({ id: form.id, kind: 'form', title: form.title, form });
  }
  steps.push({ id: STEP.review, kind: 'review', title: 'Review and declaration' });
  if (options.includeVerify) {
    steps.push({ id: STEP.verify, kind: 'verify', title: 'Confirm it is you' });
  }
  if (sampleFeeCents(service) !== null) {
    steps.push({ id: STEP.payment, kind: 'payment', title: 'Payment (sandbox)' });
  }
  steps.push({ id: STEP.submit, kind: 'submit', title: 'Submit' });
  return steps;
}

export function stepIndex(steps: ApplyStep[], id: string): number {
  return steps.findIndex((step) => step.id === id);
}

export function nextStepId(steps: ApplyStep[], id: string): string | null {
  const index = stepIndex(steps, id);
  return index === -1 ? null : (steps[index + 1]?.id ?? null);
}

export function previousStepId(steps: ApplyStep[], id: string): string | null {
  const index = stepIndex(steps, id);
  return index <= 0 ? null : (steps[index - 1]?.id ?? null);
}

/**
 * Where a saved draft opens. The declaration is never saved, so anything after
 * the review step resumes at the review step and the person ticks it again. An
 * id we do not recognise starts from the beginning.
 */
export function resumeStepId(steps: ApplyStep[], savedStepId: string): string {
  const afterReview: string[] = [STEP.verify, STEP.payment, STEP.submit];
  if (afterReview.includes(savedStepId)) return STEP.review;
  return stepIndex(steps, savedStepId) === -1 ? STEP.before : savedStepId;
}

/** What a screen reader hears after a step change: "Step 3 of 7: Review and declaration". */
export function stepAnnouncement(steps: ApplyStep[], id: string): string {
  const index = stepIndex(steps, id);
  const step = steps[index];
  return step ? `Step ${index + 1} of ${steps.length}: ${step.title}` : '';
}

/** A draft can only be resumed by the person who saved it, for the service it was saved for. */
export function isOwnDraft(
  draft: Pick<ApplicationDraft, 'serviceCode' | 'applicantToken'>,
  serviceCode: string,
  personToken: string,
): boolean {
  return draft.serviceCode === serviceCode && draft.applicantToken === personToken;
}

type JourneyStep = ServiceDefinition['journey'][number];

/** How many journey steps to show when the catalogue does not mark where the online part ends. */
const JOURNEY_FALLBACK = 3;

/**
 * Splits the catalogue's journey into the part done in this form ("before") and
 * what follows once it is sent ("after"). The online part ends with the step
 * where the person reviews and declares.
 */
export function splitJourney(journey: JourneyStep[]): {
  before: JourneyStep[];
  after: JourneyStep[];
} {
  const declares = journey.findIndex((step) => /\b(review|declar)/i.test(step.title));
  const cut = declares === -1 ? Math.min(JOURNEY_FALLBACK, journey.length) : declares + 1;
  return { before: journey.slice(0, cut), after: journey.slice(cut) };
}

/**
 * The tier a session really holds at `now`. A step-up lasts a few minutes; once
 * it lapses the session is back at the tier it signed in with, even if the copy
 * held in memory has not caught up yet.
 */
export function currentTier(
  session: Pick<Session, 'tier' | 'accountTier' | 'method' | 'stepUpExpiresAt'>,
  now: Date,
): AssuranceTier {
  if (session.stepUpExpiresAt && new Date(session.stepUpExpiresAt) <= now) {
    return tierForSignIn(session.accountTier, session.method);
  }
  return session.tier;
}

/** True when the person must confirm it is them before this service can be submitted. */
export function needsStepUp(
  session: Pick<Session, 'tier' | 'accountTier' | 'method' | 'stepUpExpiresAt'>,
  requiredTier: AssuranceTier,
  now: Date,
): boolean {
  return !meetsTier(currentTier(session, now), requiredTier);
}
