import { Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { contactSchema } from '../../shared/validation';
import { Alert, Checkbox, Honeypot, SelectField, TextArea, TextField } from '../components/forms/Field';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/ImageReveal';
import { SectionHeading } from '../components/ui/SectionHeading';
import { pageSeo } from '../data/seo';
import { serviceSeed } from '../data/services';
import { site } from '../data/site';
import { api } from '../lib/api';
import { IS_DEMO } from '../lib/env';
import { useForm } from '../lib/useForm';
import { useSeo } from '../lib/useTitle';

function ContactForm() {
  const f = useForm(contactSchema, { name: '', email: '', phone: '', subject: '', message: '', consent: false });
  const v = (k: string) => String(f.values[k] ?? '');

  if (f.status === 'success') {
    return (
      <div role="status" className="border-t border-line pt-10">
        <p className="editorial-title text-5xl">
          Thank you.
          <br />
          <span className="editorial-italic">We’ll be in touch.</span>
        </p>
        <p className="mt-6 max-w-md opacity-70">Your message is with the studio, and we will reply as soon as we can. For anything urgent, email {site.email} directly.</p>
        <Button variant="secondary" className="mt-10" onClick={f.reset}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      aria-labelledby="enquiry-title"
      className="relative space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void f.submit((data) => api.contact(data));
      }}
    >
      <h2 id="enquiry-title" className="font-serif text-3xl">
        Send an enquiry
      </h2>
      <div className="grid gap-8 md:grid-cols-2">
        <TextField label="Name" autoComplete="name" required value={v('name')} onChange={(e) => f.set('name', e.target.value)} error={f.errors.name} />
        <TextField label="Email" type="email" autoComplete="email" required value={v('email')} onChange={(e) => f.set('email', e.target.value)} error={f.errors.email} />
        <TextField label="Phone" type="tel" autoComplete="tel" optional value={v('phone')} onChange={(e) => f.set('phone', e.target.value)} error={f.errors.phone} />
        <SelectField label="Service interest" optional value={v('subject')} onChange={(e) => f.set('subject', e.target.value)} error={f.errors.subject}>
          <option value="">Choose one…</option>
          {serviceSeed.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          <option value="Something else">Something else</option>
        </SelectField>
      </div>
      <TextArea label="Message" required rows={5} value={v('message')} onChange={(e) => f.set('message', e.target.value)} error={f.errors.message} placeholder="Tell us what you are imagining…" />
      <Checkbox
        checked={Boolean(f.values.consent)}
        onChange={(e) => f.set('consent', e.target.checked)}
        error={f.errors.consent}
        label={
          <>
            I agree that Grateful may use these details to reply to my enquiry. See the{' '}
            <Link to="/privacy" className="underline">
              privacy notice
            </Link>
            .
          </>
        }
      />
      <Honeypot value={v('company')} onChange={(val) => f.set('company', val)} />
      {f.status === 'error' && f.message && <Alert kind="error">{f.message}</Alert>}
      <Button type="submit" loading={f.status === 'submitting'} arrow className="w-full sm:w-auto">
        {f.status === 'submitting' ? 'Sending…' : 'Send Enquiry'}
      </Button>
    </form>
  );
}

export default function Contact() {
  useSeo(pageSeo['/contact']);
  return (
    <>
      <section className="page-gutter pt-32 pb-16 lg:pt-44 lg:pb-24">
        <SectionHeading as="h1" size="xl" eyebrow="(Contact the studio · Johannesburg)" lines={['Let’s create', <span className="editorial-italic">something.</span>]} />
        <FadeIn delay={0.2} className="mt-10 max-w-md">
          <p className="text-xl opacity-80">Planning a custom dress, an evening gown or an alteration? Tell us what you are imagining. Every piece starts with a conversation.</p>
        </FadeIn>
      </section>

      <section className="page-gutter border-t border-line py-16 lg:py-24">
        <div className="editorial-grid gap-y-16">
          <div className="col-span-4 md:col-span-8 lg:col-span-4">
            <ul className="space-y-8">
              <li>
                <p className="ui-label opacity-60">Email</p>
                <a href={`mailto:${site.email}`} className="mt-2 inline-flex min-h-11 items-center gap-3 font-serif text-2xl break-all hover:underline lg:text-3xl">
                  <Mail aria-hidden className="size-5 shrink-0" />
                  {site.email}
                </a>
              </li>
              <li>
                <p className="ui-label opacity-60">Location</p>
                <a href={site.mapHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-3 font-serif text-2xl hover:underline">
                  <MapPin aria-hidden className="size-5 shrink-0" />
                  {site.location}
                </a>
                <p className="mt-1 font-sans text-sm opacity-60">Studio visits by appointment.</p>
              </li>
              <li>
                <p className="ui-label opacity-60">Hours</p>
                <dl className="mt-3 space-y-1">
                  {site.hours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-6 border-b border-line py-2">
                      <dt className="opacity-70">{h.days}</dt>
                      <dd>{h.time}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            </ul>
          </div>

          <div className="col-span-4 md:col-span-8 lg:col-span-7 lg:col-start-6">
            <ContactForm />
          </div>
        </div>
      </section>

      <section aria-label="Map of Mulbarton, Johannesburg" className="border-t border-line">
        {IS_DEMO ? (
          <a href={site.mapHref} target="_blank" rel="noopener noreferrer" className="page-gutter flex min-h-32 items-center justify-between py-10 hover:underline">
            <span className="font-serif text-3xl">Mulbarton, Johannesburg — open in Maps</span>
            <MapPin aria-hidden className="size-6" />
          </a>
        ) : (
        <iframe
          title="Map showing Mulbarton, Johannesburg"
          src={site.mapEmbed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[50svh] w-full border-0"
        />
        )}
      </section>
    </>
  );
}
