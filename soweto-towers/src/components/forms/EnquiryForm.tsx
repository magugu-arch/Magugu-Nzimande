'use client';

import { useActionState, useId } from 'react';
import type { ReactNode } from 'react';
import { sendEnquiry, type FormState } from '@/app/actions';
import { Check, WhatsAppGlyph } from '@/components/ui/icons';
import { whatsappLink } from '@/content/site';
import { FormGuard } from './FormGuard';
import styles from './forms.module.css';

export type EnquiryKind = 'group' | 'corporate' | 'school' | 'tour_operator' | 'hotel' | 'partner' | 'media' | 'venue' | 'base_jump' | 'general';

const LABELS: Record<EnquiryKind, string> = {
  group: 'Group or celebration',
  corporate: 'Corporate team day',
  school: 'School visit',
  tour_operator: 'Tour operator',
  hotel: 'Hotel or backpackers',
  partner: 'Brand partnership',
  media: 'Media enquiry',
  venue: 'Venue hire or film shoot',
  base_jump: 'Base jump application',
  general: 'General question',
};

type Props = {
  types: EnquiryKind[];
  /** Page path, stored with the enquiry so the crew knows where it came from. */
  page: string;
  showCompany?: boolean;
  showGroupSize?: boolean;
  showDate?: boolean;
  /** Help text under the date field. */
  dateHint?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  submitLabel?: string;
  consentLabel?: string;
};

export function EnquiryForm({
  types,
  page,
  showCompany = true,
  showGroupSize = true,
  showDate = true,
  dateHint = 'We’re open Thursday to Sunday.',
  messageLabel = 'Tell us what you have in mind',
  messagePlaceholder,
  submitLabel = 'Send enquiry',
  consentLabel = 'Soweto Towers may contact me about this enquiry by email, phone or WhatsApp.',
}: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendEnquiry, null);
  // React resets a form after each submit; a failed one hands back what was typed.
  const kept: Record<string, string | undefined> = state?.ok ? {} : (state?.values ?? {});
  const id = useId();
  const err = (name: string) => state?.errors?.[name];
  const describedBy = (name: string) => (err(name) ? `${id}-${name}-error` : undefined);

  if (state?.ok) {
    return (
      <div className={styles.success} role="status">
        <Check />
        <p>Enquiry sent</p>
        <p className="muted">{state.message}</p>
        <a className="btn btn--light btn--sm" href={whatsappLink('Hi Soweto Towers, I just sent an enquiry on the website. ')} target="_blank" rel="noopener">
          <WhatsAppGlyph size={16} /> Follow up on WhatsApp
        </a>
      </div>
    );
  }

  const field = (name: string, label: string, input: ReactNode, hint?: string) => (
    <div className="field">
      <label className="field-label" htmlFor={`${id}-${name}`}>
        {label}
      </label>
      {input}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {err(name) ? (
        <span className="field-error" id={`${id}-${name}-error`}>
          {err(name)}
        </span>
      ) : null}
    </div>
  );

  return (
    <form action={action} className={styles.form} noValidate>
      {state && !state.ok ? (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      ) : null}

      {types.length > 1 ? (
        field(
          'type',
          'What is it about?',
          <select
            id={`${id}-type`}
            name="type"
            className="input"
            defaultValue={kept.type ?? types[0]}
            aria-invalid={!!err('type')}
            aria-describedby={describedBy('type')}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {LABELS[t]}
              </option>
            ))}
          </select>,
        )
      ) : (
        <input type="hidden" name="type" value={types[0]} />
      )}

      <div className={styles.row}>
        {field(
          'name',
          'Your name',
          <input
            id={`${id}-name`}
            name="name"
            defaultValue={kept.name}
            className="input"
            autoComplete="name"
            required
            aria-invalid={!!err('name')}
            aria-describedby={describedBy('name')}
          />,
        )}
        {showCompany
          ? field(
              'company',
              'Company, school or organisation (optional)',
              <input id={`${id}-company`} name="company" defaultValue={kept.company} className="input" autoComplete="organization" />,
            )
          : null}
      </div>

      <div className={styles.row}>
        {field(
          'email',
          'Email',
          <input
            id={`${id}-email`}
            name="email"
            defaultValue={kept.email}
            type="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={!!err('email')}
            aria-describedby={describedBy('email')}
          />,
        )}
        {field(
          'phone',
          'Mobile or WhatsApp (optional)',
          <input
            id={`${id}-phone`}
            name="phone"
            defaultValue={kept.phone}
            type="tel"
            className="input"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={!!err('phone')}
            aria-describedby={describedBy('phone')}
          />,
        )}
      </div>

      {showGroupSize || showDate ? (
        <div className={styles.row}>
          {showGroupSize
            ? field(
                'groupSize',
                'How many people? (optional)',
                <input
                  id={`${id}-groupSize`}
                  name="groupSize"
                  defaultValue={kept.groupSize}
                  type="number"
                  min={1}
                  max={5000}
                  inputMode="numeric"
                  className="input"
                  aria-invalid={!!err('groupSize')}
                  aria-describedby={describedBy('groupSize')}
                />,
              )
            : null}
          {showDate
            ? field(
                'preferredDate',
                'Preferred date (optional)',
                <input
                  id={`${id}-preferredDate`}
                  name="preferredDate"
                  defaultValue={kept.preferredDate}
                  type="date"
                  className="input"
                  aria-invalid={!!err('preferredDate')}
                  aria-describedby={describedBy('preferredDate')}
                />,
                dateHint,
              )
            : null}
        </div>
      ) : null}

      {field(
        'message',
        messageLabel,
        <textarea
          id={`${id}-message`}
          name="message"
          defaultValue={kept.message}
          className="input"
          rows={5}
          placeholder={messagePlaceholder}
          required
          aria-invalid={!!err('message')}
          aria-describedby={describedBy('message')}
        />,
      )}

      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            name="consent"
            defaultChecked={kept.consent === 'on'}
            aria-invalid={!!err('consent')}
            aria-describedby={describedBy('consent')}
          />
          <span>{consentLabel}</span>
        </label>
        {err('consent') ? (
          <span className="field-error" id={`${id}-consent-error`}>
            {err('consent')}
          </span>
        ) : null}
      </div>

      <FormGuard />
      <input type="hidden" name="page" value={page} />

      <div className={styles.actions}>
        <button className="btn btn--primary" disabled={pending}>
          {pending ? 'Sending…' : submitLabel}
        </button>
        <span className={styles.note}>The crew replies within one working day.</span>
      </div>
    </form>
  );
}
