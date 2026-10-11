export type ContactField = 'name' | 'email' | 'phone';

/** Inline validation for contact details — checked as each field is left, not all at once on submit. */
export function validateContact(field: ContactField, value: string): string {
  const v = value.trim();
  if (field === 'name' && !v) return 'Add your name so client care knows who to ask for.';
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return 'Enter an email address like name@example.com.';
  if (field === 'phone' && v && !/^[+\d][\d\s()-]{6,}$/.test(v))
    return 'Use digits, spaces and an optional + country code.';
  return '';
}
