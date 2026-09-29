/**
 * Every failure a guest can see carries a stable `code` (for logs, tests and
 * support) and a human `message` (brief §23: "make all provider errors
 * human-readable while logging technical details server-side").
 */
export type DomainErrorCode =
  | 'NOT_CONFIGURED'
  | 'PROVIDER_UNAVAILABLE'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'SLOT_UNAVAILABLE'
  | 'POLICY_VIOLATION'
  | 'CONFLICT'
  | 'INSUFFICIENT_POINTS'
  | 'NOT_ELIGIBLE'
  | 'ALREADY_REDEEMED'
  | 'EXPIRED'
  | 'SOLD_OUT'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_PENDING'
  | 'FORBIDDEN'
  | 'REAUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'CONSENT_REQUIRED'
  | 'FEATURE_DISABLED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  /** Technical detail for logs. Never rendered to a guest. */
  readonly detail?: string;

  constructor(code: DomainErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.detail = detail;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** What a guest reads when something fails that was not a DomainError. */
export const GENERIC_FAILURE =
  'Something went wrong on our side. Please try again, or contact our reservations team.';

export function guestMessage(error: unknown): string {
  return isDomainError(error) ? error.message : GENERIC_FAILURE;
}

export function notConfigured(provider: string): DomainError {
  return new DomainError(
    'NOT_CONFIGURED',
    'Online booking through this service is not available yet. Our reservations team will gladly help by phone or email.',
    `${provider.toUpperCase().replace(/-/g, '_')}_NOT_CONFIGURED`,
  );
}
