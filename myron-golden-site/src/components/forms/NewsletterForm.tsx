'use client';

import { useActionState, useId } from 'react';
import { type FormState, subscribeNewsletter } from '@/app/actions';
import { topics } from '@/content/taxonomy';
import { newsletterTopicValues } from '@/lib/validation';
import { buttonClasses } from '../ui/Button';
import { CheckboxField, Honeypot, TextField } from './Field';
import { FormErrors, SuccessPanel, formHelpers, useFormAnalytics } from './FormShell';

const labels: Record<string, string> = {
  firstName: 'First name',
  email: 'Email',
  topics: 'Topics',
  consent: 'Consent',
};

const initial: FormState = { status: 'idle' };

/** Opt-in with explicit consent and topic preferences (brief §7, Lead capture). */
export function NewsletterForm({ sourcePage = '/' }: { sourcePage?: string }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, initial);
  const { onFocusCapture } = useFormAnalytics('newsletter', state);
  const f = formHelpers(state);
  const id = useId();

  if (state.status === 'success') {
    return <SuccessPanel title="Almost there" message={state.message} preview={state.preview} />;
  }

  return (
    <form action={action} onFocusCapture={onFocusCapture} noValidate className="relative space-y-6">
      <FormErrors state={state} labels={labels} />
      <Honeypot />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <TextField
          name="firstName"
          label={labels.firstName!}
          autoComplete="given-name"
          defaultValue={f.value('firstName')}
          error={f.error('firstName')}
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
      </div>

      <fieldset>
        <legend className="mb-3 text-[0.9rem] font-semibold">
          What would you like to hear about?{' '}
          <span className="font-normal text-ivory/55">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {newsletterTopicValues.map((value) => (
            <label
              key={value}
              htmlFor={`${id}-${value}`}
              className="pressable relative inline-flex cursor-pointer items-center rounded-full border border-ivory/20 px-4 py-2 text-[0.85rem] text-ivory/85 has-[:checked]:border-gold has-[:checked]:bg-gold/15 has-[:checked]:text-ivory has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold"
            >
              <input
                id={`${id}-${value}`}
                type="checkbox"
                name="topics"
                value={value}
                defaultChecked={f.checked('topics', value)}
                className="sr-only"
              />
              {topics[value].label}
            </label>
          ))}
        </div>
      </fieldset>

      <CheckboxField
        name="consent"
        defaultChecked={f.checked('consent')}
        error={f.error('consent')}
        label={
          <>
            Email me new teaching, resources and event news. I can unsubscribe at any time. See the{' '}
            <a href="/privacy" className="underline">
              privacy policy
            </a>
            .
          </>
        }
      />
      <button type="submit" disabled={pending} className={buttonClasses('primary', 'lg')}>
        {pending ? 'Signing up…' : 'Sign me up'}
      </button>
    </form>
  );
}
