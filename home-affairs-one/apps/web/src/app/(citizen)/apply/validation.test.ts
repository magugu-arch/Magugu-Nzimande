import type { EvidenceItem, FormField, FormStep, ProfileField } from '@hao/api-contracts';
import { describe, expect, it } from 'vitest';
import { findService } from '@/lib/catalogue';
import {
  buildSteps,
  currentTier,
  isOwnDraft,
  needsStepUp,
  nextStepId,
  previousStepId,
  resumeStepId,
  sampleFeeCents,
  splitJourney,
  stepAnnouncement,
  STEP,
} from './flow';
import {
  answersToSave,
  applyProfile,
  fieldAnchorId,
  formatAnswerDate,
  isAnswered,
  isRealDate,
  profileValue,
  requiredMessage,
  summariseAnswer,
  summariseStep,
  validateField,
  validateForm,
  validateStep,
} from './validation';

function service(code: string) {
  const found = findService(code);
  if (!found) throw new Error(`Sample service ${code} is missing from the catalogue.`);
  return found;
}

function formSteps(code: string): FormStep[] {
  return service(code).form?.steps ?? [];
}

function fieldOf(code: string, fieldId: string): FormField {
  const field = formSteps(code)
    .flatMap((step) => step.fields)
    .find((candidate) => candidate.id === fieldId);
  if (!field) throw new Error(`Sample field ${fieldId} is missing from ${code}.`);
  return field;
}

function placeholder(fieldId: string): EvidenceItem {
  return {
    evidenceId: 'EVIDENCE-DEMO-1',
    fieldId,
    documentType: 'Supporting document (sample placeholder)',
    fileLabel: 'Synthetic placeholder — no real file',
    synthetic: true,
    addedAt: '2026-11-21T10:40:00+02:00',
    scanStatus: 'NOT_SCANNED',
    retention: 'Deleted when the draft is deleted or the sample data is reset.',
  };
}

const PROFILE: ProfileField[] = [
  { key: 'fullName', label: 'Full name', value: 'Thandi M.', source: 'IDENTITY_ADAPTER_MOCK' },
  {
    key: 'email',
    label: 'Email address',
    value: 't•••••@example.org',
    source: 'IDENTITY_ADAPTER_MOCK',
  },
];

const SMART_ID = 'SMART_ID_REPLACEMENT';
const PASSPORT = 'ADULT_PASSPORT';
const BIRTH = 'BIRTH_REGISTRATION';

const field = (overrides: Partial<FormField> & Pick<FormField, 'id' | 'type'>): FormField => ({
  label: 'Sample field',
  required: true,
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* Step list                                                           */
/* ------------------------------------------------------------------ */

describe('buildSteps', () => {
  it('puts the catalogue form steps between "before" and "review", then payment and submit', () => {
    const ids = buildSteps(service(PASSPORT), { includeVerify: false }).map((step) => step.id);
    expect(ids).toEqual([
      'before',
      'your-details',
      'passport-details',
      'supporting-evidence',
      'review',
      'payment',
      'submit',
    ]);
  });

  it('adds "Confirm it is you" after the review only when a step-up is needed', () => {
    const ids = buildSteps(service(SMART_ID), { includeVerify: true }).map((step) => step.id);
    expect(ids.slice(-4)).toEqual(['review', 'verify', 'payment', 'submit']);
  });

  it('leaves payment out when the service has no sample amount', () => {
    const noFee = {
      ...service(SMART_ID),
      fee: { kind: 'TO_BE_CONFIRMED' as const, note: 'Later' },
    };
    const zeroFee = {
      ...service(SMART_ID),
      fee: { kind: 'SAMPLE' as const, amountCents: 0, currency: 'ZAR' as const, note: 'Sample' },
    };
    expect(sampleFeeCents(noFee)).toBeNull();
    expect(sampleFeeCents(zeroFee)).toBeNull();
    expect(sampleFeeCents(service(SMART_ID))).toBe(100);
    for (const candidate of [noFee, zeroFee]) {
      const ids = buildSteps(candidate, { includeVerify: false }).map((step) => step.id);
      expect(ids).not.toContain('payment');
      expect(ids.at(-1)).toBe('submit');
    }
  });

  it('gives every step a unique title, so the stepper can show them', () => {
    for (const code of [SMART_ID, PASSPORT, BIRTH]) {
      const titles = buildSteps(service(code), { includeVerify: true }).map((step) => step.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

describe('moving between steps', () => {
  const steps = buildSteps(service(SMART_ID), { includeVerify: true });

  it('walks forwards and backwards without falling off either end', () => {
    expect(nextStepId(steps, 'before')).toBe('your-details');
    expect(nextStepId(steps, 'review')).toBe('verify');
    expect(nextStepId(steps, 'submit')).toBeNull();
    expect(previousStepId(steps, 'your-details')).toBe('before');
    expect(previousStepId(steps, 'before')).toBeNull();
    expect(nextStepId(steps, 'not-a-step')).toBeNull();
    expect(previousStepId(steps, 'not-a-step')).toBeNull();
  });

  it('announces the position and the title', () => {
    expect(stepAnnouncement(steps, 'review')).toBe('Step 5 of 8: Review and declaration');
    expect(stepAnnouncement(steps, 'not-a-step')).toBe('');
  });
});

describe('resumeStepId', () => {
  const steps = buildSteps(service(PASSPORT), { includeVerify: true });

  it('reopens a draft on the form step it was saved at', () => {
    expect(resumeStepId(steps, 'passport-details')).toBe('passport-details');
    expect(resumeStepId(steps, 'before')).toBe('before');
    expect(resumeStepId(steps, 'review')).toBe('review');
  });

  it('goes back to the review for anything after it, because the declaration is never saved', () => {
    expect(resumeStepId(steps, STEP.verify)).toBe('review');
    expect(resumeStepId(steps, STEP.payment)).toBe('review');
    expect(resumeStepId(steps, STEP.submit)).toBe('review');
  });

  it('starts from the beginning for an id it does not know', () => {
    expect(resumeStepId(steps, 'done')).toBe('before');
    expect(resumeStepId(steps, 'replacement-details')).toBe('before');
    expect(resumeStepId(steps, '')).toBe('before');
  });
});

describe('isOwnDraft', () => {
  const draft = { serviceCode: PASSPORT, applicantToken: 'PERSON-DEMO-0001' };

  it('accepts the same person and service only', () => {
    expect(isOwnDraft(draft, PASSPORT, 'PERSON-DEMO-0001')).toBe(true);
    expect(isOwnDraft(draft, SMART_ID, 'PERSON-DEMO-0001')).toBe(false);
    expect(isOwnDraft(draft, PASSPORT, 'PERSON-DEMO-0002')).toBe(false);
  });
});

describe('splitJourney', () => {
  it('ends the online part at "Review, declare …" for every online sample service', () => {
    for (const code of [SMART_ID, PASSPORT, BIRTH]) {
      const { journey } = service(code);
      const { before, after } = splitJourney(journey);
      expect(before.at(-1)?.title).toMatch(/^Review, declare/);
      expect(after.length).toBeGreaterThan(0);
      expect([...before, ...after]).toEqual(journey);
    }
  });

  it('falls back to the first few steps when nothing marks the declaration', () => {
    const journey = ['One', 'Two', 'Three', 'Four'].map((title) => ({ title, detail: '' }));
    const { before, after } = splitJourney(journey);
    expect(before.map((step) => step.title)).toEqual(['One', 'Two', 'Three']);
    expect(after.map((step) => step.title)).toEqual(['Four']);
    expect(splitJourney([])).toEqual({ before: [], after: [] });
  });
});

describe('step-up tier', () => {
  const now = new Date('2026-11-21T10:00:00Z');
  const steppedUp = {
    tier: 'A3' as const,
    accountTier: 'A2' as const,
    method: 'passkey' as const,
    stepUpExpiresAt: '2026-11-21T10:05:00Z',
  };

  it('keeps A3 while the step-up is live and drops back when it lapses', () => {
    expect(currentTier(steppedUp, now)).toBe('A3');
    expect(needsStepUp(steppedUp, 'A3', now)).toBe(false);
    const later = new Date('2026-11-21T10:05:00Z');
    expect(currentTier(steppedUp, later)).toBe('A2');
    expect(needsStepUp(steppedUp, 'A3', later)).toBe(true);
  });

  it('never lets a one-time-code session pass for a verified one', () => {
    const basic = {
      tier: 'A1' as const,
      accountTier: 'A2' as const,
      method: 'verified-contact' as const,
      stepUpExpiresAt: null,
    };
    expect(currentTier(basic, now)).toBe('A1');
    expect(needsStepUp(basic, 'A2', now)).toBe(true);
    expect(needsStepUp(basic, 'A1', now)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Field validation                                                    */
/* ------------------------------------------------------------------ */

describe('isAnswered', () => {
  it('treats blank and whitespace-only text as unanswered', () => {
    const text = field({ id: 'name', type: 'text' });
    expect(isAnswered(text, {}, [])).toBe(false);
    expect(isAnswered(text, { name: '   ' }, [])).toBe(false);
    expect(isAnswered(text, { name: ' Sipho ' }, [])).toBe(true);
  });

  it('only counts a choice that is one of the options', () => {
    const reason = fieldOf(SMART_ID, 'replacement-reason');
    expect(isAnswered(reason, { 'replacement-reason': 'lost' }, [])).toBe(true);
    expect(isAnswered(reason, { 'replacement-reason': 'eaten-by-dog' }, [])).toBe(false);
  });

  it('needs a real tick for a checkbox, not a string', () => {
    const box = field({ id: 'agree', type: 'checkbox' });
    expect(isAnswered(box, { agree: true }, [])).toBe(true);
    expect(isAnswered(box, { agree: false }, [])).toBe(false);
    expect(isAnswered(box, { agree: 'true' }, [])).toBe(false);
  });

  it('needs an attached placeholder for evidence, and ignores answers', () => {
    const doc = fieldOf(SMART_ID, 'supporting-document');
    expect(isAnswered(doc, { 'supporting-document': 'yes' }, [])).toBe(false);
    expect(isAnswered(doc, {}, [placeholder('another-field')])).toBe(false);
    expect(isAnswered(doc, {}, [placeholder('supporting-document')])).toBe(true);
  });
});

describe('requiredMessage', () => {
  it('turns the sample questions into specific instructions', () => {
    expect(requiredMessage(fieldOf(SMART_ID, 'replacement-reason'))).toBe(
      'Choose why you need a replacement',
    );
    expect(requiredMessage(fieldOf(PASSPORT, 'passport-need'))).toBe('Choose what you need');
    expect(requiredMessage(fieldOf(PASSPORT, 'collection-route'))).toBe(
      'Choose how you would like to collect your passport',
    );
    expect(requiredMessage(fieldOf(BIRTH, 'relationship-to-child'))).toBe(
      'Choose your relationship to the child',
    );
    expect(requiredMessage(fieldOf(BIRTH, 'child-given-name'))).toBe(
      'Enter the child’s given name',
    );
    expect(requiredMessage(fieldOf(BIRTH, 'child-date-of-birth'))).toBe('Enter the date of birth');
    expect(requiredMessage(fieldOf(SMART_ID, 'supporting-document'))).toBe(
      'Attach a synthetic placeholder for “Supporting document”',
    );
  });

  it('sends the person to their profile for a profile-linked field', () => {
    expect(requiredMessage(fieldOf(SMART_ID, 'applicant-email'))).toBe(
      'Your profile has no email address. Add it in Profile, then come back to this application',
    );
  });

  it('has a sensible fallback for labels it cannot rephrase', () => {
    expect(requiredMessage(field({ id: 'a', type: 'radio', label: 'Collection route' }))).toBe(
      'Choose an option for “Collection route”',
    );
    expect(requiredMessage(field({ id: 'b', type: 'checkbox', label: 'I agree' }))).toBe(
      'Tick “I agree” to continue',
    );
    expect(requiredMessage(field({ id: 'c', type: 'text', label: 'ID type' }))).toBe(
      'Enter the ID type',
    );
    expect(requiredMessage(field({ id: 'd', type: 'textarea', label: 'What happened?' }))).toBe(
      'Answer “What happened?”',
    );
  });
});

describe('validateField and validateStep', () => {
  it('lets an optional field stay empty', () => {
    const notes = fieldOf(SMART_ID, 'replacement-notes');
    expect(notes.required).toBe(false);
    expect(validateField(notes, {}, [])).toBeNull();
  });

  it('rejects a date that does not exist, even on an optional field', () => {
    const date = field({ id: 'when', type: 'date', label: 'Date of birth', required: false });
    expect(validateField(date, { when: '2024-02-31' }, [])).toBe(
      'Date of birth must be a real date',
    );
    expect(validateField(date, { when: '31/02/2024' }, [])).toBe(
      'Date of birth must be a real date',
    );
    expect(validateField(date, { when: '2024-02-29' }, [])).toBeNull();
    expect(validateField(date, {}, [])).toBeNull();
  });

  it('lists each problem on a step with the step and field it belongs to', () => {
    const step = formSteps(SMART_ID).find((candidate) => candidate.id === 'replacement-details');
    if (!step) throw new Error('replacement-details step is missing');
    expect(validateStep(step, {}, [])).toEqual([
      {
        stepId: 'replacement-details',
        fieldId: 'replacement-reason',
        message: 'Choose why you need a replacement',
      },
    ]);
    expect(validateStep(step, { 'replacement-reason': 'stolen' }, [])).toEqual([]);
  });

  it('asks for the placeholder on the evidence step until one is attached', () => {
    const step = formSteps(PASSPORT).find((candidate) => candidate.id === 'supporting-evidence');
    if (!step) throw new Error('supporting-evidence step is missing');
    expect(validateStep(step, {}, []).map((problem) => problem.fieldId)).toEqual([
      'supporting-document',
    ]);
    expect(validateStep(step, {}, [placeholder('supporting-document')])).toEqual([]);
  });
});

describe('validateForm', () => {
  it('finds every gap across the form in step order', () => {
    const problems = validateForm(formSteps(BIRTH), {}, []);
    expect(problems.map((problem) => `${problem.stepId}/${problem.fieldId}`)).toEqual([
      'your-details/applicant-full-name',
      'your-details/applicant-email',
      'child-details/relationship-to-child',
      'child-details/child-given-name',
      'child-details/child-date-of-birth',
      'supporting-evidence/supporting-document',
    ]);
  });

  it('passes a complete application, with the optional mobile number left out', () => {
    const answers = applyProfile(
      formSteps(BIRTH),
      {
        'relationship-to-child': 'parent',
        'child-given-name': 'Sample',
        'child-date-of-birth': '2026-01-15',
      },
      PROFILE,
    );
    expect(validateForm(formSteps(BIRTH), answers, [placeholder('supporting-document')])).toEqual(
      [],
    );
  });
});

/* ------------------------------------------------------------------ */
/* Profile pre-fill and saving                                         */
/* ------------------------------------------------------------------ */

describe('profile pre-fill', () => {
  it('fills profile-linked fields from the profile and leaves the rest alone', () => {
    const answers = applyProfile(formSteps(SMART_ID), { 'replacement-reason': 'lost' }, PROFILE);
    expect(answers['applicant-full-name']).toBe('Thandi M.');
    expect(answers['applicant-email']).toBe('t•••••@example.org');
    expect(answers['replacement-reason']).toBe('lost');
  });

  it('lets the profile win over a stale saved value, and clears one the profile no longer holds', () => {
    const stale = { 'applicant-full-name': 'Old N.', 'applicant-mobile': '0•• ••• ••12' };
    const answers = applyProfile(formSteps(SMART_ID), stale, PROFILE);
    expect(answers['applicant-full-name']).toBe('Thandi M.');
    expect(answers['applicant-mobile']).toBe('');
  });

  it('reports which fields have a profile value', () => {
    expect(profileValue(fieldOf(SMART_ID, 'applicant-email'), PROFILE)).toBe('t•••••@example.org');
    expect(profileValue(fieldOf(SMART_ID, 'applicant-mobile'), PROFILE)).toBeNull();
    expect(profileValue(fieldOf(SMART_ID, 'replacement-reason'), PROFILE)).toBeNull();
  });
});

describe('answersToSave', () => {
  it('sends every form field, so a cleared answer overwrites the saved one', () => {
    const saved = answersToSave(formSteps(SMART_ID), {
      'replacement-reason': 'damaged',
      'replacement-notes': '  ',
    });
    expect(saved).toEqual({
      'applicant-full-name': '',
      'applicant-email': '',
      'applicant-mobile': '',
      'replacement-reason': 'damaged',
      'replacement-notes': '',
    });
  });

  it('never sends evidence or anything that is not a field of the form', () => {
    const saved = answersToSave(formSteps(SMART_ID), {
      'supporting-document': 'a file name',
      declaration: true,
      stray: 'value',
    });
    expect(saved).not.toHaveProperty('supporting-document');
    expect(saved).not.toHaveProperty('declaration');
    expect(saved).not.toHaveProperty('stray');
  });

  it('saves a checkbox as a boolean', () => {
    const steps: FormStep[] = [
      { id: 's', title: 'S', intro: '', fields: [field({ id: 'agree', type: 'checkbox' })] },
    ];
    expect(answersToSave(steps, { agree: true })).toEqual({ agree: true });
    expect(answersToSave(steps, {})).toEqual({ agree: false });
  });
});

/* ------------------------------------------------------------------ */
/* Answer summaries                                                    */
/* ------------------------------------------------------------------ */

describe('summariseAnswer', () => {
  it('shows the option label, not the stored value', () => {
    expect(
      summariseAnswer(
        fieldOf(SMART_ID, 'replacement-reason'),
        { 'replacement-reason': 'details-changed' },
        [],
      ),
    ).toEqual({ text: 'My details changed', missing: false });
  });

  it('flags a required answer that is missing, and is gentler about optional ones', () => {
    expect(summariseAnswer(fieldOf(SMART_ID, 'replacement-reason'), {}, [])).toEqual({
      text: 'Not answered',
      missing: true,
    });
    expect(summariseAnswer(fieldOf(SMART_ID, 'replacement-notes'), {}, [])).toEqual({
      text: 'Not provided',
      missing: false,
    });
  });

  it('writes dates out in words and ticks as yes or no', () => {
    expect(isRealDate('2026-01-15')).toBe(true);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(formatAnswerDate('2026-01-15')).toMatch(/^15 January 2026$/);
    expect(formatAnswerDate('not a date')).toBe('not a date');
    expect(
      summariseAnswer(
        fieldOf(BIRTH, 'child-date-of-birth'),
        { 'child-date-of-birth': '2026-01-15' },
        [],
      ).text,
    ).toContain('January 2026');
    const box = field({ id: 'agree', type: 'checkbox' });
    expect(summariseAnswer(box, { agree: true }, [])).toEqual({ text: 'Yes', missing: false });
    expect(summariseAnswer(box, {}, [])).toEqual({ text: 'No', missing: true });
  });

  it('describes evidence by its synthetic label and never by a file', () => {
    const doc = fieldOf(PASSPORT, 'supporting-document');
    expect(summariseAnswer(doc, {}, [placeholder('supporting-document')])).toEqual({
      text: 'Synthetic placeholder — no real file',
      missing: false,
    });
    expect(summariseAnswer(doc, {}, [])).toEqual({ text: 'Nothing attached', missing: true });
  });
});

describe('summariseStep', () => {
  it('returns one row per field, in the order the form asks', () => {
    const step = formSteps(PASSPORT).find((candidate) => candidate.id === 'passport-details');
    if (!step) throw new Error('passport-details step is missing');
    const rows = summariseStep(step, { 'passport-need': 'renewal' }, []);
    expect(rows).toEqual([
      { fieldId: 'passport-need', label: 'What do you need?', text: 'Renewal', missing: false },
      {
        fieldId: 'collection-route',
        label: 'How would you like to collect your passport?',
        text: 'Not answered',
        missing: true,
      },
    ]);
  });
});

describe('fieldAnchorId', () => {
  it('is stable, so the error summary can link to a field', () => {
    expect(fieldAnchorId('replacement-reason')).toBe('apply-field-replacement-reason');
  });
});
