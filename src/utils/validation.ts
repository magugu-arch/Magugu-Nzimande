/**
 * Form validation. Every rule returns an error string or `null` so screens can
 * render field errors without owning the logic.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** South African mobile numbers: 0XXXXXXXXX or +27XXXXXXXXX. */
const SA_PHONE_RE = /^(?:\+27|0)[6-8]\d{8}$/;
const SA_POSTAL_RE = /^\d{4}$/;

export type Validator = (value: string) => string | null;

export function required(label: string): Validator {
  return (value) => (value.trim().length === 0 ? `${label} is required` : null);
}

export function minLength(label: string, length: number): Validator {
  return (value) =>
    value.trim().length < length ? `${label} must be at least ${length} characters` : null;
}

export const validateEmail: Validator = (value) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Email address is required';
  return EMAIL_RE.test(trimmed) ? null : 'Enter a valid email address';
};

export const validatePhone: Validator = (value) => {
  const cleaned = value.replace(/[\s-]/g, '');
  if (cleaned.length === 0) return 'Mobile number is required';
  return SA_PHONE_RE.test(cleaned) ? null : 'Enter a valid South African mobile number';
};

export const validatePassword: Validator = (value) => {
  if (value.length === 0) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include a letter and a number';
  }
  return null;
};

export const validatePostalCode: Validator = (value) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Postal code is required';
  return SA_POSTAL_RE.test(trimmed) ? null : 'Enter a 4-digit postal code';
};

export const validateOtp: Validator = (value) =>
  /^\d{4}$/.test(value.trim()) ? null : 'Enter the 4-digit code';

/** Normalise a SA number to E.164 for the API. */
export function toE164(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0')) return `+27${cleaned.slice(1)}`;
  return `+27${cleaned}`;
}

/** Run a field map through its validators, returning only the failures. */
export function validateFields<T extends string>(
  values: Record<T, string>,
  validators: Partial<Record<T, Validator>>,
): Partial<Record<T, string>> {
  const errors: Partial<Record<T, string>> = {};
  (Object.keys(validators) as T[]).forEach((field) => {
    const validator = validators[field];
    if (!validator) return;
    const message = validator(values[field] ?? '');
    if (message) errors[field] = message;
  });
  return errors;
}
