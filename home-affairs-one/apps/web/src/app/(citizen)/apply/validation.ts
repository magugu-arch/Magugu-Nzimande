/**
 * Field validation and answer summaries for the application form. Pure
 * functions only, so the rules can be tested without a browser.
 *
 * The rules mirror the workflow mock's own check at submission (a required
 * field needs a non-blank answer, a ticked box or an attached placeholder), so
 * the person hears about a gap on the step it belongs to rather than at the end.
 */
import type {
  AnswerValue,
  EvidenceItem,
  FormField,
  FormStep,
  ProfileField,
} from '@hao/api-contracts';

export type Answers = Record<string, AnswerValue>;

export interface FieldProblem {
  /** The step the problem is on, so a link from the review step can go there. */
  stepId: string;
  fieldId: string;
  /** Specific and short: "Choose why you need a replacement". */
  message: string;
}

/** The declaration is not a catalogue field, and it is never saved with the draft. */
export const DECLARATION_FIELD_ID = 'declaration';
export const DECLARATION_PROBLEM =
  'Tick the declaration to confirm that your information is true and complete';

/** DOM id of the wrapper around a field, used to move focus to it from the error summary. */
export function fieldAnchorId(fieldId: string): string {
  return `apply-field-${fieldId}`;
}

function textOf(answers: Answers, fieldId: string): string {
  const value = answers[fieldId];
  return typeof value === 'string' ? value.trim() : '';
}

/** `YYYY-MM-DD` that is a real calendar date (so not 31 February). */
export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isAnswered(field: FormField, answers: Answers, evidence: EvidenceItem[]): boolean {
  if (field.type === 'evidence') return evidence.some((item) => item.fieldId === field.id);
  if (field.type === 'checkbox') return answers[field.id] === true;
  const text = textOf(answers, field.id);
  if (text === '') return false;
  if ((field.type === 'select' || field.type === 'radio') && field.options) {
    return field.options.some((option) => option.value === text);
  }
  return true;
}

/* ------------------------------ messages ------------------------------ */

/** "Child’s given name (sample)" → "Child’s given name". */
function cleanLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Lower-cases the first letter, unless the label starts with an abbreviation such as "ID". */
function lowerFirst(text: string): string {
  const second = text.charAt(1);
  const startsWithAbbreviation = second !== '' && second !== second.toLowerCase();
  return startsWithAbbreviation ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** Turns a question into an instruction: "Why do you need a replacement?" → "Choose why you need a replacement". */
function choiceMessage(label: string): string {
  const question = cleanLabel(label);
  const plain = /^(\w+) do you (.+)\?$/i.exec(question);
  if (plain) return `Choose ${(plain[1] ?? '').toLowerCase()} you ${plain[2] ?? ''}`;
  const modal = /^(\w+) (would|should|can|will) you (.+)\?$/i.exec(question);
  if (modal) {
    return `Choose ${(modal[1] ?? '').toLowerCase()} you ${(modal[2] ?? '').toLowerCase()} ${modal[3] ?? ''}`;
  }
  const whatIs = /^what (?:is|are) (your .+)\?$/i.exec(question);
  if (whatIs) return `Choose ${whatIs[1] ?? ''}`;
  return `Choose an option for “${question.replace(/\?$/, '')}”`;
}

/** What to say when a required field has no answer. */
export function requiredMessage(field: FormField): string {
  const label = cleanLabel(field.label);
  if (field.profileKey) {
    return `Your profile has no ${lowerFirst(label)}. Add it in Profile, then come back to this application`;
  }
  switch (field.type) {
    case 'select':
    case 'radio':
      return choiceMessage(field.label);
    case 'checkbox':
      return `Tick “${label}” to continue`;
    case 'evidence':
      return `Attach a synthetic placeholder for “${label}”`;
    default:
      return label.endsWith('?') ? `Answer “${label}”` : `Enter the ${lowerFirst(label)}`;
  }
}

/* ----------------------------- validation ----------------------------- */

/** The problem with one field, or `null` when it is fine. Optional fields may be left empty. */
export function validateField(
  field: FormField,
  answers: Answers,
  evidence: EvidenceItem[],
): string | null {
  if (field.type === 'date') {
    const text = textOf(answers, field.id);
    if (text !== '' && !isRealDate(text)) return `${cleanLabel(field.label)} must be a real date`;
  }
  if (!field.required || isAnswered(field, answers, evidence)) return null;
  return requiredMessage(field);
}

export function validateStep(
  step: FormStep,
  answers: Answers,
  evidence: EvidenceItem[],
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  for (const field of step.fields) {
    const message = validateField(field, answers, evidence);
    if (message) problems.push({ stepId: step.id, fieldId: field.id, message });
  }
  return problems;
}

/** Every problem across the whole form, in step order. Used before the declaration. */
export function validateForm(
  steps: FormStep[],
  answers: Answers,
  evidence: EvidenceItem[],
): FieldProblem[] {
  return steps.flatMap((step) => validateStep(step, answers, evidence));
}

/* ------------------------------- profile ------------------------------ */

/** The profile value a field is filled from, or `null` when the profile does not hold one. */
export function profileValue(field: FormField, profile: ProfileField[]): string | null {
  if (!field.profileKey) return null;
  return profile.find((item) => item.key === field.profileKey)?.value ?? null;
}

/**
 * Answers with every profile-linked field set from the profile. Those fields
 * are read-only in the form, so the profile always wins; a value the profile no
 * longer holds is cleared rather than left behind from an earlier save.
 */
export function applyProfile(steps: FormStep[], answers: Answers, profile: ProfileField[]): Answers {
  const next: Answers = { ...answers };
  for (const field of steps.flatMap((step) => step.fields)) {
    if (field.profileKey) next[field.id] = profileValue(field, profile) ?? '';
  }
  return next;
}

/**
 * The answers to send when saving. Every field of the form is included, because
 * the workflow merges what it is sent: an answer the person has cleared must be
 * sent as empty, or the old one would survive. Evidence is saved separately.
 */
export function answersToSave(steps: FormStep[], answers: Answers): Answers {
  const out: Answers = {};
  for (const field of steps.flatMap((step) => step.fields)) {
    if (field.type === 'evidence') continue;
    out[field.id] = field.type === 'checkbox' ? answers[field.id] === true : textOf(answers, field.id);
  }
  return out;
}

/* ------------------------------ summaries ----------------------------- */

const summaryDate = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** `2024-03-27` → `27 March 2024`. Anything that is not a real date is returned unchanged. */
export function formatAnswerDate(value: string): string {
  return isRealDate(value) ? summaryDate.format(new Date(`${value}T00:00:00Z`)) : value;
}

export interface SummaryRow {
  fieldId: string;
  label: string;
  /** The answer in words, as the review step shows it. */
  text: string;
  /** A required answer that is still missing. */
  missing: boolean;
}

export function summariseAnswer(
  field: FormField,
  answers: Answers,
  evidence: EvidenceItem[],
): { text: string; missing: boolean } {
  const missing = field.required && !isAnswered(field, answers, evidence);
  const empty = field.required ? 'Not answered' : 'Not provided';

  if (field.type === 'evidence') {
    const item = evidence.find((candidate) => candidate.fieldId === field.id);
    return { text: item ? item.fileLabel : 'Nothing attached', missing };
  }
  if (field.type === 'checkbox') {
    return { text: answers[field.id] === true ? 'Yes' : 'No', missing };
  }
  const text = textOf(answers, field.id);
  if (text === '') return { text: empty, missing };
  if (field.type === 'select' || field.type === 'radio') {
    const option = field.options?.find((candidate) => candidate.value === text);
    return { text: option ? option.label : empty, missing };
  }
  if (field.type === 'date') return { text: formatAnswerDate(text), missing };
  return { text, missing };
}

export function summariseStep(
  step: FormStep,
  answers: Answers,
  evidence: EvidenceItem[],
): SummaryRow[] {
  return step.fields.map((field) => ({
    fieldId: field.id,
    label: field.label,
    ...summariseAnswer(field, answers, evidence),
  }));
}
