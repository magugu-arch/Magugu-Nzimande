'use client';

import { announce } from '@hao/accessibility';
import type {
  AnswerValue,
  ApplicationCase,
  ApplicationDraft,
  EvidenceItem,
  FormField,
  PaymentRecord,
  SandboxOutcome,
  SaveDraftInput,
  ServiceDefinition,
  SubmitApplicationInput,
} from '@hao/api-contracts';
import { STEP_UP_MINUTES, type Session } from '@hao/auth-client';
import { meetsTier, type GatewayError } from '@hao/shared-types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { newIdempotencyKey } from '@/lib/idempotency';
import { asGatewayError, useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import {
  buildSteps,
  currentTier,
  nextStepId,
  previousStepId,
  resumeStepId,
  sampleFeeCents,
  STEP,
  stepAnnouncement,
  stepIndex,
  type ApplyStep,
} from './flow';
import {
  answersToSave,
  applyProfile,
  DECLARATION_FIELD_ID,
  DECLARATION_PROBLEM,
  validateForm,
  validateStep,
  type Answers,
  type FieldProblem,
} from './validation';

const NO_EVIDENCE: EvidenceItem[] = [];

/** A one-off message shown at the top of the step the person has just arrived on. */
export interface FlashMessage {
  tone: 'success' | 'attention';
  text: string;
}

export interface UseApplicationArgs {
  service: ServiceDefinition;
  session: Session;
  /** The saved draft this screen was opened with, or `null` for a new application. */
  initialDraft: ApplicationDraft | null;
  /** Called once, when "Start" creates the draft, so the URL can carry it without a reload. */
  onDraftCreated?: (draftId: string) => void;
}

/**
 * State and actions for one application, from "Before you start" to the
 * confirmation. Answers live here while the person works; every Continue and
 * Back also saves them to the draft, so a refresh resumes where they were.
 *
 * Two things are deliberately never saved or done for the person: the
 * declaration tick, and the submission itself.
 */
export function useApplication({
  service,
  session,
  initialDraft,
  onDraftCreated,
}: UseApplicationArgs) {
  const router = useRouter();
  const { stepUp } = useSession();
  const token = session.subjectRef;
  const formSteps = useMemo(() => service.form?.steps ?? [], [service]);
  const feeCents = sampleFeeCents(service);
  const usesProfile = formSteps.some((step) => step.fields.some((field) => field.profileKey));

  /* ------------------------------ state ------------------------------ */

  /** The latest copy the workflow gave back: its id, evidence and payment reference. */
  const [draft, setDraft] = useState<ApplicationDraft | null>(initialDraft);
  const [savedAt, setSavedAt] = useState<string | null>(initialDraft?.updatedAt ?? null);
  const [answers, setAnswers] = useState<Answers>(() => initialDraft?.answers ?? {});
  /**
   * "Confirm it is you" is part of the journey whenever the session is below the
   * tier the service needs. Once it has been shown it stays, so the step count
   * does not jump when the check succeeds.
   */
  const [verifyShown, setVerifyShown] = useState(
    () => !meetsTier(session.tier, service.requiredTier),
  );
  const includeVerify = verifyShown || !meetsTier(session.tier, service.requiredTier);
  const steps = useMemo(() => buildSteps(service, { includeVerify }), [service, includeVerify]);
  const [stepId, setStepId] = useState<string>(() =>
    initialDraft ? resumeStepId(steps, initialDraft.currentStepId) : STEP.before,
  );
  /** Counts step changes, so the screen knows when to move focus to the new heading. */
  const [nav, setNav] = useState(0);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  /** Only ever set by the person ticking the box. Not saved, not restored. */
  const [declared, setDeclared] = useState(false);
  const [problems, setProblems] = useState<{ list: FieldProblem[]; nonce: number }>({
    list: [],
    nonce: 0,
  });
  const [saveError, setSaveError] = useState<GatewayError | null>(null);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [stepUpLapsed, setStepUpLapsed] = useState(false);
  const [lastPayment, setLastPayment] = useState<PaymentRecord | null>(null);
  const [submitted, setSubmitted] = useState<ApplicationCase | null>(null);

  /* ------------------------------- data ------------------------------ */

  const profile = useGatewayQuery(
    ['profile-fields', token],
    (g) => g.identity.getProfileFields(token),
    { enabled: usesProfile },
  );
  /** Answers as the form shows them: profile-linked fields always come from the profile. */
  const effectiveAnswers = useMemo(
    () => (profile.data ? applyProfile(formSteps, answers, profile.data) : answers),
    [answers, formSteps, profile.data],
  );
  const evidence = draft?.evidence ?? NO_EVIDENCE;

  const approvedPayment = lastPayment?.status === 'APPROVED' ? lastPayment : null;
  const paidRef = draft?.paymentRef ?? null;
  const receiptQuery = useGatewayQuery(
    ['payment', paidRef],
    (g) => g.payments.getPayment(paidRef ?? ''),
    { enabled: paidRef !== null && approvedPayment?.paymentRef !== paidRef },
  );
  const receipt: PaymentRecord | null =
    approvedPayment ?? (paidRef !== null ? (receiptQuery.data ?? null) : null);
  /** True once the sandbox has approved a payment, whether or not it is on the draft yet. */
  const paymentTaken = paidRef !== null || approvedPayment !== null;

  const verified = !stepUpLapsed && meetsTier(session.tier, service.requiredTier);

  /* ----------------------------- mutations --------------------------- */

  // Creating the draft is one intent: a retry of "Start" must not create a second draft.
  const [createKey] = useState(() => newIdempotencyKey('create-draft'));
  // So is sending the application.
  const [submitKey] = useState(() => newIdempotencyKey('submit-application'));

  const saveMutation = useGatewayMutation((g, input: SaveDraftInput) =>
    g.workflow.saveDraft(input, {
      // Each later save is a new intent, because the answers may have changed.
      idempotencyKey: input.draftId === undefined ? createKey : newIdempotencyKey('save-draft'),
    }),
  );
  const attachMutation = useGatewayMutation((g, input: { draftId: string; field: FormField }) =>
    g.workflow.attachSampleEvidence(input.draftId, input.field.id, input.field.label, {
      idempotencyKey: newIdempotencyKey('attach-evidence'),
    }),
  );
  const removeMutation = useGatewayMutation(
    (g, input: { draftId: string; fieldId: string; evidenceId: string }) =>
      g.workflow.removeEvidence(input.draftId, input.evidenceId, {
        idempotencyKey: newIdempotencyKey('remove-evidence'),
      }),
  );
  const payMutation = useGatewayMutation(
    async (g, input: { draftId: string; amountCents: number; outcome: SandboxOutcome }) => {
      // Every attempt is a new payment intent with its own keys, so a retry never reuses a result.
      const intent = await g.payments.createPayment(
        {
          personToken: token,
          draftId: input.draftId,
          caseId: null,
          description: `${service.title} — sample amount`,
          amountCents: input.amountCents,
        },
        { idempotencyKey: newIdempotencyKey('create-payment') },
      );
      return g.payments.completeSandboxPayment(intent.paymentRef, input.outcome, {
        idempotencyKey: newIdempotencyKey('complete-payment'),
      });
    },
  );
  const submitMutation = useGatewayMutation((g, input: SubmitApplicationInput) =>
    g.workflow.submitApplication(input, { idempotencyKey: submitKey }),
  );

  /* ------------------------------ helpers ---------------------------- */

  function showProblems(list: FieldProblem[]) {
    setProblems((current) => ({ list, nonce: current.nonce + 1 }));
  }

  function moveTo(
    target: string,
    options: {
      steps?: ApplyStep[];
      prefix?: string;
      flash?: FlashMessage;
      focusField?: string;
    } = {},
  ) {
    setStepId(target);
    setNav((count) => count + 1);
    setPendingFocus(options.focusField ?? null);
    setFlash(options.flash ?? null);
    setProblems((current) => ({ list: [], nonce: current.nonce }));
    const line = stepAnnouncement(options.steps ?? steps, target);
    announce(options.prefix ? `${options.prefix} ${line}` : line);
  }

  /**
   * Saves the answers and where the person is. Returns the saved draft, or
   * `null` when it failed — the answers stay in memory and the caller stays put.
   */
  async function persist(target: string, patch: { paymentRef?: string } = {}) {
    setSaveError(null);
    // An approved payment that is not on the draft yet travels with every save until it is.
    const unsavedPayment =
      approvedPayment && draft?.paymentRef !== approvedPayment.paymentRef
        ? { paymentRef: approvedPayment.paymentRef }
        : {};
    try {
      const saved = await saveMutation.mutateAsync({
        draftId: draft?.draftId,
        serviceCode: service.code,
        applicantToken: token,
        answers: draft ? answersToSave(formSteps, effectiveAnswers) : {},
        currentStepId: target,
        ...unsavedPayment,
        ...patch,
      });
      setDraft(saved);
      setSavedAt(saved.updatedAt);
      if (!draft) {
        // The address now carries the draft, so a refresh resumes it. This screen keeps running.
        onDraftCreated?.(saved.draftId);
        router.replace(
          `/apply/?service=${encodeURIComponent(service.code)}&draft=${encodeURIComponent(saved.draftId)}`,
          { scroll: false },
        );
      }
      return saved;
    } catch (error) {
      setSaveError(asGatewayError(error));
      return null;
    }
  }

  /* ------------------------------ actions ---------------------------- */

  function setAnswer(fieldId: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
    setProblems((current) =>
      current.list.some((problem) => problem.fieldId === fieldId)
        ? { ...current, list: current.list.filter((problem) => problem.fieldId !== fieldId) }
        : current,
    );
  }

  function tickDeclaration(ticked: boolean) {
    setDeclared(ticked);
    if (ticked) {
      setProblems((current) => ({
        ...current,
        list: current.list.filter((problem) => problem.fieldId !== DECLARATION_FIELD_ID),
      }));
    }
  }

  /** "Start" and "Continue": check this step, save, then move on. Never advances on a failed save. */
  async function next() {
    const current = steps[stepIndex(steps, stepId)];
    if (!current) return;

    if (current.kind === 'form') {
      const found = validateStep(current.form, effectiveAnswers, evidence);
      if (found.length > 0) return showProblems(found);
    }
    if (current.kind === 'review') {
      const found = validateForm(formSteps, effectiveAnswers, evidence);
      if (!declared) {
        found.push({
          stepId: STEP.review,
          fieldId: DECLARATION_FIELD_ID,
          message: DECLARATION_PROBLEM,
        });
      }
      if (found.length > 0) return showProblems(found);
    }
    if (current.kind === 'verify' && !verified) return;
    if (current.kind === 'payment' && !paymentTaken) return;

    const target = nextStepId(steps, stepId);
    if (!target) return;
    const saved = await persist(target);
    if (!saved) return;
    moveTo(target);
  }

  /** Back never loses answers: they stay in memory, and are saved in the background. */
  function back() {
    const target = previousStepId(steps, stepId);
    if (!target) return;
    moveTo(target);
    if (draft && !saveMutation.isPending) void persist(target);
  }

  /** Jump to a step from the review ("Change") or from a problem that belongs to another step. */
  function goTo(target: string, focusField?: string) {
    if (stepIndex(steps, target) === -1) return;
    moveTo(target, { focusField });
    if (draft && !saveMutation.isPending) void persist(target);
  }

  function retrySave() {
    void persist(stepId);
  }

  /** Saves what is on screen, then leaves. Stays put if the save fails, so nothing is lost. */
  async function saveAndExit(href: string) {
    if (draft && !submitted) {
      const saved = await persist(stepId);
      if (!saved) return;
    }
    router.push(href);
  }

  async function attachEvidence(field: FormField) {
    if (!draft) return;
    removeMutation.reset();
    try {
      const updated = await attachMutation.mutateAsync({ draftId: draft.draftId, field });
      setDraft(updated);
      setProblems((current) => ({
        ...current,
        list: current.list.filter((problem) => problem.fieldId !== field.id),
      }));
      announce('Synthetic placeholder attached. No real file was used.');
    } catch {
      // The safe message is shown beside the button from the mutation's error.
    }
  }

  async function removeEvidence(item: EvidenceItem) {
    if (!draft) return;
    attachMutation.reset();
    try {
      const updated = await removeMutation.mutateAsync({
        draftId: draft.draftId,
        fieldId: item.fieldId,
        evidenceId: item.evidenceId,
      });
      setDraft(updated);
      announce('Synthetic placeholder removed.');
    } catch {
      // Shown beside the button.
    }
  }

  /** The step-up is asked for explicitly here, never silently. */
  async function confirmIdentity() {
    setVerifyShown(true);
    try {
      stepUp();
    } catch {
      // A basic account, or a session signed in with a one-time code, cannot step up.
      setVerifyFailed(true);
      return;
    }
    setVerifyFailed(false);
    setStepUpLapsed(false);
    const target = nextStepId(steps, stepId);
    const saved = target ? await persist(target) : null;
    if (target && saved) {
      moveTo(target, {
        prefix: 'You have confirmed it is you.',
        flash: {
          tone: 'success',
          text: `You have confirmed it is you. This check lasts ${STEP_UP_MINUTES} minutes.`,
        },
      });
    } else {
      announce('You have confirmed it is you.');
    }
  }

  async function pay(outcome: SandboxOutcome) {
    if (!draft || feeCents === null || paymentTaken) return;
    setLastPayment(null);
    let result: PaymentRecord;
    try {
      result = await payMutation.mutateAsync({
        draftId: draft.draftId,
        amountCents: feeCents,
        outcome,
      });
    } catch {
      return; // Shown from the mutation's error.
    }
    setLastPayment(result);
    if (result.status === 'APPROVED') {
      announce('The sandbox approved the payment. No money moved.');
      await persist(stepId, { paymentRef: result.paymentRef });
    }
  }

  /**
   * Sends the application. Only reachable with the declaration ticked by the
   * person: `declarationAccepted` is that tick, never a constant.
   */
  async function submit() {
    if (!draft) return;
    if (!declared) {
      moveTo(STEP.review);
      showProblems([
        { stepId: STEP.review, fieldId: DECLARATION_FIELD_ID, message: DECLARATION_PROBLEM },
      ]);
      return;
    }
    const tier = currentTier(session, new Date());
    if (!meetsTier(tier, service.requiredTier)) {
      // The step-up ran out (or was never done): ask again rather than send and be refused.
      setVerifyShown(true);
      setStepUpLapsed(true);
      moveTo(STEP.verify, {
        steps: buildSteps(service, { includeVerify: true }),
        flash: {
          tone: 'attention',
          text: 'Your identity check has run out. Confirm it is you again, then submit.',
        },
      });
      return;
    }
    try {
      const opened = await submitMutation.mutateAsync({
        draftId: draft.draftId,
        declarationAccepted: declared,
        sessionTier: tier,
      });
      setSubmitted(opened);
      setStepId(STEP.done);
      setNav((count) => count + 1);
      setFlash(null);
      announce('Application received.');
    } catch {
      // The safe message and trace reference are shown beside the button.
    }
  }

  return {
    service,
    session,
    formSteps,
    steps,
    stepId,
    nav,
    pendingFocus,
    flash,
    draft,
    savedAt,
    answers: effectiveAnswers,
    evidence,
    profile,
    usesProfile,
    problems,
    declared,
    feeCents,
    receipt,
    paymentTaken,
    paidRef,
    lastPayment,
    verified,
    verifyFailed,
    submitted,
    saving: saveMutation.isPending,
    saveError,
    evidenceBusyField: attachMutation.isPending
      ? (attachMutation.variables?.field.id ?? null)
      : removeMutation.isPending
        ? (removeMutation.variables?.fieldId ?? null)
        : null,
    evidenceError: attachMutation.error
      ? { fieldId: attachMutation.variables?.field.id ?? null, error: attachMutation.error }
      : removeMutation.error
        ? { fieldId: removeMutation.variables?.fieldId ?? null, error: removeMutation.error }
        : null,
    paying: payMutation.isPending,
    payError: payMutation.error,
    submitting: submitMutation.isPending,
    submitError: submitMutation.error,
    setAnswer,
    tickDeclaration,
    next,
    back,
    goTo,
    retrySave,
    saveAndExit,
    attachEvidence,
    removeEvidence,
    confirmIdentity,
    pay,
    submit,
  };
}

export type ApplicationFlow = ReturnType<typeof useApplication>;
