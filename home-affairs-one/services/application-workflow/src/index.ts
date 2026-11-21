/**
 * Application workflow (mock).
 *
 * Drafts, submission, event-driven case status and staff actions for the
 * prototype. It stands in for a DHA workflow system behind the `WorkflowPort`:
 * the case status belongs to this service, every change is recorded as a case
 * event, and each event is published so the tracker and notifications follow.
 *
 * Rules it keeps:
 *   - nothing is submitted without the person's own declaration
 *   - only synthetic evidence placeholders are ever attached
 *   - a decision is only ever recorded by an explicit staff action
 *   - free text from people is kept out of events, which travel on the bus
 */
import {
  type ApplicationCase,
  type ApplicationDraft,
  type CaseEvent,
  type CataloguePort,
  DEMO,
  type EvidenceItem,
  type FormField,
  type ServiceDefinition,
  type ServiceDomain,
  type StaffAction,
  StaffActionSchema,
  type WorkflowPort,
} from '@hao/api-contracts';
import { createCollection, type Platform, TOPICS } from '@hao/local-platform';
import { type ErrorCategory, GatewayError, meetsTier } from '@hao/shared-types';
import {
  applyStep,
  isAwaitingVisit,
  nextRoutineStep,
  openCase,
  type StepMeta,
  steps,
  type WorkflowStep,
} from './lifecycle';
import { hasInPersonStep, isMilestoneDone } from './milestones';
import { buildWorkflowSeed, DEFAULT_RESUME_STEP, DRAFT_LIFETIME, SEED_DRAFT_SERVICE } from './seed';

export { applyStep, nextRoutineStep, openCase, steps, type WorkflowStep } from './lifecycle';
export { ALL_DONE, blankMilestones, type MilestoneMove, milestonesAfter } from './milestones';

const STAFF_REF = /^STAFF-DEMO-\d+$/;
const SERVICE_POINT_ID = /^SP-DEMO-\d+$/;
const APPOINTMENT_ID = /^APPT-DEMO-\d+$/;

const EVIDENCE_PLACEHOLDER = {
  fileLabel: 'Synthetic placeholder — no real file',
  synthetic: true,
  scanStatus: 'NOT_SCANNED',
  retention: 'Deleted when the draft is deleted or the sample data is reset.',
} as const;

const STAFF_ACTION_HELP: Record<StaffAction['type'], string> = {
  START_VALIDATION: 'That action could not be read. Please try again.',
  REQUEST_INFORMATION: 'Write what you need from the applicant in a few words.',
  ESCALATE: 'Give a short reason for passing this to a specialist team.',
  ADVANCE: 'That action could not be read. Please try again.',
  RECORD_DECISION:
    'A decision needs an outcome, a reason category and your confirmation that you reviewed the application yourself.',
};

function fail(category: ErrorCategory, safeMessage: string): GatewayError {
  return new GatewayError(category, { safeMessage });
}

function queueFor(domain: ServiceDomain): string {
  if (domain === 'IDENTITY') return 'Identity documents';
  if (domain === 'PASSPORTS') return 'Passports';
  return 'Civic registration';
}

function isAnswered(field: FormField, draft: ApplicationDraft): boolean {
  if (field.type === 'evidence') return draft.evidence.some((item) => item.fieldId === field.id);
  const answer = draft.answers[field.id];
  if (field.type === 'checkbox') return answer === true;
  return typeof answer === 'string' ? answer.trim() !== '' : answer !== undefined;
}

/** Labels of required fields that have no answer or evidence yet. */
function missingRequired(service: ServiceDefinition, draft: ApplicationDraft): string[] {
  const fields = service.form?.steps.flatMap((step) => step.fields) ?? [];
  return fields.filter((field) => field.required && !isAnswered(field, draft)).map((f) => f.label);
}

function staffActionHelp(action: unknown): string {
  const type =
    typeof action === 'object' && action !== null && 'type' in action ? action.type : undefined;
  return typeof type === 'string' && Object.hasOwn(STAFF_ACTION_HELP, type)
    ? STAFF_ACTION_HELP[type as StaffAction['type']]
    : 'That staff action is not available.';
}

export function createWorkflowService(
  platform: Platform,
  deps: { catalogue: Pick<CataloguePort, 'getService'> },
): WorkflowPort {
  const drafts = createCollection<ApplicationDraft>(
    platform,
    'workflow.drafts',
    (draft) => draft.draftId,
  );
  const cases = createCollection<ApplicationCase>(platform, 'workflow.cases', (c) => c.caseId);
  const events = createCollection<CaseEvent>(platform, 'workflow.events', (e) => e.eventId);

  /**
   * The seeded draft resumes on the second step of its form. Step ids belong to
   * the catalogue, so the name is asked for rather than assumed.
   */
  async function seedResumeStep(): Promise<string> {
    try {
      const service = await deps.catalogue.getService(SEED_DRAFT_SERVICE);
      return service.form?.steps[1]?.id ?? DEFAULT_RESUME_STEP;
    } catch {
      return DEFAULT_RESUME_STEP;
    }
  }

  let seeding: Promise<void> | undefined;

  /** Writes the sample data the first time the service is used on an empty store. */
  function ensureSeeded(): Promise<void> {
    if (cases.exists()) return Promise.resolve();
    seeding ??= seedResumeStep()
      .then((resumeStepId) => {
        // Another instance on the same storage may have seeded while we waited.
        if (cases.exists()) return;
        const seed = buildWorkflowSeed(platform, resumeStepId);
        drafts.replaceAll(seed.drafts);
        events.replaceAll(seed.events);
        cases.replaceAll(seed.cases);
      })
      .finally(() => {
        seeding = undefined;
      });
    return seeding;
  }

  /** A new identifier that no seeded or earlier record already uses. */
  function unusedId(prefix: string, pad: number, taken: (id: string) => boolean): string {
    let id = platform.ids.next(prefix, pad);
    while (taken(id)) id = platform.ids.next(prefix, pad);
    return id;
  }

  function stepMeta(): StepMeta {
    return {
      eventId: platform.ids.next('EVT-DEMO', 0),
      correlationId: platform.ids.next('CORR'),
      at: platform.clock.iso(),
    };
  }

  /** Saves the changed case and its event, then tells everyone listening. */
  function save(result: { next: ApplicationCase; event: CaseEvent }): ApplicationCase {
    cases.put(result.next);
    events.put(result.event);
    platform.bus.publish(TOPICS.caseEvent, result.event);
    return result.next;
  }

  function commit(current: ApplicationCase, step: WorkflowStep): ApplicationCase {
    return save(applyStep(current, step, stepMeta()));
  }

  function isExpired(draft: ApplicationDraft): boolean {
    return Date.parse(draft.expiresAt) <= platform.clock.now().getTime();
  }

  function requireDraft(draftId: string): ApplicationDraft {
    const draft = drafts.get(draftId);
    if (!draft || isExpired(draft)) {
      throw fail(
        'NOT_FOUND',
        'We could not find that draft. It may have been submitted, deleted or expired.',
      );
    }
    return draft;
  }

  function requireCase(caseId: string): ApplicationCase {
    const found = cases.get(caseId);
    if (!found) throw fail('NOT_FOUND', 'We could not find that application.');
    return found;
  }

  function requireOpenCase(caseId: string): ApplicationCase {
    const found = requireCase(caseId);
    if (found.status === 'CLOSED') {
      throw fail('CONFLICT', 'This application is closed, so it can no longer be changed.');
    }
    return found;
  }

  async function requireOnlineService(codeOrSlug: string): Promise<ServiceDefinition> {
    const service = await deps.catalogue.getService(codeOrSlug);
    if (service.availability !== 'APPLY_ONLINE') {
      throw fail(
        'VALIDATION',
        `“${service.title}” cannot be applied for online here yet. The service page explains what you can do instead.`,
      );
    }
    return service;
  }

  function updateDraft(
    draft: ApplicationDraft,
    patch: Partial<ApplicationDraft>,
  ): ApplicationDraft {
    return drafts.put({ ...draft, ...patch, updatedAt: platform.clock.iso() });
  }

  return {
    /* ------------------------------ drafts ------------------------------ */

    async listDrafts(applicantToken) {
      await ensureSeeded();
      return drafts
        .find((draft) => draft.applicantToken === applicantToken && !isExpired(draft))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },

    async getDraft(draftId) {
      await ensureSeeded();
      return requireDraft(draftId);
    },

    async saveDraft(input, _options) {
      await ensureSeeded();
      const service = await requireOnlineService(input.serviceCode);
      if (input.applicantToken.trim() === '') {
        throw fail('FORBIDDEN', 'Sign in to save an application.');
      }
      if (
        Object.values(input.answers).some((v) => typeof v !== 'string' && typeof v !== 'boolean')
      ) {
        throw fail(
          'VALIDATION',
          'One of your answers could not be saved. Please check it and try again.',
        );
      }

      if (input.draftId === undefined) {
        const now = platform.clock.now();
        const draft: ApplicationDraft = {
          draftId: unusedId('DRAFT-DEMO', 4, (id) => drafts.get(id) !== undefined),
          serviceCode: service.code,
          applicantToken: input.applicantToken,
          onBehalfOfLinkId: input.onBehalfOfLinkId ?? null,
          answers: { ...input.answers },
          evidence: [],
          currentStepId: input.currentStepId,
          servicePointId: input.servicePointId ?? null,
          appointmentId: input.appointmentId ?? null,
          paymentRef: input.paymentRef ?? null,
          createdAt: platform.clock.iso(now),
          updatedAt: platform.clock.iso(now),
          expiresAt: platform.clock.iso(new Date(now.getTime() + DRAFT_LIFETIME)),
        };
        return drafts.put(draft);
      }

      const existing = requireDraft(input.draftId);
      if (existing.applicantToken !== input.applicantToken) {
        throw fail('FORBIDDEN', 'This draft belongs to a different account.');
      }
      if (existing.serviceCode !== service.code) {
        throw fail(
          'VALIDATION',
          'A draft cannot be moved to a different service. Start a new application instead.',
        );
      }
      // Only what was sent changes: answers are merged, and optional fields left out are kept.
      return updateDraft(existing, {
        answers: { ...existing.answers, ...input.answers },
        currentStepId: input.currentStepId,
        onBehalfOfLinkId:
          input.onBehalfOfLinkId === undefined ? existing.onBehalfOfLinkId : input.onBehalfOfLinkId,
        servicePointId:
          input.servicePointId === undefined ? existing.servicePointId : input.servicePointId,
        appointmentId:
          input.appointmentId === undefined ? existing.appointmentId : input.appointmentId,
        paymentRef: input.paymentRef === undefined ? existing.paymentRef : input.paymentRef,
      });
    },

    async attachSampleEvidence(draftId, fieldId, documentType, _options) {
      await ensureSeeded();
      const draft = requireDraft(draftId);
      if (fieldId.trim() === '' || documentType.trim() === '') {
        throw fail('VALIDATION', 'Choose which document this sample stands in for.');
      }
      // Real files are never accepted: the item is a labelled stand-in with no content.
      const item: EvidenceItem = {
        evidenceId: platform.ids.next('EVIDENCE-DEMO', 0),
        fieldId,
        documentType,
        ...EVIDENCE_PLACEHOLDER,
        addedAt: platform.clock.iso(),
      };
      return updateDraft(draft, {
        evidence: [...draft.evidence.filter((existing) => existing.fieldId !== fieldId), item],
      });
    },

    async removeEvidence(draftId, evidenceId, _options) {
      await ensureSeeded();
      const draft = requireDraft(draftId);
      if (!draft.evidence.some((item) => item.evidenceId === evidenceId)) return draft;
      return updateDraft(draft, {
        evidence: draft.evidence.filter((item) => item.evidenceId !== evidenceId),
      });
    },

    async deleteDraft(draftId, _options) {
      await ensureSeeded();
      // Deleting something that is already gone is not an error.
      if (drafts.get(draftId)) drafts.remove(draftId);
    },

    async submitApplication(input, _options) {
      await ensureSeeded();
      // The app never attests for the person: anything but an explicit `true` is refused.
      if ((input.declarationAccepted as unknown) !== true) {
        throw fail(
          'VALIDATION',
          'Please read and accept the declaration yourself before submitting.',
        );
      }
      const draft = requireDraft(input.draftId);
      const service = await requireOnlineService(draft.serviceCode);
      if (!meetsTier(input.sessionTier, service.requiredTier)) {
        throw fail(
          'FORBIDDEN',
          'This application needs a stronger identity check before you can submit it. Your answers are saved.',
        );
      }
      const missing = missingRequired(service, draft);
      if (missing.length > 0) {
        throw fail('VALIDATION', `Please complete these before you submit: ${missing.join('; ')}.`);
      }
      if (service.fee.kind === 'SAMPLE' && service.fee.amountCents > 0 && !draft.paymentRef) {
        throw fail('VALIDATION', 'Payment has not been completed.');
      }

      const opened = openCase(
        {
          caseId: unusedId('CASE-DEMO', 6, (id) => cases.get(id) !== undefined),
          serviceCode: service.code,
          serviceTitle: service.title,
          applicantToken: draft.applicantToken,
          onBehalfOfLinkId: draft.onBehalfOfLinkId,
          assignedQueue: queueFor(service.domain),
          servicePointId: draft.servicePointId,
          appointmentId: draft.appointmentId,
          paymentRef: draft.paymentRef,
          needsServicePoint: service.needsServicePoint,
        },
        stepMeta(),
      );
      drafts.remove(draft.draftId);
      return save(opened);
    },

    /* ------------------------------- cases ------------------------------ */

    async listCases(applicantToken) {
      await ensureSeeded();
      return cases
        .find((c) => c.applicantToken === applicantToken)
        .sort((a, b) => Date.parse(b.statusUpdatedAt) - Date.parse(a.statusUpdatedAt));
    },

    async getCase(caseId) {
      await ensureSeeded();
      return requireCase(caseId);
    },

    async listCaseEvents(caseId) {
      await ensureSeeded();
      requireCase(caseId);
      // Events are appended as they happen, so stored order is oldest first.
      return events.find((event) => event.caseId === caseId);
    },

    async selectServicePoint(caseId, servicePointId, _options) {
      await ensureSeeded();
      const current = requireOpenCase(caseId);
      if (!SERVICE_POINT_ID.test(servicePointId)) {
        throw fail('VALIDATION', 'Choose a service point from the list.');
      }
      if (!hasInPersonStep(current.milestones)) {
        throw fail(
          'VALIDATION',
          'This application has no in-person step, so there is no service point to choose.',
        );
      }
      if (isMilestoneDone(current.milestones, 'capture')) {
        throw fail('CONFLICT', 'The in-person step for this application is already complete.');
      }
      if (current.servicePointId === servicePointId) return current;
      return commit(current, steps.servicePointSelected(servicePointId, isAwaitingVisit(current)));
    },

    async linkAppointment(caseId, appointmentId, _options) {
      await ensureSeeded();
      const current = requireOpenCase(caseId);
      if (!APPOINTMENT_ID.test(appointmentId)) {
        throw fail('VALIDATION', 'We could not find that appointment. Please book again.');
      }
      return commit(
        current,
        steps.appointmentLinked(
          appointmentId,
          current.appointmentId !== null,
          isAwaitingVisit(current),
        ),
      );
    },

    async clearAppointment(caseId, _options) {
      await ensureSeeded();
      const current = requireOpenCase(caseId);
      if (current.appointmentId === null) return current;
      return commit(current, steps.appointmentCancelled(isAwaitingVisit(current)));
    },

    async provideInformation(caseId, response, _options) {
      await ensureSeeded();
      const current = requireOpenCase(caseId);
      if (
        current.status !== 'ACTION_REQUIRED' ||
        current.nextAction?.type !== 'PROVIDE_INFORMATION'
      ) {
        throw fail('CONFLICT', 'We have not asked for more information on this application.');
      }
      if (response.trim() === '') {
        throw fail('VALIDATION', 'Please write your answer before sending it.');
      }
      // The reply is acknowledged but not kept: the prototype has no secure store for it.
      return commit(current, steps.informationReceived());
    },

    async withdrawCase(caseId, _options) {
      await ensureSeeded();
      const current = requireCase(caseId);
      if (current.status === 'CLOSED') {
        throw fail('CONFLICT', 'This application is already closed, so it cannot be withdrawn.');
      }
      return commit(current, steps.withdrawn());
    },

    /* ------------------------------- staff ------------------------------ */

    async listQueue(filter) {
      await ensureSeeded();
      return cases
        .find(
          (c) =>
            c.status !== 'CLOSED' &&
            (filter?.queue === undefined || c.assignedQueue === filter.queue) &&
            (filter?.status === undefined || c.status === filter.status),
        )
        .sort((a, b) => Date.parse(a.statusUpdatedAt) - Date.parse(b.statusUpdatedAt));
    },

    async listQueues() {
      return [...DEMO.queues];
    },

    async recordStaffAction(caseId, action, staffRef, _options) {
      await ensureSeeded();
      if (!STAFF_REF.test(staffRef)) {
        throw fail('FORBIDDEN', 'Only a signed-in official can work on an application.');
      }
      const parsed = StaffActionSchema.safeParse(action);
      if (!parsed.success) throw fail('VALIDATION', staffActionHelp(action));
      const current = requireCase(caseId);
      const staffAction = parsed.data;

      switch (staffAction.type) {
        case 'START_VALIDATION':
          if (current.status !== 'SUBMITTED') {
            throw fail('CONFLICT', 'Checks have already started on this application.');
          }
          return commit(current, steps.validationStarted('STAFF'));

        case 'REQUEST_INFORMATION':
          if (['DECISION', 'FULFILMENT', 'CLOSED'].includes(current.status)) {
            throw fail(
              'CONFLICT',
              'This application is past the point where more information can be requested.',
            );
          }
          return commit(current, steps.informationRequested(staffAction.request.trim()));

        case 'ESCALATE':
          if (current.status === 'CLOSED') {
            throw fail('CONFLICT', 'This application is closed.');
          }
          // The reason is for the official's own record; it is not kept on the case or the event.
          return commit(current, steps.referredToSpecialist());

        case 'ADVANCE':
          return commit(current, nextRoutineStep(current, 'STAFF'));

        case 'RECORD_DECISION':
          if (current.status !== 'PROCESSING') {
            throw fail(
              'CONFLICT',
              'A decision can only be recorded while an application is being processed.',
            );
          }
          return commit(
            current,
            steps.decisionRecorded(
              staffAction.outcome,
              staffAction.reasonCategory.trim(),
              staffRef,
              hasInPersonStep(current.milestones),
            ),
          );
      }
    },

    async simulateNextEvent(caseId, _options) {
      await ensureSeeded();
      const current = requireCase(caseId);
      return commit(current, nextRoutineStep(current, 'SYSTEM'));
    },
  };
}
