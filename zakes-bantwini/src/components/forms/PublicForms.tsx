'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Checkbox, ChoiceGroup, FormAlert, TextArea, TextField, fieldStyles } from '@/components/forms/fields';
import { Button } from '@/components/ui/Button';
import { track } from '@/lib/analytics/client';
import { COLLABORATION_TYPES } from '@/lib/booking/types';
import type { FormState } from '@/app/(site)/forms/actions';
import styles from '@/app/(site)/pages.module.css';

type Action = (prev: FormState, form: FormData) => Promise<FormState>;
const initial: FormState = { ok: false, message: null, fields: {} };

function Honeypot() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
      <label htmlFor="website-field">Website</label>
      <input id="website-field" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

export function CommunityForm({ action, consent }: { action: Action; consent: { email: string; whatsapp: string } }) {
  const [state, submit, pending] = useActionState(action, initial);
  const sent = useRef(false);
  useEffect(() => {
    if (state.ok && !sent.current) {
      sent.current = true;
      track('community_signup');
    }
  }, [state.ok]);

  if (state.ok) return <FormAlert tone="success">{state.message}</FormAlert>;
  return (
    <form action={submit} className={styles.form} noValidate>
      {state.message && <FormAlert>{state.message}</FormAlert>}
      <TextField name="email" label="Email" type="email" autoComplete="email" error={state.fields.email} />
      <TextField name="phone" label="Mobile for WhatsApp" type="tel" autoComplete="tel" optional error={state.fields.phone} hint="Only needed if you tick WhatsApp below." />
      <Checkbox name="emailConsent" label={consent.email} defaultChecked error={state.fields.emailConsent} />
      <Checkbox name="whatsappConsent" label={consent.whatsapp} />
      <Honeypot />
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Joining…' : 'Join the movement'}
        </Button>
      </div>
      <p className="muted">We store the wording you agreed to with your details. See the privacy notice for how they are used.</p>
    </form>
  );
}

export function CollaborationForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, initial);
  const sent = useRef(false);
  useEffect(() => {
    if (state.ok && !sent.current) {
      sent.current = true;
      track('collaboration_submitted');
    }
  }, [state.ok]);

  if (state.ok) return <FormAlert tone="success">{state.message}</FormAlert>;
  const f = state.fields;
  return (
    <form action={submit} className={styles.form} noValidate>
      {state.message && <FormAlert>{state.message}</FormAlert>}
      <ChoiceGroup name="type" legend="What would you like to build?" options={COLLABORATION_TYPES} error={f.type} />
      <div className={fieldStyles.row2}>
        <TextField name="name" label="Your name" autoComplete="name" error={f.name} />
        <TextField name="organisation" label="Organisation" optional autoComplete="organization" error={f.organisation} />
      </div>
      <div className={fieldStyles.row2}>
        <TextField name="email" label="Email" type="email" autoComplete="email" error={f.email} />
        <TextField name="phone" label="Phone" type="tel" optional autoComplete="tel" error={f.phone} />
      </div>
      <div className={fieldStyles.row2}>
        <TextField name="timeline" label="Timeline" optional placeholder="e.g. Launch in March" error={f.timeline} />
        <TextField name="budget" label="Budget" optional placeholder="A range is fine" error={f.budget} />
      </div>
      <TextArea name="message" label="The idea" rows={6} error={f.message} hint="What you want to make, who it is for, and why Zakes." />
      <Checkbox name="privacyConsent" label="I agree to my details being used to respond to this proposal." error={f.privacyConsent} />
      <Honeypot />
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Sending…' : 'Send proposal'}
        </Button>
      </div>
    </form>
  );
}

export function TrackedDownload({ href, item, children, className }: { href: string; item: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={className} download onClick={() => track('epk_downloaded', { item })}>
      {children}
    </a>
  );
}
