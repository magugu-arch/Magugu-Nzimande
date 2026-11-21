/**
 * Shared primitives for Home Affairs One.
 *
 * Everything here is a design proposal from the product brief, not an official
 * DHA taxonomy. Identifiers are opaque demo tokens; no real identity numbers
 * are ever represented.
 */

/* ------------------------------------------------------------------ */
/* Identity assurance (brief §12)                                      */
/* ------------------------------------------------------------------ */

export const ASSURANCE_TIERS = ['A0', 'A1', 'A2', 'A3', 'A4'] as const;
export type AssuranceTier = (typeof ASSURANCE_TIERS)[number];

export const ASSURANCE_TIER_INFO: Record<
  AssuranceTier,
  { label: string; summary: string; examples: string }
> = {
  A0: {
    label: 'Public',
    summary: 'No sign-in. No personal information.',
    examples: 'Read service guidance, find a service point, read travel guidance.',
  },
  A1: {
    label: 'Basic account',
    summary: 'Verified contact details and a passkey or second factor.',
    examples: 'Save preferences, receive general reminders, draft non-sensitive forms.',
  },
  A2: {
    label: 'Verified account',
    summary: 'Identity checked to the level the service needs.',
    examples: 'See your case status, book an appointment, manage contact channels.',
  },
  A3: {
    label: 'High assurance',
    summary: 'Strong, approved proof of identity with a step-up check for each sensitive action.',
    examples: 'Submit identity-changing applications, approve legal declarations.',
  },
  A4: {
    label: 'Staff or institution',
    summary: 'Official role with purpose-bound access and enhanced audit.',
    examples: 'Work a case queue or make an accredited verification request.',
  },
};

/** True when `actual` is at least `required`. A4 is a separate workforce tier, not "more than A3". */
export function meetsTier(actual: AssuranceTier, required: AssuranceTier): boolean {
  if (required === 'A4' || actual === 'A4') return actual === required;
  return ASSURANCE_TIERS.indexOf(actual) >= ASSURANCE_TIERS.indexOf(required);
}

/* ------------------------------------------------------------------ */
/* Status taxonomy (brief §16)                                         */
/* ------------------------------------------------------------------ */

export const STATUS_FAMILIES = [
  'DRAFT',
  'SUBMITTED',
  'IN_VALIDATION',
  'ACTION_REQUIRED',
  'SCHEDULED',
  'PROCESSING',
  'DECISION',
  'FULFILMENT',
  'CLOSED',
] as const;
export type StatusFamily = (typeof STATUS_FAMILIES)[number];

export type Tone = 'neutral' | 'info' | 'attention' | 'success' | 'danger';

export const STATUS_INFO: Record<StatusFamily, { userLabel: string; rule: string; tone: Tone }> = {
  DRAFT: {
    userLabel: 'Not submitted',
    rule: 'You can still edit this. Drafts are kept for a limited time.',
    tone: 'neutral',
  },
  SUBMITTED: {
    userLabel: 'Received',
    rule: 'We have your application. Receiving it does not mean it is approved.',
    tone: 'info',
  },
  IN_VALIDATION: {
    userLabel: 'Identity and evidence checks',
    rule: 'We are checking the details and evidence you gave us.',
    tone: 'info',
  },
  ACTION_REQUIRED: {
    userLabel: 'We need something from you',
    rule: 'Your application is paused until you complete the step shown.',
    tone: 'attention',
  },
  SCHEDULED: {
    userLabel: 'Appointment confirmed',
    rule: 'Your appointment is booked. You can reschedule from the application.',
    tone: 'info',
  },
  PROCESSING: {
    userLabel: 'In progress',
    rule: 'Your application is being processed.',
    tone: 'info',
  },
  DECISION: {
    userLabel: 'Decision recorded',
    rule: 'A decision has been recorded by an authorised official. The official notice explains it and any review route.',
    tone: 'info',
  },
  FULFILMENT: {
    userLabel: 'Being prepared',
    rule: 'Your document is being produced or is ready, as shown.',
    tone: 'success',
  },
  CLOSED: {
    userLabel: 'Closed',
    rule: 'This application is complete, withdrawn or cancelled. The history is kept under policy.',
    tone: 'neutral',
  },
};

/* ------------------------------------------------------------------ */
/* Channels (brief §8)                                                 */
/* ------------------------------------------------------------------ */

export const CHANNELS = ['SECURE_INBOX', 'PUSH', 'WHATSAPP', 'EMAIL', 'SMS'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_INFO: Record<
  Channel,
  { label: string; bestFor: string; carries: string; neverCarries: string; optional: boolean }
> = {
  SECURE_INBOX: {
    label: 'Secure inbox',
    bestFor: 'Official notices and documents',
    carries: 'Full status, requests for information, receipts and official letters.',
    neverCarries: 'Messages from unverified third parties.',
    optional: false,
  },
  PUSH: {
    label: 'App notifications',
    bestFor: 'Time-sensitive prompts and reminders',
    carries: 'A general alert, a masked reference and a secure link.',
    neverCarries: 'Identity numbers, biometric details or legal documents.',
    optional: true,
  },
  WHATSAPP: {
    label: 'WhatsApp',
    bestFor: 'Opt-in reminders and simple guided help',
    carries: 'Approved templates, a masked reference and a secure link back to this app.',
    neverCarries: 'Documents, one-time PINs, biometrics or final decisions.',
    optional: true,
  },
  EMAIL: {
    label: 'Email',
    bestFor: 'Receipts and formal correspondence',
    carries: 'Short summaries and secure links to your inbox.',
    neverCarries: 'Identity documents sent to unverified addresses.',
    optional: true,
  },
  SMS: {
    label: 'SMS',
    bestFor: 'Low-data fallback and critical reminders',
    carries: 'A short masked reference and the official short link.',
    neverCarries: 'Case details or identity information.',
    optional: true,
  },
};

/* ------------------------------------------------------------------ */
/* Roles, data classification, feature flags                           */
/* ------------------------------------------------------------------ */

export type Role = 'citizen' | 'staff' | 'partner';

export const DATA_CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

/**
 * Capabilities the brief gates behind flags. The "prototype" profile switches
 * them on as clearly labelled previews; the "pilot" profile leaves them off.
 */
export const FEATURE_FLAGS = [
  'wallet',
  'biometricVerification',
  'aiGuide',
  'partnerIntegrations',
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
export type FeatureFlags = Record<FeatureFlag, boolean>;

export const FEATURE_FLAG_INFO: Record<FeatureFlag, { label: string; gate: string }> = {
  wallet: {
    label: 'Digital wallet',
    gate: 'Future capability. Subject to legal, security and operational approval.',
  },
  biometricVerification: {
    label: 'Biometric verification',
    gate: 'Only under lawful authority, at an approved capture point. Never simulated with real biometrics.',
  },
  aiGuide: {
    label: 'Service guide',
    gate: 'Explains approved, versioned guidance and helps with navigation. Never makes decisions.',
  },
  partnerIntegrations: {
    label: 'Partner integrations',
    gate: 'Accredited institutions only, with purpose, consent and audit on every request.',
  },
};

export const FLAG_PROFILES: Record<'prototype' | 'pilot', FeatureFlags> = {
  prototype: {
    wallet: true,
    biometricVerification: true,
    aiGuide: true,
    partnerIntegrations: true,
  },
  pilot: {
    wallet: false,
    biometricVerification: false,
    aiGuide: false,
    partnerIntegrations: false,
  },
};

/* ------------------------------------------------------------------ */
/* Errors (brief §16: standard categories, safe message, trace ref)    */
/* ------------------------------------------------------------------ */

export const ERROR_CATEGORIES = [
  'OFFLINE',
  'TIMEOUT',
  'UNAVAILABLE',
  'VALIDATION',
  'NOT_FOUND',
  'FORBIDDEN',
  'CONFLICT',
  'RATE_LIMITED',
  'UNKNOWN',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

const SAFE_MESSAGES: Record<ErrorCategory, string> = {
  OFFLINE: 'You appear to be offline. Your work is saved on this device.',
  TIMEOUT: 'That took too long. Nothing was lost — please try again.',
  UNAVAILABLE: 'This service is not available right now. Please try again shortly.',
  VALIDATION: 'Some of the information needs attention before we can continue.',
  NOT_FOUND: 'We could not find that. It may have been moved or closed.',
  FORBIDDEN: 'You need a higher level of verification, or a different role, to do this.',
  CONFLICT: 'This has already been done, or changed since you opened it.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  UNKNOWN: 'Something went wrong on our side. Please try again.',
};

const RETRYABLE: ReadonlySet<ErrorCategory> = new Set([
  'OFFLINE',
  'TIMEOUT',
  'UNAVAILABLE',
  'RATE_LIMITED',
]);

/**
 * The only error type that crosses the gateway. It carries a message that is
 * safe to show a member of the public and a trace reference for support —
 * never a stack trace, internal detail or personal information.
 */
export class GatewayError extends Error {
  readonly category: ErrorCategory;
  readonly safeMessage: string;
  readonly traceRef: string;
  readonly retryable: boolean;

  constructor(category: ErrorCategory, options: { safeMessage?: string; traceRef?: string } = {}) {
    const safeMessage = options.safeMessage ?? SAFE_MESSAGES[category];
    super(safeMessage);
    this.name = 'GatewayError';
    this.category = category;
    this.safeMessage = safeMessage;
    this.traceRef = options.traceRef ?? 'TRACE-UNSET';
    this.retryable = RETRYABLE.has(category);
  }
}

export function isGatewayError(value: unknown): value is GatewayError {
  return value instanceof GatewayError;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Mask all but the last four characters of a reference: `CASE-DEMO-002481` → `••••2481`. */
export function maskReference(reference: string): string {
  const tail = reference.replace(/[^A-Za-z0-9]/g, '').slice(-4);
  return `••••${tail}`;
}

/** Every call that changes something carries one, so a retry can never apply twice. */
export interface MutationOptions {
  idempotencyKey: string;
}
