import { DomainError } from './errors';

/** §28 SECURITY "Input validation" — the server re-runs all of this; the client runs it for feedback. */

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * South African numbers in any common form — 082 555 0123, +27 82 555 0123,
 * 0027825550123 — normalised to E.164. International numbers are accepted in
 * E.164 form as-is, since visitors book too.
 */
export function normalisePhone(value: string): string | null {
  const digits = value.replace(/[\s()-]/g, '');
  if (/^0[1-9]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^27[1-9]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0027[1-9]\d{8}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

export interface GuestContact {
  name: string;
  email: string;
  phone: string;
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function validateContact(contact: GuestContact): FieldErrors<GuestContact> {
  const errors: FieldErrors<GuestContact> = {};
  const name = contact.name.trim();
  if (name.length < 2) errors.name = 'Please tell us the name for the booking.';
  else if (name.length > 80) errors.name = 'That name is a little long — 80 characters at most.';
  if (!isEmail(contact.email)) errors.email = 'Please enter a valid email address.';
  if (!normalisePhone(contact.phone)) errors.phone = 'Please enter a valid mobile number.';
  return errors;
}

export function assertContact(contact: GuestContact): GuestContact {
  const errors = validateContact(contact);
  const first = Object.values(errors)[0];
  if (first) throw new DomainError('VALIDATION', first, JSON.stringify(errors));
  return {
    name: contact.name.trim(),
    email: contact.email.trim().toLowerCase(),
    phone: normalisePhone(contact.phone) ?? contact.phone,
  };
}

/** Free-text notes: trimmed, length-capped, control characters stripped. */
export function cleanNote(value: string | undefined, max = 500): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!cleaned) return undefined;
  if (cleaned.length > max) {
    throw new DomainError(
      'VALIDATION',
      `Please keep notes under ${max} characters.`,
      'note too long',
    );
  }
  return cleaned;
}
