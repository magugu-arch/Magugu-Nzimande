'use client';

import { useActionState } from 'react';
import { type FormState, submitContact } from '@/app/actions';
import { contactRoutes } from '@/content/site';
import { buttonClasses } from '../ui/Button';
import { CheckboxField, Honeypot, SelectField, TextArea, TextField } from './Field';
import { FormErrors, SuccessPanel, formHelpers, useFormAnalytics } from './FormShell';

const labels: Record<string, string> = {
  category: 'What is this about?',
  name: 'Your name',
  email: 'Email',
  subject: 'Subject',
  message: 'Message',
  orderReference: 'Order or account reference',
  consent: 'Consent',
};

const initial: FormState = { status: 'idle' };

export function ContactForm({ defaultCategory }: { defaultCategory?: string }) {
  const [state, action, pending] = useActionState(submitContact, initial);
  const { onFocusCapture } = useFormAnalytics('contact', state);
  const f = formHelpers(state);

  if (state.status === 'success') {
    return (
      <SuccessPanel
        title="Message sent"
        message={state.message}
        preview={state.preview}
        tone="light"
      />
    );
  }

  return (
    <form action={action} onFocusCapture={onFocusCapture} noValidate className="relative space-y-6">
      <FormErrors state={state} labels={labels} tone="light" />
      <Honeypot />
      <input type="hidden" name="sourcePage" value="/contact" />
      <SelectField
        tone="light"
        name="category"
        label={labels.category!}
        required
        options={contactRoutes.map((r) => ({ value: r.id, label: r.title }))}
        defaultValue={f.value('category') ?? defaultCategory}
        error={f.error('category')}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          tone="light"
          name="name"
          label={labels.name!}
          required
          autoComplete="name"
          defaultValue={f.value('name')}
          error={f.error('name')}
        />
        <TextField
          tone="light"
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
      <TextField
        tone="light"
        name="subject"
        label={labels.subject!}
        required
        defaultValue={f.value('subject')}
        error={f.error('subject')}
      />
      <TextField
        tone="light"
        name="orderReference"
        label={labels.orderReference!}
        hint="Helps support find a purchase quickly. Never include card details."
        defaultValue={f.value('orderReference')}
        error={f.error('orderReference')}
      />
      <TextArea
        tone="light"
        name="message"
        label={labels.message!}
        required
        rows={6}
        defaultValue={f.value('message')}
        error={f.error('message')}
      />
      <CheckboxField
        tone="light"
        name="consent"
        defaultChecked={f.checked('consent')}
        error={f.error('consent')}
        label={
          <>
            I’m happy for the team to use these details to reply, as described in the{' '}
            <a href="/privacy" className="underline">
              privacy policy
            </a>
            .
          </>
        }
      />
      <button type="submit" disabled={pending} className={buttonClasses('ink', 'lg')}>
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
