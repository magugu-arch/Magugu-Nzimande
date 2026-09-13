/**
 * Form validation. Every rule returns an error string or `null` so screens can
 * render field errors without owning the logic.
 */

/**
 * The last label may not be empty, which is what a trailing dot leaves.
 *
 * `[^\s@]{2,}` matched "co.za." and let `thandi@example.co.za.` through — a
 * typo nobody makes deliberately and nothing downstream catches. It costs more
 * than it used to: registration creates every customer unverified, so the
 * verification mail goes nowhere and the badge on their profile can never
 * clear. Excluding the dot from the final label is the whole fix.
 *
 * Deliberately no stricter than that. Over-tightened email patterns reject
 * real addresses, and the address is proved by the mail arriving, not by this.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;
/** The nine digits of a South African mobile number: 6, 7 or 8, then eight. */
const SA_MOBILE_RE = /^[6-8]\d{8}$/;
const SA_POSTAL_RE = /^\d{4}$/;

export type Validator = (value: string) => string | null;

export function required(label: string): Validator {
  return (value) => (value.trim().length === 0 ? `${label} is required` : null);
}

export function minLength(label: string, length: number): Validator {
  return (value) =>
    value.trim().length < length ? `${label} must be at least ${length} characters` : null;
}

/**
 * The other half of `minLength`, which was missing.
 *
 * This vocabulary had a floor and no ceiling, and the consequence was not
 * theoretical: of every text field in the app only five capped what could be
 * typed — the OTP box, a postal code, a product note, a support message and a
 * rating comment. Every part of a delivery address was unbounded, so four
 * hundred characters of "Suburb" saved, persisted, and went to the kitchen and
 * the driver.
 *
 * `audit:long` found it. The layout half of that is fixed in `ui/Text` and is
 * a real fix; this is the other half, and it is a **guardrail rather than a
 * rule**. Nobody has told me what the backend accepts in a `suburb`, and a
 * limit invented here could reject a real address — so the numbers applied are
 * deliberately generous: comfortably above the longest genuine address the
 * sweep renders correctly (91 characters on its longest line), and far below
 * anything that reads as a mistake or an attack.
 *
 * What the real limits are is a backend contract and sits in `audit:launch`
 * under "only you can supply". If your API says 60, this should say 60.
 */
export function maxLength(label: string, length: number): Validator {
  return (value) =>
    value.trim().length > length ? `${label} must be ${length} characters or fewer` : null;
}

/**
 * Both ends of a field, in the order a customer meets them.
 *
 * `validateFields` takes one validator per field, so a field that needs to be
 * present *and* bounded needs them composed rather than listed. Emptiness is
 * reported first because "Suburb is required" is the more useful sentence to
 * somebody who has typed nothing at all.
 */
export function all(...validators: Validator[]): Validator {
  return (value) => {
    for (const validate of validators) {
      const message = validate(value);
      if (message !== null) return message;
    }
    return null;
  };
}

export const validateEmail: Validator = (value) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Email address is required';
  return EMAIL_RE.test(trimmed) ? null : 'Enter a valid email address';
};

/**
 * The nine significant digits of a South African mobile number, or null.
 *
 * One parser, because the rule was written twice — a regex that tested the
 * number and a normaliser that rewrote it — and the two disagreed about which
 * spellings count. Everything except digits is thrown away first, which is
 * what the old pair got wrong: they stripped spaces and hyphens and nothing
 * else, so two forms people write every day were refused.
 *
 *     "(082) 123 4567"       rejected, and normalised to +27(082)1234567
 *     "+27 (0)82 123 4567"   rejected, and normalised to +27(0)821234567
 *     "27821234567"          rejected, and normalised to +2727821234567
 *
 * The last is the one worth dwelling on: two country codes. The normaliser had
 * no idea whether it was being handed a national or an international number,
 * so it guessed national and prefixed one anyway.
 *
 * Four shapes come to the same nine digits — a leading 0, a leading 27, the
 * written `+27 (0)` form that carries both, and the bare nine. Anything else,
 * including a landline and any other country's number, is not one of these.
 */
export function saMobileNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  // 27 82 123 4567, with or without the +. Eleven digits.
  const national =
    digits.startsWith('270') && digits.length === 12
      ? // +27 (0)82 …, which carries the country code and the trunk 0 both.
        digits.slice(3)
      : digits.startsWith('27') && digits.length === 11
        ? digits.slice(2)
        : digits.startsWith('0') && digits.length === 10
          ? digits.slice(1)
          : digits.length === 9
            ? digits
            : null;

  return national !== null && SA_MOBILE_RE.test(national) ? national : null;
}

export const validatePhone: Validator = (value) => {
  if (value.trim().length === 0) return 'Mobile number is required';
  return saMobileNumber(value) ? null : 'Enter a valid South African mobile number';
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

/**
 * A SA number in E.164, for the API and for the screen that reads it back.
 *
 * A number this cannot parse comes back as it was given rather than wearing an
 * invented country code. Callers pass validated input, so it should not happen
 * — and `verify.tsx` prints this straight to the customer under "We sent a code
 * to…", which is the wrong place to show them a number nobody dialled.
 */
export function toE164(phone: string): string {
  const national = saMobileNumber(phone);
  return national ? `+27${national}` : phone.trim();
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
