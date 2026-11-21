/**
 * Adapter ports: the only way the channel apps reach a service domain.
 *
 * In the prototype each port is implemented by an in-browser mock. In a real
 * build the same interface would be implemented by an HTTP client that talks to
 * the API gateway. The apps never see which one they have.
 *
 * Rules every implementation follows:
 *   - reads never mutate; anything that changes state takes `MutationOptions`
 *     so a retry with the same idempotency key cannot apply twice
 *   - failures are thrown as `GatewayError` with a safe user message
 *   - nothing here ever returns a real identity number, document or biometric
 */
import type { AssuranceTier, Channel, MutationOptions } from '@hao/shared-types';
import type {
  AccessFeature,
  AnswerValue,
  ApplicationCase,
  ApplicationDraft,
  Appointment,
  AppointmentSlot,
  AuditEvent,
  CaseEvent,
  ChannelPreference,
  ConceptCredential,
  ConsentRecord,
  FamilyLink,
  GuidanceArticle,
  InboxMessage,
  MessageEvent,
  Partner,
  PaymentRecord,
  PersonAccount,
  ProfileField,
  SearchResult,
  ServiceAlert,
  ServiceDefinition,
  ServiceDomain,
  ServiceDomainInfo,
  ServicePoint,
  ServicePointKind,
  StaffAction,
  StaffMember,
  SupportRequest,
  VerificationRequest,
  WhatsAppOptIn,
  WhatsAppTemplate,
  WhatsAppWebhookEvent,
} from './schemas';

/* ------------------------------------------------------------------ */
/* Identity adapter                                                    */
/* ------------------------------------------------------------------ */

export interface IdentityPort {
  /** Synthetic demo personas offered on the mock sign-in screen. */
  listDemoPersonas(): Promise<PersonAccount[]>;
  getAccount(personToken: string): Promise<PersonAccount>;
  /** Profile values a form can show for confirmation, each labelled with its source. */
  getProfileFields(personToken: string): Promise<ProfileField[]>;
  listFamilyLinks(personToken: string): Promise<FamilyLink[]>;
  listConsents(personToken: string): Promise<ConsentRecord[]>;
  revokeConsent(consentRef: string, options: MutationOptions): Promise<ConsentRecord>;
  /** Wallet concept tiles. Always `CONCEPT_ONLY`. */
  listConceptCredentials(personToken: string): Promise<ConceptCredential[]>;
  /** Passkey interface stub: records that a passkey exists. No WebAuthn ceremony is run. */
  registerPasskey(personToken: string, options: MutationOptions): Promise<PersonAccount>;
  /** Marks a contact channel verified after a mock code check. */
  verifyContact(
    personToken: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP',
    options: MutationOptions,
  ): Promise<PersonAccount>;
  /** Demo staff identities for the staff console sign-in. */
  listDemoStaff(): Promise<StaffMember[]>;
  /** Accredited demo partners for the partner sandbox. */
  listDemoPartners(): Promise<Partner[]>;
  /**
   * Accredited partner check. Returns a yes/no result only, refuses without a
   * live consent or when the attribute is outside the partner's scope, and
   * records every request.
   */
  requestVerification(
    input: {
      partnerRef: string;
      subjectToken: string;
      attribute: VerificationRequest['attribute'];
      purpose: string;
      consentRef: string | null;
    },
    options: MutationOptions,
  ): Promise<VerificationRequest>;
  listVerificationRequests(partnerRef: string): Promise<VerificationRequest[]>;
}

/* ------------------------------------------------------------------ */
/* Service catalogue                                                   */
/* ------------------------------------------------------------------ */

export interface CataloguePort {
  getContentVersion(): Promise<{ version: string; effectiveDate: string; notice: string }>;
  listDomains(): Promise<ServiceDomainInfo[]>;
  listServices(filter?: { domain?: ServiceDomain }): Promise<ServiceDefinition[]>;
  /** Accepts a service code or a slug. */
  getService(codeOrSlug: string): Promise<ServiceDefinition>;
  listGuidance(): Promise<GuidanceArticle[]>;
  /** Plain keyword search over services and guidance. No model is involved. */
  search(query: string): Promise<SearchResult[]>;
}

/* ------------------------------------------------------------------ */
/* Application workflow                                                */
/* ------------------------------------------------------------------ */

export interface SaveDraftInput {
  /** Omit to create a new draft. */
  draftId?: string;
  serviceCode: string;
  applicantToken: string;
  onBehalfOfLinkId?: string | null;
  answers: Record<string, AnswerValue>;
  currentStepId: string;
  servicePointId?: string | null;
  appointmentId?: string | null;
  paymentRef?: string | null;
}

export interface SubmitApplicationInput {
  draftId: string;
  /** Must be the literal `true`: the app never attests on a person's behalf. */
  declarationAccepted: true;
  /** The tier of the session that is submitting, checked against the service. */
  sessionTier: AssuranceTier;
}

export interface QueueFilter {
  queue?: string;
  status?: ApplicationCase['status'];
}

export interface WorkflowPort {
  listDrafts(applicantToken: string): Promise<ApplicationDraft[]>;
  getDraft(draftId: string): Promise<ApplicationDraft>;
  saveDraft(input: SaveDraftInput, options: MutationOptions): Promise<ApplicationDraft>;
  /** Attach or replace a synthetic placeholder for an evidence field. Real files are never accepted. */
  attachSampleEvidence(
    draftId: string,
    fieldId: string,
    documentType: string,
    options: MutationOptions,
  ): Promise<ApplicationDraft>;
  removeEvidence(
    draftId: string,
    evidenceId: string,
    options: MutationOptions,
  ): Promise<ApplicationDraft>;
  deleteDraft(draftId: string, options: MutationOptions): Promise<void>;
  submitApplication(
    input: SubmitApplicationInput,
    options: MutationOptions,
  ): Promise<ApplicationCase>;

  listCases(applicantToken: string): Promise<ApplicationCase[]>;
  getCase(caseId: string): Promise<ApplicationCase>;
  /** Oldest first. */
  listCaseEvents(caseId: string): Promise<CaseEvent[]>;
  /** The applicant chooses where to complete the in-person step. */
  selectServicePoint(
    caseId: string,
    servicePointId: string,
    options: MutationOptions,
  ): Promise<ApplicationCase>;
  /** Called by the appointments flow once a booking exists. */
  linkAppointment(
    caseId: string,
    appointmentId: string,
    options: MutationOptions,
  ): Promise<ApplicationCase>;
  /** The applicant answers a request for information. Free text only; no file contents. */
  provideInformation(
    caseId: string,
    response: string,
    options: MutationOptions,
  ): Promise<ApplicationCase>;
  withdrawCase(caseId: string, options: MutationOptions): Promise<ApplicationCase>;

  /** Staff console. Every action is attributed to the acting official and audited. */
  listQueue(filter?: QueueFilter): Promise<ApplicationCase[]>;
  listQueues(): Promise<string[]>;
  recordStaffAction(
    caseId: string,
    action: StaffAction,
    staffRef: string,
    options: MutationOptions,
  ): Promise<ApplicationCase>;

  /**
   * Prototype control: emit the next plausible workflow event for a case so the
   * event-driven tracker and notifications can be demonstrated. It never
   * records a decision — that always needs a staff action.
   */
  simulateNextEvent(caseId: string, options: MutationOptions): Promise<ApplicationCase>;
}

/* ------------------------------------------------------------------ */
/* Appointments and service points                                     */
/* ------------------------------------------------------------------ */

export interface ServicePointFilter {
  kind?: ServicePointKind;
  serviceCode?: string;
  accessibility?: AccessFeature[];
  /** `true` keeps only points reporting OPEN or LIMITED. */
  openNow?: boolean;
  /** Free text matched against name, area and region. */
  query?: string;
  /** `true` returns only missions abroad; `false` excludes them. */
  abroad?: boolean;
}

export interface BookAppointmentInput {
  personToken: string;
  servicePointId: string;
  slotId: string;
  purpose: string;
  caseId?: string | null;
  draftId?: string | null;
}

export interface AppointmentsPort {
  listServicePoints(filter?: ServicePointFilter): Promise<ServicePoint[]>;
  getServicePoint(id: string): Promise<ServicePoint>;
  /** Synthetic slots for the next few working days. */
  listSlots(servicePointId: string): Promise<AppointmentSlot[]>;
  listAppointments(personToken: string): Promise<Appointment[]>;
  getAppointment(appointmentId: string): Promise<Appointment>;
  book(input: BookAppointmentInput, options: MutationOptions): Promise<Appointment>;
  reschedule(appointmentId: string, slotId: string, options: MutationOptions): Promise<Appointment>;
  cancel(appointmentId: string, options: MutationOptions): Promise<Appointment>;
}

/* ------------------------------------------------------------------ */
/* Payments (sandbox)                                                  */
/* ------------------------------------------------------------------ */

export type SandboxOutcome = 'APPROVE' | 'DECLINE' | 'TIMEOUT';

export interface PaymentsPort {
  createPayment(
    input: {
      personToken: string;
      draftId: string | null;
      caseId: string | null;
      description: string;
      amountCents: number;
    },
    options: MutationOptions,
  ): Promise<PaymentRecord>;
  /** Simulates the hosted payment page returning. No money moves and no card data exists. */
  completeSandboxPayment(
    paymentRef: string,
    outcome: SandboxOutcome,
    options: MutationOptions,
  ): Promise<PaymentRecord>;
  getPayment(paymentRef: string): Promise<PaymentRecord>;
  listPayments(personToken: string): Promise<PaymentRecord[]>;
}

/* ------------------------------------------------------------------ */
/* Notifications, inbox and alerts                                     */
/* ------------------------------------------------------------------ */

export interface NotificationsPort {
  listPreferences(personToken: string): Promise<ChannelPreference[]>;
  /** Switching a channel on records consent; switching it off withdraws it. The secure inbox cannot be switched off. */
  setPreference(
    personToken: string,
    channel: Channel,
    enabled: boolean,
    options: MutationOptions,
  ): Promise<ChannelPreference[]>;
  /** Newest first. */
  listInbox(personToken: string): Promise<InboxMessage[]>;
  getMessage(messageId: string): Promise<InboxMessage>;
  markRead(messageId: string, options: MutationOptions): Promise<InboxMessage>;
  /** Delivery log across channels, newest first: what was sent, suppressed or failed, and why. */
  listMessageEvents(personToken: string): Promise<MessageEvent[]>;
  listAlerts(): Promise<ServiceAlert[]>;
}

/* ------------------------------------------------------------------ */
/* WhatsApp adapter (mock)                                             */
/* ------------------------------------------------------------------ */

export type WhatsAppMenuChoice =
  | 'FIND_SERVICE_POINT'
  | 'GENERAL_GUIDANCE'
  | 'REQUEST_CALLBACK'
  | 'MY_APPLICATION'
  | 'SEND_DOCUMENT';

export interface WhatsAppPort {
  getOptIn(personToken: string): Promise<WhatsAppOptIn>;
  setOptIn(personToken: string, optedIn: boolean, options: MutationOptions): Promise<WhatsAppOptIn>;
  listTemplates(): Promise<WhatsAppTemplate[]>;
  /** The mock conversation and webhook log for this person, oldest first. */
  listWebhookEvents(personToken: string): Promise<WhatsAppWebhookEvent[]>;
  /**
   * Simulates the person tapping a menu button in the chat. Anything personal
   * is answered with a secure hand-off link, and attempts to send a document
   * are refused with an explanation.
   */
  simulateInbound(
    personToken: string,
    choice: WhatsAppMenuChoice,
    options: MutationOptions,
  ): Promise<WhatsAppWebhookEvent[]>;
}

/* ------------------------------------------------------------------ */
/* Support desk                                                        */
/* ------------------------------------------------------------------ */

export interface CreateSupportRequestInput {
  kind: SupportRequest['kind'];
  personToken: string | null;
  caseId: string | null;
  topic: string;
  detail: string;
  preferredTime: string | null;
  contactChannel: SupportRequest['contactChannel'];
  /** Whether the person agreed to pass a case token and summary to the adviser. */
  shareContext: boolean;
}

export interface SupportPort {
  createRequest(
    input: CreateSupportRequestInput,
    options: MutationOptions,
  ): Promise<SupportRequest>;
  listRequests(personToken: string): Promise<SupportRequest[]>;
  /** Staff view of open requests with the context the person agreed to share. */
  listOpenRequests(): Promise<SupportRequest[]>;
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export interface AuditFilter {
  resourceRef?: string;
  actorRef?: string;
  limit?: number;
}

export interface AuditPort {
  /** Append-only. Implementations reject anything that looks like personal data. */
  record(event: Omit<AuditEvent, 'auditId' | 'at'>): Promise<AuditEvent>;
  /** Newest first. */
  list(filter?: AuditFilter): Promise<AuditEvent[]>;
}
