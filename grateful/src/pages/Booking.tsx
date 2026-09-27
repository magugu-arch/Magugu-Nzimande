import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { addDays, formatDuration, formatLongDate, formatPriceState, todayInSast } from '../../shared/format';
import type { Service } from '../../shared/types';
import { bookingSchema, fieldErrors } from '../../shared/validation';
import { BookingCalendar } from '../components/booking/BookingCalendar';
import { BookingSummary } from '../components/booking/BookingSummary';
import { TimeSlotPicker } from '../components/booking/TimeSlotPicker';
import { Alert, Honeypot, TextArea, TextField } from '../components/forms/Field';
import { Button } from '../components/ui/Button';
import { Picture } from '../components/ui/Picture';
import { site } from '../data/site';
import { api, RequestError } from '../lib/api';
import { useServices } from '../lib/useServices';
import { useTitle } from '../lib/useTitle';

/**
 * Booking in four steps — service, date & time, details, review — sized to
 * finish on a phone in under two minutes. Progress is kept in sessionStorage
 * so a refresh or a detour to another page does not lose it. The server
 * re-checks every choice; nothing here is trusted.
 */

const STEPS = ['Service', 'Date & time', 'Your details', 'Review'] as const;
const STORE = 'grateful:booking';
const BOOKING_WINDOW_DAYS = 60;

type Details = { clientName: string; email: string; phone: string; notes: string };
type Draft = { step: number; serviceId: string | null; date: string | null; time: string | null; details: Details };

const emptyDetails: Details = { clientName: '', email: '', phone: '', notes: '' };

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export default function Booking() {
  useTitle('Book', 'Book a consultation or fitting with Grateful online — choose a service, a date and a time.');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { services, error: servicesError } = useServices();

  const [draft, setDraft] = useState<Draft>(() => {
    const saved = loadDraft();
    const fromUrl = params.get('service');
    if (fromUrl) return { step: 1, serviceId: fromUrl, date: null, time: null, details: saved?.details ?? emptyDetails };
    return saved ?? { step: 0, serviceId: null, date: null, time: null, details: emptyDetails };
  });
  const { date, time, details } = draft;
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(draft));
    } catch {
      /* private mode: progress just won't survive a refresh */
    }
  }, [draft]);

  // If the URL (or an old draft) names a service that no longer exists, fall back to choosing one.
  const unknownService = !!services && !!draft.serviceId && !services.some((s) => s.id === draft.serviceId);
  const serviceId = unknownService ? null : draft.serviceId;
  const step = unknownService ? 0 : draft.step;
  const service: Service | null = services?.find((s) => s.id === serviceId) ?? null;

  // --- availability --------------------------------------------------------
  const today = todayInSast();
  const minMonth = today.slice(0, 7);
  const maxMonth = addDays(today, BOOKING_WINDOW_DAYS).slice(0, 7);
  const [month, setMonth] = useState(date?.slice(0, 7) ?? minMonth);
  const [dates, setDates] = useState<{ key: string; list: string[] } | null>(null);
  const [slots, setSlots] = useState<{ key: string; list: string[] } | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const datesKey = `${serviceId}|${month}|${refresh}`;
  const slotsKey = `${serviceId}|${date}|${refresh}`;

  useEffect(() => {
    if (!serviceId || step !== 1) return;
    let live = true;
    api
      .availableDates(serviceId, month)
      .then((list) => live && setDates({ key: datesKey, list }))
      .catch((e: unknown) => live && setAvailabilityError(e instanceof RequestError ? e.message : 'Availability could not be loaded.'));
    return () => {
      live = false;
    };
  }, [serviceId, month, step, datesKey]);

  useEffect(() => {
    if (!serviceId || !date || step !== 1) return;
    let live = true;
    api
      .slots(serviceId, date)
      .then((list) => live && setSlots({ key: slotsKey, list }))
      .catch((e: unknown) => live && setAvailabilityError(e instanceof RequestError ? e.message : 'Times could not be loaded.'));
    return () => {
      live = false;
    };
  }, [serviceId, date, step, slotsKey]);

  const datesLoading = dates?.key !== datesKey;
  const slotsLoading = slots?.key !== slotsKey;

  // --- details & submit ----------------------------------------------------
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState('');
  const [openedAt] = useState(() => Date.now());
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the step heading so screen readers announce the new step.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const setDetail = (k: keyof Details, v: string) => {
    patch({ details: { ...details, [k]: v } });
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const detailsValid = () => {
    const parsed = bookingSchema.safeParse({ serviceId, date, time, ...details });
    if (parsed.success) return true;
    const errs = fieldErrors(parsed.error);
    const mine = Object.fromEntries(Object.entries(errs).filter(([k]) => k in emptyDetails));
    setErrors(mine);
    return Object.keys(mine).length === 0;
  };

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.createBooking({ serviceId, date, time, ...details, company, elapsedMs: Date.now() - openedAt });
      sessionStorage.removeItem(STORE);
      navigate(res.paymentRequired ? `/payment?booking=${res.bookingId}` : `/confirmation?booking=${res.bookingId}`);
    } catch (e) {
      const err = e instanceof RequestError ? e : new RequestError('Something went wrong. Please try again.', 0);
      if (err.status === 409 || err.fields.time || err.fields.date) {
        // The slot went while they were typing: send them back to pick another.
        patch({ step: 1, time: null });
        setRefresh((r) => r + 1);
        setAvailabilityError(err.message);
      } else {
        setErrors(err.fields);
        setSubmitError(err.message);
        if (Object.keys(err.fields).some((k) => k in emptyDetails)) patch({ step: 2 });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canGoTo = (i: number) => i < step || (i === 1 && !!service) || (i === 2 && !!service && !!date && !!time);

  return (
    <div className="page-gutter pt-28 pb-24 lg:pt-36">
      <div className="lg:grid lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <p className="ui-label opacity-60">(Booking)</p>
          <h1 className="editorial-title mt-6 text-5xl sm:text-6xl lg:text-7xl">
            Let’s create <span className="editorial-italic">something.</span>
          </h1>
          <p className="mt-4 max-w-md opacity-70">Book a consultation and start your next piece.</p>

          {/* Steps */}
          <nav aria-label="Booking steps" className="mt-12">
            <ol className="grid grid-cols-4 gap-2">
              {STEPS.map((label, i) => {
                const done = i < step;
                const current = i === step;
                return (
                  <li key={label}>
                    <button
                      type="button"
                      disabled={!canGoTo(i) || current}
                      onClick={() => patch({ step: i })}
                      aria-current={current ? 'step' : undefined}
                      className="group flex w-full min-h-11 flex-col items-start gap-2 text-left disabled:cursor-default"
                    >
                      <span className={`block h-px w-full ${current || done ? 'bg-white' : 'bg-white/30'}`} />
                      <span className={`ui-label flex items-center gap-1.5 ${current ? '' : done ? 'opacity-70 group-enabled:group-hover:opacity-100' : 'opacity-55'}`}>
                        {done ? <Check aria-hidden className="size-3" /> : <span aria-hidden>{String(i + 1).padStart(2, '0')}</span>}
                        <span className="hidden sm:inline">{label}</span>
                        <span className="sr-only sm:hidden">{label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Mobile summary: always visible once a service is chosen. */}
          {service && step > 0 && (
            <div className="mt-8 border-y border-line py-4 lg:hidden">
              <BookingSummary service={service} date={date} time={time} compact />
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={step}
              aria-labelledby="step-title"
              className="mt-10"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 id="step-title" ref={heading} tabIndex={-1} className="font-serif text-3xl outline-none">
                <span className="ui-label mr-3 align-middle opacity-50">{String(step + 1).padStart(2, '0')}</span>
                {['Choose a service', 'Choose a date and time', 'Your details', 'Review your booking'][step]}
              </h2>

              {/* 1. Service */}
              {step === 0 && (
                <div className="mt-8">
                  {servicesError && <Alert kind="error">{servicesError}</Alert>}
                  {!services && !servicesError && (
                    <div className="space-y-3" aria-busy="true">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="skeleton h-28" />
                      ))}
                    </div>
                  )}
                  <div role="radiogroup" aria-label="Services" className="space-y-3">
                    {services?.map((s) => {
                      const on = s.id === serviceId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => {
                            if (s.id !== serviceId) setMonth(minMonth);
                            patch({ serviceId: s.id, date: s.id === serviceId ? date : null, time: s.id === serviceId ? time : null, step: 1 });
                          }}
                          className={`flex w-full items-stretch gap-4 border text-left transition-colors ${on ? 'border-white bg-white text-black' : 'border-white/25 hover:border-white'}`}
                        >
                          <Picture image={s.image} alt="" mono sizes="96px" className="w-20 shrink-0 sm:w-24" />
                          <span className="flex flex-1 flex-col justify-center py-4 pr-4">
                            <span className="font-serif text-xl leading-tight sm:text-2xl">{s.name}</span>
                            <span className="mt-2 font-sans text-sm opacity-70">
                              {formatDuration(s.durationMinutes)} · {formatPriceState(s.priceCents)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Date & time */}
              {step === 1 && serviceId && (
                <div className="mt-8 space-y-12">
                  {availabilityError && (
                    <Alert kind="error">
                      {availabilityError}
                    </Alert>
                  )}
                  <BookingCalendar
                    month={month}
                    onMonth={setMonth}
                    minMonth={minMonth}
                    maxMonth={maxMonth}
                    available={datesLoading ? null : (dates?.list ?? null)}
                    loading={datesLoading}
                    selected={date}
                    onSelect={(d) => {
                      setAvailabilityError(null);
                      patch({ date: d, time: null });
                    }}
                  />
                  {date && <TimeSlotPicker date={date} slots={slotsLoading ? null : (slots?.list ?? null)} loading={slotsLoading} selected={time} onSelect={(t) => patch({ time: t })} />}
                  <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
                    <Button variant="ghost" onClick={() => patch({ step: 0 })}>
                      <ArrowLeft aria-hidden className="size-4" /> Back
                    </Button>
                    <Button disabled={!date || !time} onClick={() => patch({ step: 2 })} arrow>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. Details */}
              {step === 2 && (
                <form
                  noValidate
                  className="relative mt-8 space-y-8"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (detailsValid()) patch({ step: 3 });
                  }}
                >
                  <TextField label="Full name" autoComplete="name" value={details.clientName} onChange={(e) => setDetail('clientName', e.target.value)} error={errors.clientName} required />
                  <div className="grid gap-8 sm:grid-cols-2">
                    <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={details.email} onChange={(e) => setDetail('email', e.target.value)} error={errors.email} required />
                    <TextField label="Phone" type="tel" autoComplete="tel" inputMode="tel" value={details.phone} onChange={(e) => setDetail('phone', e.target.value)} error={errors.phone} required hint="For appointment reminders only." />
                  </div>
                  <TextArea
                    label="Project notes"
                    optional
                    value={details.notes}
                    onChange={(e) => setDetail('notes', e.target.value)}
                    error={errors.notes}
                    placeholder="The occasion, the idea, fabrics you love, a date you are working towards…"
                  />
                  <Honeypot value={company} onChange={setCompany} />
                  <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
                    <Button type="button" variant="ghost" onClick={() => patch({ step: 1 })}>
                      <ArrowLeft aria-hidden className="size-4" /> Back
                    </Button>
                    <Button type="submit" arrow>
                      Review
                    </Button>
                  </div>
                </form>
              )}

              {/* 4. Review */}
              {step === 3 && service && date && time && (
                <div className="mt-8 space-y-10">
                  <dl className="border-t border-line">
                    {(
                      [
                        ['Service', service.name],
                        ['Date', formatLongDate(date)],
                        ['Time', `${time} SAST · ${formatDuration(service.durationMinutes)}`],
                        ['Name', details.clientName],
                        ['Email', details.email],
                        ['Phone', details.phone],
                        ['Notes', details.notes || '—'],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-3 gap-4 border-b border-line py-4">
                        <dt className="ui-label pt-1 opacity-60">{k}</dt>
                        <dd className="col-span-2 break-words whitespace-pre-line">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="border border-line p-5">
                    <p className="ui-label opacity-60">Payment</p>
                    {service.priceCents ? (
                      <p className="mt-3">
                        {formatPriceState(service.priceCents)}. You’ll choose {service.depositCents ? 'a deposit or full payment' : 'to pay'} on the next screen, through our secure payment partner. Your time is held for 20 minutes while you pay.
                      </p>
                    ) : (
                      <p className="mt-3">No payment is needed to book. We’ll prepare a quote for your piece after we have met.</p>
                    )}
                    <ul className="mt-4 space-y-1 font-sans text-sm opacity-70">
                      {site.paymentTerms.slice(service.priceCents ? 0 : 2).map((t) => (
                        <li key={t}>— {t}</li>
                      ))}
                    </ul>
                  </div>

                  {submitError && <Alert kind="error">{submitError}</Alert>}

                  <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
                    <Button variant="ghost" onClick={() => patch({ step: 2 })}>
                      <ArrowLeft aria-hidden className="size-4" /> Edit
                    </Button>
                    <Button onClick={() => void submit()} loading={submitting} arrow>
                      {service.priceCents ? 'Continue to Payment' : 'Confirm Booking'}
                    </Button>
                  </div>
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        <aside aria-label="Booking summary" className="hidden lg:col-span-4 lg:col-start-9 lg:block">
          <div className="sticky top-28">
            <BookingSummary service={service} date={date} time={time} />
            <p className="mt-8 font-sans text-sm opacity-60">
              Questions first? Call <a className="underline" href={site.phoneHref}>{site.phone}</a> or <Link className="underline" to="/contact">send a message</Link>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
