'use client';

import { useActionState } from 'react';
import { type FormState, submitSpeakingEnquiry } from '@/app/actions';
import { audienceSizes, budgetRanges, durations, eventFormats, eventTypes } from '@/lib/validation';
import { buttonClasses } from '../ui/Button';
import { CheckboxField, Honeypot, SelectField, TextArea, TextField } from './Field';
import { FormErrors, SuccessPanel, formHelpers, useFormAnalytics } from './FormShell';

const labels: Record<string, string> = {
  name: 'Your name',
  organisation: 'Organisation',
  email: 'Email',
  country: 'Country',
  eventType: 'Event type',
  requestedDate: 'Requested date',
  alternativeDate: 'Alternative date',
  timezone: 'Time zone',
  format: 'Format',
  location: 'Venue, city or platform',
  audienceSize: 'Audience size',
  audienceProfile: 'Audience',
  topic: 'Topic',
  duration: 'Session length',
  budget: 'Budget range',
  travel: 'Travel and accommodation',
  notes: 'Anything else',
  consent: 'Consent',
};

const initial: FormState = { status: 'idle' };

/** Brief §6, Speaking: every field the team needs to judge fit, in one pass. */
export function SpeakingEnquiryForm() {
  const [state, action, pending] = useActionState(submitSpeakingEnquiry, initial);
  const { onFocusCapture } = useFormAnalytics('speaking', state);
  const f = formHelpers(state);

  if (state.status === 'success') {
    return (
      <SuccessPanel title="Enquiry submitted" message={state.message} preview={state.preview} />
    );
  }

  return (
    <form
      action={action}
      onFocusCapture={onFocusCapture}
      noValidate
      className="relative space-y-10"
    >
      <FormErrors state={state} labels={labels} />
      <Honeypot />
      <input type="hidden" name="sourcePage" value="/speaking" />

      <fieldset className="space-y-6">
        <legend className="type-eyebrow mb-6 text-gold">About you</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            name="name"
            label={labels.name!}
            required
            autoComplete="name"
            defaultValue={f.value('name')}
            error={f.error('name')}
          />
          <TextField
            name="organisation"
            label={labels.organisation!}
            required
            autoComplete="organization"
            defaultValue={f.value('organisation')}
            error={f.error('organisation')}
          />
          <TextField
            name="email"
            type="email"
            label={labels.email!}
            required
            autoComplete="email"
            inputMode="email"
            defaultValue={f.value('email')}
            error={f.error('email')}
          />
          <TextField
            name="country"
            label={labels.country!}
            required
            autoComplete="country-name"
            defaultValue={f.value('country')}
            error={f.error('country')}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="type-eyebrow mb-6 text-gold">The event</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <SelectField
            name="eventType"
            label={labels.eventType!}
            required
            options={eventTypes}
            defaultValue={f.value('eventType')}
            error={f.error('eventType')}
          />
          <SelectField
            name="format"
            label={labels.format!}
            required
            options={eventFormats}
            defaultValue={f.value('format')}
            error={f.error('format')}
          />
          <TextField
            name="requestedDate"
            type="date"
            label={labels.requestedDate!}
            required
            defaultValue={f.value('requestedDate')}
            error={f.error('requestedDate')}
          />
          <TextField
            name="alternativeDate"
            type="date"
            label={labels.alternativeDate!}
            defaultValue={f.value('alternativeDate')}
            error={f.error('alternativeDate')}
          />
          <TextField
            name="timezone"
            label={labels.timezone!}
            required
            hint="For example: US Central, GMT, or America/Chicago."
            defaultValue={f.value('timezone')}
            error={f.error('timezone')}
          />
          <TextField
            name="location"
            label={labels.location!}
            required
            hint="Venue and city, or the platform for virtual events."
            defaultValue={f.value('location')}
            error={f.error('location')}
          />
          <SelectField
            name="audienceSize"
            label={labels.audienceSize!}
            required
            options={audienceSizes}
            defaultValue={f.value('audienceSize')}
            error={f.error('audienceSize')}
          />
          <SelectField
            name="duration"
            label={labels.duration!}
            required
            options={durations}
            defaultValue={f.value('duration')}
            error={f.error('duration')}
          />
        </div>
        <TextArea
          name="audienceProfile"
          label={labels.audienceProfile!}
          required
          rows={3}
          hint="Who will be in the room — their roles, industry and what they hope to take away."
          defaultValue={f.value('audienceProfile')}
          error={f.error('audienceProfile')}
        />
        <TextArea
          name="topic"
          label={labels.topic!}
          required
          rows={3}
          hint="The subject you have in mind, or the problem you want the session to address."
          defaultValue={f.value('topic')}
          error={f.error('topic')}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="type-eyebrow mb-6 text-gold">Logistics</legend>
        <SelectField
          name="budget"
          label={labels.budget!}
          options={budgetRanges}
          placeholder="Prefer not to say"
          defaultValue={f.value('budget')}
          error={f.error('budget')}
        />
        <TextArea
          name="travel"
          label={labels.travel!}
          rows={3}
          hint="What you can provide for travel and accommodation, if the event is in person."
          defaultValue={f.value('travel')}
          error={f.error('travel')}
        />
        <TextArea
          name="notes"
          label={labels.notes!}
          rows={4}
          defaultValue={f.value('notes')}
          error={f.error('notes')}
        />
      </fieldset>

      <div className="space-y-6 border-t border-ivory/10 pt-8">
        <CheckboxField
          name="consent"
          defaultChecked={f.checked('consent')}
          error={f.error('consent')}
          label={
            <>
              I’m happy for the team to use these details to reply to this enquiry, as described in
              the{' '}
              <a href="/privacy" className="underline">
                privacy policy
              </a>
              .
            </>
          }
        />
        <p className="text-[0.875rem] text-ivory/60">
          Sending this starts a conversation — it does not reserve a date or confirm a booking.
        </p>
        <button type="submit" disabled={pending} className={buttonClasses('primary', 'lg')}>
          {pending ? 'Sending…' : 'Send enquiry'}
        </button>
      </div>
    </form>
  );
}
