'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, ChoiceGroup, FormAlert, Select, TextArea, TextField, fieldStyles } from '@/components/forms/fields';
import { track } from '@/lib/analytics/client';
import type { PublicAvailability } from '@/lib/booking/availability';
import { formatDayLong } from '@/lib/booking/dates';
import { BookingRequest, REQUEST_STEPS } from '@/lib/booking/schemas';
import { BUDGET_RANGES, EVENT_TYPES, PERFORMANCE_FORMATS } from '@/lib/booking/types';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import styles from './RequestWizard.module.css';

type Data = Record<string, string | boolean>;

const DRAFT_KEY = 'zb-booking-draft';
const noopSubscribe = () => () => {};
const EMPTY: Data = {
  eventDate: '',
  startTime: '',
  endTime: '',
  eventType: '',
  performanceFormat: '',
  expectedAttendance: '',
  budgetRange: '',
  venue: '',
  city: '',
  country: 'South Africa',
  travelRequired: false,
  travelNotes: '',
  accommodationRequired: false,
  accommodationNotes: '',
  productionNotes: '',
  fullName: '',
  organisation: '',
  email: '',
  phone: '',
  whatsappOptIn: false,
  additionalInfo: '',
  privacyConsent: false,
};

const EVENT_DETAILS: Record<string, string> = {
  corporate: 'Year-end functions, launches, conferences',
  private: 'Birthdays, anniversaries, private parties',
  wedding: 'Ceremonies and receptions',
  festival: 'Festival stages and line-ups',
  concert: 'Venues, clubs and promoted shows',
  brand: 'Activations and campaign events',
  other: 'Tell us in the details',
};

export function RequestWizard({ initialDate }: { initialDate?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(() => ({ ...EMPTY, eventDate: initialDate ?? '' }));
  const [dateState, setDateState] = useState<PublicAvailability | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [touched, setTouched] = useState(false);
  const [draftHandled, setDraftHandled] = useState(false);

  // An unfinished request from earlier in this tab, offered back rather than
  // silently restored (a shared computer should not prefill a stranger's form).
  const savedDraft = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return sessionStorage.getItem(DRAFT_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const offerDraft = Boolean(savedDraft) && !draftHandled && !touched;

  useEffect(() => {
    track('book_start', { source: initialDate ? 'calendar' : 'direct' });
  }, [initialDate]);

  useEffect(() => {
    if (!touched) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ data, step }));
    } catch {
      /* storage unavailable — the form still works */
    }
  }, [data, step, touched]);

  const resumeDraft = () => {
    try {
      const parsed = JSON.parse(savedDraft ?? '{}') as { data?: Data; step?: number };
      setData((d) => ({ ...d, ...parsed.data, eventDate: initialDate || String(parsed.data?.eventDate ?? '') }));
      setStep(Math.min(parsed.step ?? 0, REQUEST_STEPS.length - 1));
    } catch {
      /* unreadable draft — start fresh */
    }
    setDraftHandled(true);
    setTouched(true);
  };

  const set = (name: string, value: string | boolean) => {
    setTouched(true);
    setData((d) => ({ ...d, [name]: value }));
    setErrors((e) => {
      if (!e[name]) return e;
      const next = { ...e };
      delete next[name];
      return next;
    });
  };

  /** Validate with the server's schema, keeping only this step's (or every) field. */
  const validate = (upTo: number): Record<string, string> => {
    const result = BookingRequest.safeParse(data);
    if (result.success) return {};
    const fields = new Set<string>(REQUEST_STEPS.slice(0, upTo + 1).flatMap((s) => [...s.fields]));
    const out: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? '_');
      if (fields.has(key) && !out[key]) out[key] = issue.message;
    }
    return out;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    requestAnimationFrame(() => {
      const first = Object.keys(errs)[0];
      const el = first ? document.querySelector<HTMLElement>(`[name="${first}"], [data-field="${first}"] button[tabindex="0"]`) : null;
      el?.focus();
    });
  };

  const goTo = (i: number) => {
    setStep(i);
    setAlert(null);
    requestAnimationFrame(() => heading.current?.focus());
  };

  const next = () => {
    const errs = validate(step);
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstError(errs);
      return;
    }
    goTo(step + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step < REQUEST_STEPS.length - 1) return next();
    const errs = validate(REQUEST_STEPS.length - 1);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const firstStep = REQUEST_STEPS.findIndex((s) => s.fields.some((f) => f in errs));
      if (firstStep !== step) goTo(firstStep);
      focusFirstError(errs);
      return;
    }
    setSubmitting(true);
    setAlert(null);
    const form = new FormData();
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'boolean') {
        if (v) form.set(k, 'on');
      } else form.set(k, v);
    }
    form.set('website', (document.getElementById('website') as HTMLInputElement | null)?.value ?? '');
    if (file) form.set('brief', file);
    try {
      const res = await fetch('/api/booking/request', { method: 'POST', body: form });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string; fields?: Record<string, string> };
      if (res.ok && json.url) {
        track('book_request_submitted', { eventType: String(data.eventType) });
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        router.push(json.url);
        return;
      }
      const fieldErrs = json.fields ?? {};
      setErrors(fieldErrs);
      setAlert(json.error ?? 'The request could not be sent. Please try again.');
      const target = REQUEST_STEPS.findIndex((s) => s.fields.some((f) => f in fieldErrs));
      if (target >= 0 && target !== step) goTo(target);
    } catch {
      setAlert('You appear to be offline. Nothing was sent — check your connection and try again.');
    }
    setSubmitting(false);
  };

  const current = REQUEST_STEPS[step]!;
  const str = (k: string) => String(data[k] ?? '');
  const bool = (k: string) => Boolean(data[k]);

  return (
    <form className={styles.wizard} onSubmit={submit} noValidate>
      <ol role="list" className={styles.progress} aria-label="Booking request steps">
        {REQUEST_STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === step ? 'step' : undefined} data-done={i < step || undefined}>
            {i < step ? (
              <button type="button" onClick={() => goTo(i)}>
                <span className={styles.stepNum}>0{i + 1}</span> {s.title}
                <span className="visually-hidden"> (completed — edit)</span>
              </button>
            ) : (
              <span>
                <span className={styles.stepNum}>0{i + 1}</span> {s.title}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className={styles.panel}>
        <h2 ref={heading} tabIndex={-1} className={styles.stepTitle}>
          <span className="eyebrow eyebrow-accent">
            Step {step + 1} of {REQUEST_STEPS.length}
          </span>
          {['Choose the date', 'About the event', 'Where it happens', 'About you', 'Review and send'][step]}
        </h2>

        {alert && <FormAlert>{alert}</FormAlert>}
        {offerDraft && (
          <FormAlert tone="info">
            You have an unfinished request from earlier.{' '}
            <button type="button" className={styles.edit} onClick={resumeDraft}>
              Continue it
            </button>{' '}
            <button type="button" className={styles.edit} onClick={() => setDraftHandled(true)}>
              Start again
            </button>
          </FormAlert>
        )}

        {current.key === 'date' && (
          <div className={styles.dateStep} data-field="eventDate">
            <AvailabilityCalendar
              value={str('eventDate') || null}
              describedBy="date-help"
              onChange={(d, state) => {
                set('eventDate', d);
                setDateState(state);
                track('book_date_selected', { state });
              }}
            />
            <div className={styles.dateAside}>
              <p id="date-help" className="muted">
                The calendar shows availability only. Every request is reviewed by management, and a date is secured once the agreement is signed and the deposit paid.
              </p>
              {str('eventDate') ? (
                <p className={styles.chosen} aria-live="polite">
                  <span className="eyebrow">Selected</span>
                  <span>{formatDayLong(str('eventDate'))}</span>
                  {dateState === 'limited' && <span className={styles.note}>A provisional hold exists on this date — you can still request it.</span>}
                </p>
              ) : (
                <p className={styles.chosen} aria-live="polite">
                  <span className="eyebrow">No date selected yet</span>
                </p>
              )}
              {errors.eventDate && <p className={fieldStyles.error}>{errors.eventDate}</p>}
            </div>
          </div>
        )}

        {current.key === 'event' && (
          <div className={styles.fields}>
            <ChoiceGroup
              name="eventType"
              legend="Type of event"
              options={EVENT_TYPES.map((t) => ({ ...t, detail: EVENT_DETAILS[t.key] }))}
              value={str('eventType')}
              onChange={(v) => set('eventType', v)}
              error={errors.eventType}
            />
            <Select
              name="performanceFormat"
              label="Performance format"
              options={PERFORMANCE_FORMATS}
              value={str('performanceFormat')}
              onChange={(e) => set('performanceFormat', e.target.value)}
              error={errors.performanceFormat}
            />
            <div className={fieldStyles.row3}>
              <TextField name="startTime" label="Start time" type="time" value={str('startTime')} onChange={(e) => set('startTime', e.target.value)} error={errors.startTime} />
              <TextField name="endTime" label="End time" type="time" optional value={str('endTime')} onChange={(e) => set('endTime', e.target.value)} error={errors.endTime} />
              <TextField
                name="expectedAttendance"
                label="Expected attendance"
                type="number"
                inputMode="numeric"
                min={1}
                value={str('expectedAttendance')}
                onChange={(e) => set('expectedAttendance', e.target.value)}
                error={errors.expectedAttendance}
              />
            </div>
            <Select
              name="budgetRange"
              label="Budget range"
              hint="Guides the quote; it is not shared outside management."
              options={BUDGET_RANGES}
              value={str('budgetRange')}
              onChange={(e) => set('budgetRange', e.target.value)}
              error={errors.budgetRange}
            />
          </div>
        )}

        {current.key === 'location' && (
          <div className={styles.fields}>
            <TextField name="venue" label="Venue" hint="Or “TBC” if it is not confirmed yet." value={str('venue')} onChange={(e) => set('venue', e.target.value)} error={errors.venue} autoComplete="off" />
            <div className={fieldStyles.row2}>
              <TextField name="city" label="City" value={str('city')} onChange={(e) => set('city', e.target.value)} error={errors.city} autoComplete="address-level2" />
              <TextField name="country" label="Country" value={str('country')} onChange={(e) => set('country', e.target.value)} error={errors.country} autoComplete="country-name" />
            </div>
            <Checkbox name="travelRequired" label="Travel will be required" checked={bool('travelRequired')} onChange={(e) => set('travelRequired', e.target.checked)} />
            {bool('travelRequired') && (
              <TextArea name="travelNotes" label="Travel requirements" optional rows={3} value={str('travelNotes')} onChange={(e) => set('travelNotes', e.target.value)} error={errors.travelNotes} />
            )}
            <Checkbox name="accommodationRequired" label="Accommodation will be required" checked={bool('accommodationRequired')} onChange={(e) => set('accommodationRequired', e.target.checked)} />
            {bool('accommodationRequired') && (
              <TextArea name="accommodationNotes" label="Accommodation requirements" optional rows={3} value={str('accommodationNotes')} onChange={(e) => set('accommodationNotes', e.target.value)} error={errors.accommodationNotes} />
            )}
            <TextArea
              name="productionNotes"
              label="Production"
              optional
              hint="Stage, sound, lighting and backline already in place, or what you need."
              rows={3}
              value={str('productionNotes')}
              onChange={(e) => set('productionNotes', e.target.value)}
              error={errors.productionNotes}
            />
          </div>
        )}

        {current.key === 'details' && (
          <div className={styles.fields}>
            <div className={fieldStyles.row2}>
              <TextField name="fullName" label="Full name" autoComplete="name" value={str('fullName')} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} />
              <TextField name="organisation" label="Company or organisation" optional autoComplete="organization" value={str('organisation')} onChange={(e) => set('organisation', e.target.value)} error={errors.organisation} />
            </div>
            <div className={fieldStyles.row2}>
              <TextField name="email" label="Email" type="email" autoComplete="email" value={str('email')} onChange={(e) => set('email', e.target.value)} error={errors.email} />
              <TextField name="phone" label="Mobile / WhatsApp" type="tel" autoComplete="tel" value={str('phone')} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
            </div>
            <Checkbox
              name="whatsappOptIn"
              label="Send booking updates to me on WhatsApp too"
              hint="Optional. Email is always used."
              checked={bool('whatsappOptIn')}
              onChange={(e) => set('whatsappOptIn', e.target.checked)}
            />
            <TextArea name="additionalInfo" label="Anything else we should know" optional rows={4} value={str('additionalInfo')} onChange={(e) => set('additionalInfo', e.target.value)} error={errors.additionalInfo} />
            <div className={fieldStyles.field}>
              <label htmlFor="brief" className={fieldStyles.label}>
                Event brief <span className={fieldStyles.optional}>(optional)</span>
              </label>
              <input
                id="brief"
                name="brief"
                type="file"
                className={styles.file}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                aria-describedby="brief-hint"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span id="brief-hint" className={fieldStyles.hint}>
                PDF, Word, JPG or PNG, up to 10 MB. Stored privately — only management can open it.
              </span>
              {errors.brief && <span className={fieldStyles.error}>{errors.brief}</span>}
            </div>
          </div>
        )}

        {current.key === 'review' && (
          <div className={styles.fields}>
            <dl className={styles.review}>
              {[
                ['Date', str('eventDate') ? formatDayLong(str('eventDate')) : '—', 0],
                ['Time', `${str('startTime')}${str('endTime') ? ` – ${str('endTime')}` : ''}`, 1],
                ['Event', EVENT_TYPES.find((t) => t.key === str('eventType'))?.label ?? '—', 1],
                ['Format', PERFORMANCE_FORMATS.find((t) => t.key === str('performanceFormat'))?.label ?? '—', 1],
                ['Attendance', str('expectedAttendance'), 1],
                ['Budget', BUDGET_RANGES.find((t) => t.key === str('budgetRange'))?.label ?? '—', 1],
                ['Venue', `${str('venue')}, ${str('city')}, ${str('country')}`, 2],
                ['Travel / stay', [bool('travelRequired') && 'Travel', bool('accommodationRequired') && 'Accommodation'].filter(Boolean).join(' and ') || 'Not required', 2],
                ['Contact', `${str('fullName')}${str('organisation') ? `, ${str('organisation')}` : ''}`, 3],
                ['Email / phone', `${str('email')} · ${str('phone')}`, 3],
                ['Brief', file ? file.name : 'None attached', 3],
              ].map(([k, v, s]) => (
                <div key={k as string}>
                  <dt>{k}</dt>
                  <dd>
                    {v}
                    <button type="button" className={styles.edit} onClick={() => goTo(s as number)}>
                      Edit<span className="visually-hidden"> {k}</span>
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            <Checkbox
              name="privacyConsent"
              label="I agree to Zakes Bantwini’s management using these details to handle this booking request, as described in the privacy notice."
              checked={bool('privacyConsent')}
              onChange={(e) => set('privacyConsent', e.target.checked)}
              error={errors.privacyConsent}
            />
            <p className="muted">
              Sending this creates a booking reference and notifies the booking team. It does not commit you to anything — you will receive a formal quote to accept or
              decline.
            </p>
          </div>
        )}

        {/* Honeypot: hidden from people and assistive tech, attractive to bots. */}
        <div aria-hidden="true" className={styles.trap}>
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        <div className={styles.actions}>
          {step > 0 && (
            <Button variant="outline" onClick={() => goTo(step - 1)} disabled={submitting}>
              Back
            </Button>
          )}
          {step < REQUEST_STEPS.length - 1 ? (
            <Button type="button" onClick={next} arrow>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Sending…' : 'Send booking request'}
            </Button>
          )}
        </div>
        <p className="visually-hidden" aria-live="polite">
          {submitting ? 'Sending your booking request' : ''}
        </p>
      </div>
    </form>
  );
}
