import { useId, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { CONTACT_EMAIL, FORM_ENDPOINT } from '../content';

const INTERESTS = [
  'Strategic Growth',
  'Transformation',
  'Leadership Advisory',
  'Something else',
] as const;

type Fields = {
  name: string;
  email: string;
  organisation: string;
  role: string;
  phone: string;
  interest: string;
  message: string;
  consent: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = {
  name: '',
  email: '',
  organisation: '',
  role: '',
  phone: '',
  interest: '',
  message: '',
  consent: false,
};

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Please tell us your name.';
  if (!f.email.trim()) e.email = 'We need an email address to reply.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    e.email = 'That email address does not look right.';
  if (f.phone && !/^[+()\d\s-]{7,20}$/.test(f.phone.trim()))
    e.phone = 'Use digits, spaces and + only.';
  if (!f.interest) e.interest = 'Choose the area closest to your question.';
  if (f.message.trim().length < 20)
    e.message = 'A sentence or two helps us prepare (20+ characters).';
  if (!f.consent) e.consent = 'Please confirm we may use these details to respond.';
  return e;
}

function toBody(f: Fields) {
  const details = [
    `Name: ${f.name}`,
    `Email: ${f.email}`,
    f.organisation && `Organisation: ${f.organisation}`,
    f.role && `Role: ${f.role}`,
    f.phone && `Phone: ${f.phone}`,
    `Area: ${f.interest}`,
  ].filter(Boolean);
  return [...details, '', f.message].join('\n');
}

type Status = 'idle' | 'sending' | 'sent-direct' | 'sent-mail' | 'error';

export function ContactForm() {
  const id = useId();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('idle');

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // Honeypot: people never see this field, form-filling bots do.
    if ((form.elements.namedItem('company_website') as HTMLInputElement | null)?.value) return;

    const found = validate(fields);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    const subject = `Information request — ${fields.interest}`;

    if (FORM_ENDPOINT) {
      setStatus('sending');
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...fields, _subject: subject }),
        });
        if (!res.ok) throw new Error(String(res.status));
        setStatus('sent-direct');
        setFields(EMPTY);
      } catch {
        setStatus('error');
      }
      return;
    }

    // No form service configured: hand the request to the visitor's own mail
    // app, fully written, so nothing depends on a server.
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(toBody(fields))}`;
    setStatus('sent-mail');
  }

  if (status === 'sent-direct') {
    return (
      <div role="status" className="mt-14 border-t border-white/10 pt-10">
        <Check aria-hidden className="h-8 w-8 text-quest" />
        <p className="mt-6 text-2xl font-medium tracking-tight text-white">
          Thank you. Your request is with us.
        </p>
        <p className="mt-3 max-w-[32rem] text-base leading-relaxed text-white/70">
          We will reply to the email address you gave.
        </p>
      </div>
    );
  }

  const field = (name: keyof Fields) => ({
    id: `${id}-${name}`,
    name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined,
  });

  const inputClass =
    'mt-2 w-full scroll-mt-28 border-0 border-b border-white/45 bg-transparent px-0 py-3 text-base text-white placeholder:text-white/60 transition-colors focus:border-quest focus:outline-none focus:ring-0 aria-[invalid=true]:border-quest';
  const labelClass = 'label text-white/70';

  const FieldError = ({ name }: { name: keyof Fields }) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="mt-2 text-sm text-quest">
        {errors[name]}
      </p>
    ) : null;

  const Optional = () => (
    <span className="normal-case tracking-normal text-white/50"> (optional)</span>
  );

  return (
    <form noValidate onSubmit={onSubmit} aria-labelledby={`${id}-title`} className="mt-14">
      <h3 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-white">
        Request information
      </h3>

      <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={labelClass}>
            Full name
          </label>
          <input
            {...field('name')}
            type="text"
            autoComplete="name"
            required
            value={fields.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputClass}
          />
          <FieldError name="name" />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>
            Email
          </label>
          <input
            {...field('email')}
            type="email"
            autoComplete="email"
            required
            value={fields.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputClass}
          />
          <FieldError name="email" />
        </div>
        <div>
          <label htmlFor={`${id}-organisation`} className={labelClass}>
            Organisation
            <Optional />
          </label>
          <input
            {...field('organisation')}
            type="text"
            autoComplete="organization"
            value={fields.organisation}
            onChange={(e) => set('organisation', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-role`} className={labelClass}>
            Role
            <Optional />
          </label>
          <input
            {...field('role')}
            type="text"
            autoComplete="organization-title"
            value={fields.role}
            onChange={(e) => set('role', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={labelClass}>
            Phone
            <Optional />
          </label>
          <input
            {...field('phone')}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={fields.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputClass}
          />
          <FieldError name="phone" />
        </div>
        <div>
          <label htmlFor={`${id}-interest`} className={labelClass}>
            Area of interest
          </label>
          <select
            {...field('interest')}
            required
            value={fields.interest}
            onChange={(e) => set('interest', e.target.value)}
            className={`${inputClass} appearance-none bg-[length:12px] bg-[right_0.25rem_center] bg-no-repeat pr-8 [background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffffff' stroke-opacity='.7' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")] ${fields.interest ? '' : 'text-white/60'}`}
          >
            <option value="" disabled className="bg-ink text-white/60">
              Choose one
            </option>
            {INTERESTS.map((interest) => (
              <option key={interest} value={interest} className="bg-ink text-white">
                {interest}
              </option>
            ))}
          </select>
          <FieldError name="interest" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-message`} className={labelClass}>
            What is the decision in front of you?
          </label>
          <textarea
            {...field('message')}
            rows={4}
            required
            value={fields.message}
            onChange={(e) => set('message', e.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          <FieldError name="message" />
        </div>
      </div>

      {/* Honeypot, hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-8">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/70">
          <input
            {...field('consent')}
            type="checkbox"
            checked={fields.consent}
            onChange={(e) => set('consent', e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#E4601F]"
          />
          <span>
            I agree that Quest4Best may use these details to respond to my request, as described in
            the{' '}
            <a
              href="#privacy"
              className="underline decoration-white/30 underline-offset-4 hover:text-white"
            >
              privacy notice
            </a>
            .
          </span>
        </label>
        <FieldError name="consent" />
      </div>

      <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-ink transition-colors hover:bg-quest hover:text-white disabled:opacity-60"
        >
          {status === 'sending' ? 'Sending…' : 'Send request'}
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </button>
        <p className="text-sm text-white/50">
          Or email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-quest"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>

      <div aria-live="polite" className="mt-6 text-sm">
        {status === 'sent-mail' && (
          <p className="text-white/70">
            Your email app should now open with the request written out — press send there to reach
            us. If nothing opened, email {CONTACT_EMAIL} directly.
          </p>
        )}
        {status === 'error' && (
          <p className="text-quest">
            Something went wrong sending your request. Please try again, or email {CONTACT_EMAIL}.
          </p>
        )}
      </div>
    </form>
  );
}
