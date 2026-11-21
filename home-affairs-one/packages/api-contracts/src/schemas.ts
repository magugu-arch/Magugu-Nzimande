/**
 * Contract schemas for every mocked integration.
 *
 * These are prototype contracts for interface design. They are not real DHA
 * APIs, schemas or status contracts. Every record is synthetic: people are
 * opaque `PERSON-DEMO-…` tokens and no national identity number, passport
 * number, biometric or real document is ever represented.
 */
import {
  ASSURANCE_TIERS,
  CHANNELS,
  DATA_CLASSIFICATIONS,
  STATUS_FAMILIES,
} from '@hao/shared-types';
import { z } from 'zod';

/** ISO 8601 date-time with an offset, e.g. `2026-11-21T10:40:00+02:00`. */
export const IsoDateTime = z.iso.datetime({ offset: true });
export const AssuranceTierSchema = z.enum(ASSURANCE_TIERS);
export const StatusFamilySchema = z.enum(STATUS_FAMILIES);
export const ChannelSchema = z.enum(CHANNELS);
export const DataClassificationSchema = z.enum(DATA_CLASSIFICATIONS);

/* ------------------------------------------------------------------ */
/* Person account, family links, consent, concept credentials          */
/* ------------------------------------------------------------------ */

export const PersonaKindSchema = z.enum(['citizen', 'guardian', 'traveller', 'citizen-abroad']);
export type PersonaKind = z.infer<typeof PersonaKindSchema>;

export const ContactSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  /** Always masked, e.g. `t•••••@example.org`. Full values are never held by the channel app. */
  maskedValue: z.string(),
  verified: z.boolean(),
  verifiedAt: IsoDateTime.nullable(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const PersonAccountSchema = z.object({
  personToken: z.string().regex(/^PERSON-DEMO-[A-Z0-9]{4}$/),
  displayName: z.string(),
  givenName: z.string(),
  initials: z.string().max(2),
  personaKind: PersonaKindSchema,
  personaSummary: z.string(),
  locale: z.string(),
  residency: z.enum(['IN_SOUTH_AFRICA', 'ABROAD', 'VISITOR']),
  /** Highest identity-proofing level this demo account has reached. */
  assuranceTier: AssuranceTierSchema,
  verifiedAt: IsoDateTime.nullable(),
  contacts: z.array(ContactSchema),
  passkeyRegistered: z.boolean(),
  recoveryState: z.enum(['READY', 'INCOMPLETE']),
  synthetic: z.literal(true),
});
export type PersonAccount = z.infer<typeof PersonAccountSchema>;

/** A profile value shown for confirmation in a form, with where it came from. */
export const ProfileFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  source: z.enum(['IDENTITY_ADAPTER_MOCK', 'YOU_PROVIDED']),
});
export type ProfileField = z.infer<typeof ProfileFieldSchema>;

export const FamilyLinkSchema = z.object({
  linkId: z.string(),
  personToken: z.string(),
  relatedDisplayName: z.string(),
  relatedInitials: z.string().max(2),
  relationship: z.enum(['CHILD', 'DEPENDANT', 'DELEGATE']),
  authority: z.enum(['GUARDIAN', 'DELEGATED']),
  verification: z.enum(['VERIFIED', 'PENDING', 'NOT_VERIFIED']),
  /** What this link allows, in plain language. */
  scope: z.array(z.string()),
  expiresAt: IsoDateTime.nullable(),
});
export type FamilyLink = z.infer<typeof FamilyLinkSchema>;

export const ConsentRecordSchema = z.object({
  consentRef: z.string().regex(/^CONSENT-DEMO-\d+$/),
  personToken: z.string(),
  purpose: z.string(),
  recipient: z.string(),
  attributes: z.array(z.string()),
  legalBasis: z.string(),
  grantedAt: IsoDateTime,
  expiresAt: IsoDateTime.nullable(),
  revokedAt: IsoDateTime.nullable(),
});
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

/** Wallet tiles are a design concept only. Nothing here is a valid credential. */
export const ConceptCredentialSchema = z.object({
  credentialId: z.string(),
  type: z.enum(['DIGITAL_ID', 'BIRTH_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'TRAVEL_AUTHORISATION']),
  title: z.string(),
  description: z.string(),
  /** Attributes a verifier could be shown; names only, never values. */
  claimNames: z.array(z.string()),
  status: z.literal('CONCEPT_ONLY'),
});
export type ConceptCredential = z.infer<typeof ConceptCredentialSchema>;

/* ------------------------------------------------------------------ */
/* Service catalogue (versioned sample content)                        */
/* ------------------------------------------------------------------ */

export const ServiceDomainSchema = z.enum([
  'IDENTITY',
  'PASSPORTS',
  'BIRTH_FAMILY',
  'MARRIAGE',
  'DEATH',
  'CITIZENSHIP',
  'IMMIGRATION',
  'TRAVEL',
  'SUPPORT',
]);
export type ServiceDomain = z.infer<typeof ServiceDomainSchema>;

export const ServiceChannelSchema = z.enum([
  'ONLINE',
  'SERVICE_OFFICE',
  'PARTNER_BANK',
  'MOBILE_UNIT',
  'MISSION_ABROAD',
]);
export type ServiceChannel = z.infer<typeof ServiceChannelSchema>;

export const FormFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().optional(),
  /** Why the service needs this item (brief §9: "show why a data item is needed"). */
  why: z.string().optional(),
  type: z.enum(['text', 'textarea', 'select', 'radio', 'checkbox', 'date', 'evidence']),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  /** When set, the field is pre-filled from the profile and shown for confirmation. */
  profileKey: z.string().optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

export const FormStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  intro: z.string(),
  fields: z.array(FormFieldSchema),
});
export type FormStep = z.infer<typeof FormStepSchema>;

/** Fees are never invented: a service either has a clearly labelled sample amount, or none yet. */
export const FeeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('SAMPLE'),
    amountCents: z.number().int().nonnegative(),
    currency: z.literal('ZAR'),
    note: z.string(),
  }),
  z.object({ kind: z.literal('TO_BE_CONFIRMED'), note: z.string() }),
]);
export type Fee = z.infer<typeof FeeSchema>;

export const ServiceDefinitionSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  domain: ServiceDomainSchema,
  /** An action label in plain language: "Replace a Smart ID", not a form number. */
  title: z.string(),
  summary: z.string(),
  availability: z.enum(['APPLY_ONLINE', 'GUIDANCE_AND_HANDOFF', 'INFORMATION_ONLY']),
  release: z.enum(['MVP', 'PHASE_2', 'PHASE_3']),
  /** Assurance tier needed to submit. Reading guidance is always A0. */
  requiredTier: AssuranceTierSchema,
  audience: z.array(PersonaKindSchema),
  /** How the journey works, step by step, in plain language. */
  journey: z.array(z.object({ title: z.string(), detail: z.string() })),
  /** Placeholder requirements. Labelled as sample until a DHA service owner verifies them. */
  requirements: z.array(z.object({ id: z.string(), label: z.string(), detail: z.string() })),
  fee: FeeSchema,
  channels: z.array(ServiceChannelSchema),
  form: z.object({ steps: z.array(FormStepSchema) }).optional(),
  /** Whether the journey needs an in-person capture / collection step at a service point. */
  needsServicePoint: z.boolean(),
  /** For guidance-and-hand-off services: where the journey continues. */
  handoff: z
    .object({ label: z.string(), description: z.string(), destination: z.string() })
    .optional(),
  /** "No dead ends": why it cannot be completed here, and what to do instead. */
  unavailable: z
    .object({ reason: z.string(), whatNext: z.string(), alternatives: z.array(z.string()) })
    .optional(),
  /** Important limits to state plainly, e.g. "a receipt is not travel authorisation". */
  cautions: z.array(z.string()),
  assetId: z.string().regex(/^A\d{2}$/),
  contentVersion: z.string(),
  effectiveDate: z.string(),
  sample: z.literal(true),
});
export type ServiceDefinition = z.infer<typeof ServiceDefinitionSchema>;

export const ServiceDomainInfoSchema = z.object({
  domain: ServiceDomainSchema,
  title: z.string(),
  summary: z.string(),
  assetId: z.string().regex(/^A\d{2}$/),
});
export type ServiceDomainInfo = z.infer<typeof ServiceDomainInfoSchema>;

export const GuidanceArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Plain-language paragraphs. */
  body: z.array(z.string()),
  serviceCodes: z.array(z.string()),
  tags: z.array(z.string()),
  contentVersion: z.string(),
  effectiveDate: z.string(),
  sample: z.literal(true),
});
export type GuidanceArticle = z.infer<typeof GuidanceArticleSchema>;

export const SearchResultSchema = z.object({
  kind: z.enum(['SERVICE', 'GUIDANCE', 'CASE', 'SERVICE_POINT']),
  id: z.string(),
  title: z.string(),
  snippet: z.string(),
  href: z.string(),
  /** For guidance: the citation the guide must show. */
  citation: z.string().optional(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

/* ------------------------------------------------------------------ */
/* Applications: drafts, cases, events, evidence                       */
/* ------------------------------------------------------------------ */

export const EvidenceItemSchema = z.object({
  evidenceId: z.string(),
  fieldId: z.string(),
  documentType: z.string(),
  /** Only synthetic placeholders can be attached in the prototype. */
  fileLabel: z.string(),
  synthetic: z.literal(true),
  addedAt: IsoDateTime,
  scanStatus: z.enum(['NOT_SCANNED', 'CLEAN']),
  retention: z.string(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const AnswerValueSchema = z.union([z.string(), z.boolean()]);
export type AnswerValue = z.infer<typeof AnswerValueSchema>;

export const ApplicationDraftSchema = z.object({
  draftId: z.string().regex(/^DRAFT-DEMO-\d+$/),
  serviceCode: z.string(),
  applicantToken: z.string(),
  /** Set when a guardian or delegate applies for someone else. */
  onBehalfOfLinkId: z.string().nullable(),
  answers: z.record(z.string(), AnswerValueSchema),
  evidence: z.array(EvidenceItemSchema),
  currentStepId: z.string(),
  servicePointId: z.string().nullable(),
  appointmentId: z.string().nullable(),
  paymentRef: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  expiresAt: IsoDateTime,
});
export type ApplicationDraft = z.infer<typeof ApplicationDraftSchema>;

export const NextActionSchema = z.object({
  type: z.enum([
    'SELECT_SERVICE_POINT',
    'BOOK_APPOINTMENT',
    'PROVIDE_INFORMATION',
    'ATTEND_APPOINTMENT',
    'COLLECT',
  ]),
  description: z.string(),
  dueAt: IsoDateTime.nullable(),
});
export type NextAction = z.infer<typeof NextActionSchema>;

export const MilestoneSchema = z.object({
  key: z.string(),
  label: z.string(),
  state: z.enum(['done', 'current', 'upcoming']),
  at: IsoDateTime.nullable(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const ApplicationCaseSchema = z.object({
  caseId: z.string().regex(/^CASE-DEMO-\d{6}$/),
  serviceCode: z.string(),
  serviceTitle: z.string(),
  applicantToken: z.string(),
  onBehalfOfLinkId: z.string().nullable(),
  status: StatusFamilySchema,
  /** Short user-facing state within the family, e.g. "In production". */
  statusDetail: z.string(),
  statusUpdatedAt: IsoDateTime,
  submittedAt: IsoDateTime,
  nextAction: NextActionSchema.nullable(),
  milestones: z.array(MilestoneSchema),
  assignedQueue: z.string(),
  servicePointId: z.string().nullable(),
  appointmentId: z.string().nullable(),
  paymentRef: z.string().nullable(),
  /** Recorded by an authorised official only; never set by automation. */
  decision: z
    .object({
      outcome: z.enum(['APPROVED', 'DECLINED', 'REFERRED']),
      reasonCategory: z.string(),
      decidedByRef: z.string(),
      decidedAt: IsoDateTime,
      reviewRoute: z.string(),
    })
    .nullable(),
  dataClassification: DataClassificationSchema,
  sourceOfTruth: z.literal('DHA_WORKFLOW_ADAPTER_MOCK'),
});
export type ApplicationCase = z.infer<typeof ApplicationCaseSchema>;

export const CaseEventTypeSchema = z.enum([
  'SUBMITTED',
  'VALIDATION_STARTED',
  'INFORMATION_REQUESTED',
  'INFORMATION_RECEIVED',
  'SERVICE_POINT_SELECTED',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_CHANGED',
  'CAPTURE_COMPLETED',
  'PROCESSING_STARTED',
  'REFERRED_TO_SPECIALIST',
  'DECISION_RECORDED',
  'PRODUCTION_STARTED',
  'READY_FOR_COLLECTION',
  'COLLECTED',
  'WITHDRAWN',
]);
export type CaseEventType = z.infer<typeof CaseEventTypeSchema>;

export const CaseEventSchema = z.object({
  eventId: z.string().regex(/^EVT-DEMO-\d+$/),
  caseId: z.string(),
  type: CaseEventTypeSchema,
  at: IsoDateTime,
  /** Status family after this event. */
  status: StatusFamilySchema,
  title: z.string(),
  detail: z.string().nullable(),
  actor: z.enum(['SYSTEM', 'APPLICANT', 'STAFF']),
  correlationId: z.string(),
});
export type CaseEvent = z.infer<typeof CaseEventSchema>;

/* ------------------------------------------------------------------ */
/* Service points and appointments (synthetic locations)               */
/* ------------------------------------------------------------------ */

export const ServicePointKindSchema = z.enum([
  'SERVICE_OFFICE',
  'PARTNER_BANK',
  'MOBILE_UNIT',
  'KIOSK',
  'MISSION_ABROAD',
]);
export type ServicePointKind = z.infer<typeof ServicePointKindSchema>;

export const AccessFeatureSchema = z.enum([
  'STEP_FREE',
  'ACCESSIBLE_PARKING',
  'HEARING_LOOP',
  'SIGN_LANGUAGE_BY_BOOKING',
  'QUIET_HOUR',
  'ASSISTED_DIGITAL',
]);
export type AccessFeature = z.infer<typeof AccessFeatureSchema>;

export const PointCapabilitySchema = z.enum([
  'APPLICATIONS',
  'IDENTITY_CAPTURE',
  'COLLECTION',
  'PAYMENTS',
  'SELF_SERVICE',
]);
export type PointCapability = z.infer<typeof PointCapabilitySchema>;

export const ServicePointSchema = z.object({
  id: z.string().regex(/^SP-DEMO-\d+$/),
  /** Obviously synthetic, e.g. "Sample service office — Demo Central". Never a real office name. */
  name: z.string(),
  kind: ServicePointKindSchema,
  area: z.string(),
  region: z.string(),
  country: z.string(),
  address: z.string(),
  /** Position on the schematic (not geographic) map, 0–100 on each axis. */
  position: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
  services: z.array(z.string()),
  capabilities: z.array(PointCapabilitySchema),
  accessibility: z.array(AccessFeatureSchema),
  hours: z.array(z.object({ days: z.string(), open: z.string(), close: z.string() })),
  timeZone: z.string(),
  availability: z.enum(['OPEN', 'LIMITED', 'CLOSED_TODAY', 'NOT_REPORTED']),
  availabilityNote: z.string(),
  assetId: z.string().regex(/^A\d{2}$/),
  synthetic: z.literal(true),
});
export type ServicePoint = z.infer<typeof ServicePointSchema>;

export const AppointmentSlotSchema = z.object({
  slotId: z.string(),
  servicePointId: z.string(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  available: z.boolean(),
});
export type AppointmentSlot = z.infer<typeof AppointmentSlotSchema>;

export const AppointmentSchema = z.object({
  appointmentId: z.string().regex(/^APPT-DEMO-\d+$/),
  personToken: z.string(),
  caseId: z.string().nullable(),
  draftId: z.string().nullable(),
  servicePointId: z.string(),
  servicePointName: z.string(),
  purpose: z.string(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  timeZone: z.string(),
  status: z.enum(['BOOKED', 'CANCELLED', 'ATTENDED']),
  bookedAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Appointment = z.infer<typeof AppointmentSchema>;

/* ------------------------------------------------------------------ */
/* Payments (sandbox only)                                             */
/* ------------------------------------------------------------------ */

export const PaymentRecordSchema = z.object({
  paymentRef: z.string().regex(/^PAY-DEMO-\d+$/),
  personToken: z.string(),
  draftId: z.string().nullable(),
  caseId: z.string().nullable(),
  description: z.string(),
  amountCents: z.number().int().nonnegative(),
  currency: z.literal('ZAR'),
  status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'TIMED_OUT']),
  /** Opaque provider token. No card data ever reaches the app. */
  providerToken: z.string(),
  receiptNumber: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  sandbox: z.literal(true),
});
export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

/* ------------------------------------------------------------------ */
/* Notifications, inbox, alerts, WhatsApp                              */
/* ------------------------------------------------------------------ */

export const ChannelPreferenceSchema = z.object({
  channel: ChannelSchema,
  enabled: z.boolean(),
  purpose: z.literal('TRANSACTIONAL'),
  language: z.string(),
  consentRef: z.string().nullable(),
  consentedAt: IsoDateTime.nullable(),
  updatedAt: IsoDateTime,
});
export type ChannelPreference = z.infer<typeof ChannelPreferenceSchema>;

export const InboxMessageSchema = z.object({
  messageId: z.string().regex(/^MSG-DEMO-\d+$/),
  recipientToken: z.string(),
  caseId: z.string().nullable(),
  category: z.enum([
    'CASE_UPDATE',
    'ACTION_REQUIRED',
    'RECEIPT',
    'APPOINTMENT',
    'SECURITY',
    'SERVICE_NOTICE',
  ]),
  subject: z.string(),
  body: z.array(z.string()),
  sentAt: IsoDateTime,
  readAt: IsoDateTime.nullable(),
  action: z.object({ label: z.string(), href: z.string() }).nullable(),
  templateKey: z.string(),
  contentVersion: z.string(),
});
export type InboxMessage = z.infer<typeof InboxMessageSchema>;

/** One delivery attempt on one channel. Carries no message content beyond a masked reference. */
export const MessageEventSchema = z.object({
  eventId: z.string().regex(/^NTF-DEMO-\d+$/),
  channel: ChannelSchema,
  templateKey: z.string(),
  recipientToken: z.string(),
  caseId: z.string().nullable(),
  maskedReference: z.string().nullable(),
  consentState: z.enum(['CONSENTED', 'NOT_CONSENTED', 'NOT_REQUIRED']),
  deliveryStatus: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SUPPRESSED']),
  /** Why a message was not sent, in plain language, e.g. "You have switched this channel off". */
  note: z.string().nullable(),
  at: IsoDateTime,
  contentVersion: z.string(),
});
export type MessageEvent = z.infer<typeof MessageEventSchema>;

/** The only shape allowed out to an external channel (brief, Appendix B). */
export const SafeNotificationPayloadSchema = z.object({
  eventId: z.string(),
  channel: z.enum(['WHATSAPP_TEMPLATE', 'SMS', 'EMAIL', 'PUSH']),
  recipientToken: z.string(),
  templateKey: z.string(),
  maskedReference: z.string().regex(/^••••[A-Za-z0-9]{4}$/),
  message: z.string().max(160),
  secureDeepLink: z.url(),
  consentRef: z.string(),
  expiresAt: IsoDateTime,
});
export type SafeNotificationPayload = z.infer<typeof SafeNotificationPayloadSchema>;

export const ServiceAlertSchema = z.object({
  alertId: z.string(),
  kind: z.enum(['DISRUPTION', 'SERVICE_CHANGE', 'FRAUD_WARNING', 'TRAVEL']),
  severity: z.enum(['info', 'attention']),
  title: z.string(),
  body: z.string(),
  publishedAt: IsoDateTime,
  sample: z.literal(true),
});
export type ServiceAlert = z.infer<typeof ServiceAlertSchema>;

export const WhatsAppTemplateSchema = z.object({
  templateKey: z.string(),
  category: z.enum(['UTILITY', 'AUTHENTICATION_NOT_USED']),
  purpose: z.string(),
  /** Template text with `{{maskedReference}}` and `{{link}}` placeholders only. */
  text: z.string(),
  approved: z.boolean(),
  version: z.string(),
});
export type WhatsAppTemplate = z.infer<typeof WhatsAppTemplateSchema>;

export const WhatsAppOptInSchema = z.object({
  personToken: z.string(),
  optedIn: z.boolean(),
  consentRef: z.string().nullable(),
  changedAt: IsoDateTime.nullable(),
});
export type WhatsAppOptIn = z.infer<typeof WhatsAppOptInSchema>;

export const WhatsAppWebhookEventSchema = z.object({
  webhookId: z.string(),
  personToken: z.string(),
  direction: z.enum(['OUTBOUND', 'INBOUND']),
  kind: z.enum([
    'OPT_IN',
    'OPT_OUT',
    'TEMPLATE_SENT',
    'DELIVERED',
    'READ',
    'MENU_CHOICE',
    'HANDOFF_LINK_SENT',
    'BLOCKED_UNSAFE_CONTENT',
  ]),
  /** What was shown in the chat. Templates and menu text only — never case details. */
  text: z.string(),
  templateKey: z.string().nullable(),
  at: IsoDateTime,
});
export type WhatsAppWebhookEvent = z.infer<typeof WhatsAppWebhookEventSchema>;

/* ------------------------------------------------------------------ */
/* Support, audit, staff, partner                                      */
/* ------------------------------------------------------------------ */

export const SupportRequestSchema = z.object({
  requestId: z.string().regex(/^HELP-DEMO-\d+$/),
  kind: z.enum(['CALLBACK', 'COMPLAINT', 'FEEDBACK']),
  personToken: z.string().nullable(),
  caseId: z.string().nullable(),
  topic: z.string(),
  detail: z.string().max(1000),
  preferredTime: z.string().nullable(),
  contactChannel: z.enum(['PHONE', 'EMAIL', 'SECURE_INBOX']),
  status: z.enum(['RECEIVED', 'IN_PROGRESS', 'RESOLVED']),
  createdAt: IsoDateTime,
  /** The minimum context the person agreed to pass to the adviser. */
  sharedContext: z.object({
    consented: z.boolean(),
    caseToken: z.string().nullable(),
    summary: z.string().nullable(),
  }),
});
export type SupportRequest = z.infer<typeof SupportRequestSchema>;

export const AuditEventSchema = z.object({
  auditId: z.string().regex(/^AUD-DEMO-\d+$/),
  at: IsoDateTime,
  /** Opaque reference only: a person token, staff ref or partner ref. Never a name or contact. */
  actor: z.object({ role: z.enum(['citizen', 'staff', 'partner', 'system']), ref: z.string() }),
  action: z.string(),
  resource: z.object({ type: z.string(), ref: z.string() }),
  purpose: z.string(),
  outcome: z.enum(['SUCCESS', 'DENIED', 'FAILED']),
  channel: z.enum(['WEB', 'STAFF_CONSOLE', 'PARTNER_API', 'SYSTEM']),
  correlationId: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const StaffMemberSchema = z.object({
  staffRef: z.string().regex(/^STAFF-DEMO-\d+$/),
  displayName: z.string(),
  initials: z.string().max(2),
  role: z.enum(['CASE_OFFICER', 'SUPERVISOR']),
  queues: z.array(z.string()),
  synthetic: z.literal(true),
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;

export const StaffActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START_VALIDATION') }),
  z.object({ type: z.literal('REQUEST_INFORMATION'), request: z.string().min(5) }),
  z.object({ type: z.literal('ESCALATE'), reason: z.string().min(5) }),
  z.object({ type: z.literal('ADVANCE'), note: z.string().optional() }),
  z.object({
    type: z.literal('RECORD_DECISION'),
    outcome: z.enum(['APPROVED', 'DECLINED', 'REFERRED']),
    reasonCategory: z.string().min(3),
    /** The official must confirm they reviewed the case themselves. */
    reviewedByHuman: z.literal(true),
  }),
]);
export type StaffAction = z.infer<typeof StaffActionSchema>;

export const PartnerSchema = z.object({
  partnerRef: z.string().regex(/^PARTNER-DEMO-\d+$/),
  name: z.string(),
  sector: z.string(),
  /** What this accredited partner is allowed to ask. */
  scopes: z.array(z.enum(['IDENTITY_CONFIRMED', 'OVER_18', 'DOCUMENT_STATUS'])),
  synthetic: z.literal(true),
});
export type Partner = z.infer<typeof PartnerSchema>;

export const VerificationRequestSchema = z.object({
  requestId: z.string().regex(/^VERIFY-DEMO-\d+$/),
  partnerRef: z.string(),
  subjectToken: z.string(),
  attribute: z.enum(['IDENTITY_CONFIRMED', 'OVER_18', 'DOCUMENT_STATUS']),
  purpose: z.string(),
  consentRef: z.string().nullable(),
  /** A yes/no answer only. No underlying data is ever returned to the partner. */
  result: z.enum(['CONFIRMED', 'NOT_CONFIRMED', 'REFUSED_NO_CONSENT', 'REFUSED_OUT_OF_SCOPE']),
  at: IsoDateTime,
});
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;
