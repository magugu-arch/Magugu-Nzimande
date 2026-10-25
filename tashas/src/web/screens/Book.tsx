import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getDevice, isArtifactViewer, settle, sys, track } from '../app.ts';
import { openSheet, push } from '../nav.ts';
import type { BookPreset } from '../nav.ts';
import { Banner, Button, Check, Field, KV, LinkButton, Photo, SampleTag, Stepper, copyText, errorMessage, toast } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { SheetHead, useSheet } from '../components/Sheet.tsx';
import { branch, idempotencyKey, me, plural } from '../format.ts';
import type { AvailabilityResult, SubmitResult } from '../../domain/booking/service.ts';
import { depositFor, policyLines } from '../../domain/booking/policy.ts';
import { effectivePolicy } from '../../domain/content.ts';
import { DomainError, formatZar, isDomainError, normalisePhone, isValidEmail, isValidName } from '../../domain/util/core.ts';
import { formatDateLong, formatDateShort, weekday } from '../../domain/util/time.ts';
import type { BookingAttempt, SandboxScenario } from '../../domain/types.ts';
import { PAYMENT_STATUS_LABEL, isSettledSuccess, isTerminalFailure } from '../../domain/payments/stateMachine.ts';
import { googleCalendarHref, icsFile, saveFile } from '../share.ts';
import { tick } from '../motion/spring.ts';

type Step = 'when' | 'details' | 'review' | 'result';

// ------------------------------------------------------------ availability

export function useAvailability(branchId: string, date: string, partySize: number, nonce: number) {
  const [state, setState] = useState<{ loading: boolean; data: AvailabilityResult | null; error: string | null }>({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    sys.bookings
      .availability(branchId, date, partySize)
      .then((data) => live && setState({ loading: false, data, error: null }))
      .catch((err) => live && setState({ loading: false, data: null, error: isDomainError(err, 'provider_unavailable') ? 'provider' : errorMessage(err) }));
    return () => {
      live = false;
    };
  }, [branchId, date, partySize, nonce]);
  return state;
}

function DateStrip({ branchId, value, onChange }: { branchId: string; value: string; onChange: (d: string) => void }) {
  const dates = sys.bookings.bookableDates(branchId);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);
  return (
    <div class="hscroll" ref={ref} role="group" aria-label="Date">
      {dates.map((d) => {
        const p = formatDateShort(d);
        return (
          <button type="button" key={d} class="date-pill" aria-pressed={d === value ? 'true' : 'false'} aria-label={formatDateLong(d)} onClick={() => onChange(d)}>
            <span class="w">{p.weekday}</span>
            <span class="d">{p.day}</span>
            <span class="m">{p.month}</span>
          </button>
        );
      })}
    </div>
  );
}

function Times({
  availability,
  selected,
  onSelect,
  focusPeriod,
}: {
  availability: ReturnType<typeof useAvailability>;
  selected: string | null;
  onSelect: (time: string, available: boolean) => void;
  focusPeriod?: string;
}) {
  if (availability.loading && !availability.data) {
    return (
      <div class="row" style={{ padding: '18px 0' }}>
        <span class="spinner" />
        <span class="callout">Checking live times with the café…</span>
      </div>
    );
  }
  if (availability.error === 'provider') {
    return (
      <Banner tone="bad" icon="alert">
        <p class="title-3">Online booking is not responding right now</p>
        <p class="callout">The café’s booking system did not answer. Nothing has been booked. Try again in a moment, or contact the café.</p>
      </Banner>
    );
  }
  if (availability.error) return <Banner tone="bad">{availability.error}</Banner>;
  const data = availability.data!;
  if (data.closed) return <Banner tone="neutral" icon="calendar">The café is closed that day.</Banner>;
  const ordered = focusPeriod ? [...data.periods].sort((a) => (a.id === focusPeriod ? -1 : 1)) : data.periods;
  return (
    <div class="stack" style={{ gap: '18px', opacity: availability.loading ? 0.6 : 1, transition: 'opacity 160ms' }}>
      {ordered.map((p) => {
        const open = p.slots.filter((s) => s.available).length;
        return (
          <div class="stack" key={p.id}>
            <div class="row between">
              <span class="title-3">{p.label}</span>
              <span class="footnote">
                {p.deposit.amountMinor > 0 ? `Deposit ${formatZar(p.deposit.perGuestMinor)} pp · ` : ''}
                {open ? `${open} times open` : 'Fully booked'}
              </span>
            </div>
            <div class="times">
              {p.slots.map((s) => (
                <button
                  type="button"
                  key={s.time}
                  class={`time ${s.available ? '' : 'full'}`}
                  aria-pressed={selected === s.time ? 'true' : 'false'}
                  aria-label={`${s.time}${s.available ? '' : ', full'}`}
                  onClick={() => onSelect(s.time, s.available)}
                >
                  {s.time}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p class="footnote">Times checked live with the café just now. Your table is held for a few minutes once you choose one.</p>
    </div>
  );
}

// ------------------------------------------------------------- book sheet

function initialDate(branchId: string, preset: BookPreset): string {
  const dates = sys.bookings.bookableDates(branchId);
  if (preset.date && dates.includes(preset.date)) return preset.date;
  if (preset.weekday !== undefined) {
    const d = dates.find((x, i) => i > 0 && weekday(x) === preset.weekday);
    if (d) return d;
  }
  return dates[1] ?? dates[0]!;
}

export function BookSheet({ preset }: { preset: BookPreset }) {
  const guest = me();
  const branches = sys.ctx.content.branches;
  const [branchId, setBranchId] = useState(preset.branchId ?? guest?.homeBranchId ?? branches[0]!.id);
  const policy = effectivePolicy(sys.ctx, branchId);
  const [partySize, setPartySize] = useState(Math.min(preset.partySize ?? 2, policy.maxOnlinePartySize));
  const [date, setDate] = useState(() => initialDate(branchId, preset));
  const [nonce, setNonce] = useState(0);
  const availability = useAvailability(branchId, date, partySize, nonce);
  const [time, setTime] = useState<string | null>(null);
  const [waitlistTime, setWaitlistTime] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('when');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const keyRef = useRef(idempotencyKey('book'));
  const [attemptId, setAttemptId] = useState<string | null>(null);

  /** One attempt per café: switching café starts a fresh one with a new key. */
  const attemptFor = (forBranch: string): string => {
    if (attemptId && sys.bookings.attempt(attemptId).branchId === forBranch) return attemptId;
    if (attemptId) keyRef.current = idempotencyKey('book');
    const a = sys.bookings.startAttempt({ guestId: getDevice().guestId, branchId: forBranch, idempotencyKey: keyRef.current, attribution: getDevice().attribution });
    setAttemptId(a.id);
    return a.id;
  };

  const pick = async (t: string, available: boolean) => {
    setNotice(null);
    if (!available) {
      setTime(null);
      setWaitlistTime(t);
      return;
    }
    setWaitlistTime(null);
    setTime(t);
    setBusy(true);
    try {
      const id = attemptFor(branchId);
      await sys.bookings.selectSlot(id, { date, time: t, partySize });
      tick(6);
      setStep('details');
    } catch (err) {
      setTime(null);
      if (isDomainError(err, 'slot_unavailable')) {
        const alts = (err.details?.alternatives as string[] | undefined) ?? [];
        setNotice(`${t} was taken a moment ago.${alts.length ? ` Nearby: ${alts.join(', ')}.` : ''}`);
        setNonce((n) => n + 1);
      } else if (isDomainError(err, 'provider_unavailable')) {
        setNotice('The café’s booking system did not answer. Nothing was booked; please try again.');
      } else {
        setNotice(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const attempt = attemptId ? sys.db.get('bookingAttempts', attemptId) : undefined;
  const steps: Step[] = ['when', 'details', 'review', 'result'];
  const stepIndex = steps.indexOf(step);

  return (
    <>
      <SheetHead
        title={step === 'result' ? 'Your booking' : waitlistTime && step !== 'when' ? 'Join the waitlist' : 'Book a table'}
        sub={step === 'when' ? 'Choose a café, a day and a time' : `${branch(branchId).name} · ${formatDateLong(date)}`}
        leading={
          step === 'details' || step === 'review' ? (
            <button type="button" class="iconbtn" aria-label="Back" onClick={() => setStep(step === 'review' ? 'details' : 'when')} style={{ width: '32px', height: '32px', marginLeft: '-6px' }}>
              <Icon name="back" size={20} />
            </button>
          ) : undefined
        }
      />
      <div style={{ padding: '0 var(--gutter-r) 6px var(--gutter)' }}>
        <div class="steps" aria-hidden="true">
          {steps.slice(0, 3).map((s, i) => (
            <span key={s} class={i <= stepIndex ? 'done' : ''} />
          ))}
        </div>
      </div>

      {step === 'when' ? (
        <>
          <div class="sheet-body">
            <div class="stack">
              <span class="caption">Café</span>
              <div class="hscroll" role="group" aria-label="Café">
                {branches.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    class="chip"
                    aria-pressed={b.id === branchId ? 'true' : 'false'}
                    onClick={() => {
                      setBranchId(b.id);
                      setTime(null);
                      setWaitlistTime(null);
                      const dates = sys.bookings.bookableDates(b.id);
                      if (!dates.includes(date)) setDate(dates[1] ?? dates[0]!);
                      const max = effectivePolicy(sys.ctx, b.id).maxOnlinePartySize;
                      if (partySize > max) setPartySize(max);
                    }}
                  >
                    {b.suburb}
                  </button>
                ))}
              </div>
            </div>
            <div class="row between">
              <div class="stack-sm">
                <span class="caption">Guests</span>
                <span class="footnote">More than {policy.maxOnlinePartySize}? Please contact the café.</span>
              </div>
              <Stepper label="Guests" value={partySize} min={1} max={policy.maxOnlinePartySize} onChange={(n) => { setPartySize(n); setTime(null); setWaitlistTime(null); }} unit={(n) => plural(n, 'guest')} />
            </div>
            <div class="stack">
              <span class="caption">Day</span>
              <DateStrip branchId={branchId} value={date} onChange={(d) => { setDate(d); setTime(null); setWaitlistTime(null); }} />
            </div>
            {notice ? (
              <Banner tone="warn" icon="clock">
                <p>{notice}</p>
              </Banner>
            ) : null}
            <Times availability={availability} selected={time ?? waitlistTime} onSelect={pick} focusPeriod={preset.period} />
            {waitlistTime ? (
              <div class="card stack">
                <p class="title-3">{waitlistTime} is fully booked</p>
                {availability.data?.waitlist ? (
                  <>
                    <p class="callout">Join the waitlist and we will tell you if a table opens up. It is not a booking, and you will not be charged.</p>
                    <Button variant="primary" onClick={() => { attemptFor(branchId); setStep('details'); }}>
                      Join the waitlist for {waitlistTime}
                    </Button>
                  </>
                ) : (
                  <p class="callout">This café does not run an online waitlist. Choose another time or contact the café.</p>
                )}
              </div>
            ) : null}
            {availability.error === 'provider' ? (
              <Button icon="refresh" onClick={() => setNonce((n) => n + 1)}>
                Try again
              </Button>
            ) : null}
          </div>
          {busy ? (
            <div class="sheet-foot">
              <div class="row">
                <span class="spinner" />
                <span class="callout">Holding {time} for you…</span>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {step === 'details' && attemptId ? (
        <DetailsStep
          attemptId={attemptId}
          waitlistTime={waitlistTime}
          onDone={async () => {
            if (waitlistTime) {
              try {
                await sys.bookings.joinWaitlist(attemptId, { date, time: waitlistTime, partySize });
                await settle();
                setStep('result');
              } catch (err) {
                toast(errorMessage(err), 'alert');
              }
              return;
            }
            setStep('review');
          }}
        />
      ) : null}

      {step === 'review' && attempt ? <ReviewStep attempt={attempt} onResult={() => setStep('result')} onChooseAgain={() => setStep('when')} /> : null}

      {step === 'result' && attempt ? (
        <ResultView
          attemptId={attempt.id}
          onChooseAgain={() => {
            setTime(null);
            setNonce((n) => n + 1);
            setStep('when');
          }}
        />
      ) : null}
    </>
  );
}

function HoldChip({ attempt }: { attempt: BookingAttempt }) {
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setNow((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!attempt.expiryAt || !attempt.selectedSlot) return null;
  const left = Math.max(0, attempt.expiryAt - sys.ctx.clock.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  if (left === 0) {
    return <span class="hold" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>Hold lapsed · we will re-check {attempt.selectedSlot.time} when you confirm</span>;
  }
  return (
    <span class="hold" aria-live="off">
      <Icon name="clock" size={16} /> Holding {attempt.selectedSlot.time} for {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

function DetailsStep({ attemptId, waitlistTime, onDone }: { attemptId: string; waitlistTime: string | null; onDone: () => void }) {
  const attempt = sys.bookings.attempt(attemptId);
  const guest = me();
  const policy = effectivePolicy(sys.ctx, attempt.branchId);
  const d = attempt.guestDetails;
  const [name, setName] = useState(d?.name ?? guest?.name ?? '');
  const [email, setEmail] = useState(d?.email ?? guest?.email ?? '');
  const [phone, setPhone] = useState(d?.phone ?? guest?.phone ?? '');
  const [occasion, setOccasion] = useState(d?.occasion ?? '');
  const [seating, setSeating] = useState(d?.seating ?? policy.seatingOptions[0] ?? '');
  const [access, setAccess] = useState(d?.accessibilityNote ?? '');
  const [request, setRequest] = useState(d?.specialRequest ?? '');
  const [optIn, setOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const settings = sys.db.require('settings', 'global');
  const alreadySubscribed = guest ? sys.consent.hasMarketingConsent(guest.id, 'email') : false;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!isValidName(name)) e.name = 'Enter the name the booking is under.';
    if (!isValidEmail(email)) e.email = 'Enter an email address like name@example.com.';
    if (!normalisePhone(phone)) e.phone = 'Enter a mobile number like 082 123 4567.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: Event) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      const details = { name, email, phone, occasion, specialRequest: request, accessibilityNote: access, seating: seating === 'No preference' ? '' : seating };
      const updated = sys.bookings.setGuestDetails(attemptId, details);
      if (optIn && updated.guestId) sys.consent.grant(updated.guestId, 'email', 'booking-form', { kind: 'guest', id: updated.guestId });
      onDone();
    } catch (err) {
      if (err instanceof DomainError) {
        const field = err.code === 'invalid_name' ? 'name' : err.code === 'invalid_email' ? 'email' : err.code === 'invalid_phone' ? 'phone' : 'form';
        setErrors({ [field]: err.message });
      } else setErrors({ form: errorMessage(err) });
    }
  };

  return (
    <form class="contents" onSubmit={submit} noValidate style={{ display: 'contents' }}>
      <div class="sheet-body">
        {waitlistTime ? (
          <Banner tone="neutral" icon="clock">
            <p>Waitlist for {waitlistTime}, {plural(attempt.selectedSlot?.partySize ?? 2, 'guest')}. We only need your contact details.</p>
          </Banner>
        ) : (
          <HoldChip attempt={attempt} />
        )}
        <div class="stack">
          <Field id="bk-name" label="Name" error={errors.name}>
            <input id="bk-name" class="input" autocomplete="name" value={name} aria-invalid={errors.name ? 'true' : undefined} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          </Field>
          <Field id="bk-email" label="Email" error={errors.email} hint="For your confirmation and receipt.">
            <input id="bk-email" class="input" type="email" autocomplete="email" inputMode="email" value={email} aria-invalid={errors.email ? 'true' : undefined} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
          </Field>
          <Field id="bk-phone" label="Mobile" error={errors.phone} hint="The café uses this only if it needs to reach you about the booking.">
            <input id="bk-phone" class="input" type="tel" autocomplete="tel" inputMode="tel" value={phone} aria-invalid={errors.phone ? 'true' : undefined} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
          </Field>
        </div>
        {!waitlistTime ? (
          <>
            <div class="stack">
              <span class="caption">Occasion (optional)</span>
              <div class="row wrap" style={{ gap: '8px' }}>
                {['Birthday', 'Anniversary', 'Business', 'Celebration'].map((o) => (
                  <button type="button" key={o} class="chip" aria-pressed={occasion === o ? 'true' : 'false'} onClick={() => setOccasion(occasion === o ? '' : o)}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            {policy.seatingOptions.length > 1 ? (
              <div class="stack">
                <span class="caption">Seating preference</span>
                <div class="row wrap" style={{ gap: '8px' }}>
                  {policy.seatingOptions.map((o) => (
                    <button type="button" key={o} class="chip" aria-pressed={seating === o ? 'true' : 'false'} onClick={() => setSeating(o)}>
                      {o}
                    </button>
                  ))}
                </div>
                <span class="footnote">A preference, not a guarantee.</span>
              </div>
            ) : null}
            {policy.acceptsAccessibilityNotes ? (
              <Field id="bk-access" label="Access needs (optional)" hint="For example step-free access or space for a wheelchair.">
                <textarea id="bk-access" class="textarea" maxLength={300} value={access} onInput={(e) => setAccess((e.target as HTMLTextAreaElement).value)} />
              </Field>
            ) : null}
            <Field id="bk-request" label="Anything else (optional)">
              <textarea id="bk-request" class="textarea" maxLength={300} value={request} onInput={(e) => setRequest((e.target as HTMLTextAreaElement).value)} />
            </Field>
          </>
        ) : null}
        {!alreadySubscribed ? (
          <div class="card flat stack">
            <Check id="bk-optin" checked={optIn} onChange={setOptIn}>
              Also send me seasonal menus and events by email. Optional, and separate from this booking.
            </Check>
            <p class="footnote">{settings.consentText} (wording {settings.consentTextVersion})</p>
          </div>
        ) : null}
        {errors.form ? <Banner tone="bad">{errors.form}</Banner> : null}
        <p class="footnote">We ask only for what the café needs to hold your table. See Privacy in your profile for how it is used.</p>
      </div>
      <div class="sheet-foot">
        <Button type="submit" variant="primary" block>
          {waitlistTime ? 'Join the waitlist' : 'Continue'}
        </Button>
      </div>
    </form>
  );
}

const SCENARIOS: { id: string; label: string; patch: Partial<SandboxScenario> }[] = [
  { id: 'normal', label: 'Everything works', patch: { nextCreate: 'normal', stealHeldSlot: false, duplicateWebhooks: false, dropWebhooks: false } },
  { id: 'timeout', label: 'The café system saves the booking but times out', patch: { nextCreate: 'timeout-after-commit' } },
  { id: 'steal', label: 'Another guest takes the table just before you confirm', patch: { stealHeldSlot: true } },
  { id: 'refuse', label: 'The café system refuses the booking (after any payment)', patch: { nextCreate: 'unavailable' } },
  { id: 'dupe', label: 'Payment webhooks arrive twice', patch: { duplicateWebhooks: true } },
  { id: 'drop', label: 'Payment webhooks never arrive (status API only)', patch: { dropWebhooks: true } },
];

function ReviewStep({ attempt, onResult, onChooseAgain }: { attempt: BookingAttempt; onResult: () => void; onChooseAgain: () => void }) {
  const b = branch(attempt.branchId);
  const policy = effectivePolicy(sys.ctx, attempt.branchId);
  const slot = attempt.selectedSlot!;
  const deposit = depositFor(policy, slot);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState('normal');

  const submit = async () => {
    setError(null);
    if (!accepted) {
      setError('Please confirm you have read the booking terms.');
      return;
    }
    setBusy(true);
    try {
      const chosen = SCENARIOS.find((s) => s.id === scenario)!;
      sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, ...SCENARIOS[0]!.patch, ...chosen.patch } }));
      const result: SubmitResult = await sys.bookings.submit(attempt.id, { policyAccepted: true });
      track('booking_submit', { result: result.status, deposit: deposit.amountMinor > 0 });
      if (result.status === 'policy-changed') {
        setError('The café’s terms changed while you were booking. Please review the amount below and confirm again.');
        setAccepted(false);
        return;
      }
      if (result.status === 'checkout') {
        openSheet({ name: 'checkout', paymentId: result.paymentId, returnTo: { kind: 'attempt', id: attempt.id } });
      }
      if (result.status === 'confirmed') {
        tick([10, 40, 14]);
        track('booking_confirmed', { branchId: attempt.branchId });
      }
      onResult();
      void settle();
    } catch (err) {
      if (isDomainError(err, 'no_slot')) onChooseAgain();
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div class="sheet-body">
        <HoldChip attempt={attempt} />
        <div class="card summary-card">
          <Photo id={b.heroImageId} />
          <div class="stack-sm">
            <span class="title-3">{b.name}</span>
            <span class="callout">{formatDateLong(slot.date)} at {slot.time}</span>
            <span class="callout">{plural(slot.partySize, 'guest')}</span>
            {attempt.guestDetails?.occasion ? <span class="footnote">{attempt.guestDetails.occasion}</span> : null}
          </div>
        </div>
        <div class="card stack">
          <div class="row between">
            <span class="title-3">{deposit.amountMinor > 0 ? 'Deposit due now' : 'Nothing to pay now'}</span>
            <span class="title-2 num">{formatZar(deposit.amountMinor)}</span>
          </div>
          {deposit.amountMinor > 0 ? (
            <p class="footnote">
              {deposit.rule?.label}: {formatZar(deposit.perGuestMinor)} × {slot.partySize}. Calculated by Tashas from the café’s current policy, in South African rand. Paid through a secure hosted checkout; your card details never reach this app.
            </p>
          ) : null}
        </div>
        <div class="stack">
          <span class="caption">Booking terms · {b.suburb}</span>
          <div class="card flat stack">
            {policyLines(policy, deposit).map((l) => (
              <p class="callout" key={l} style={{ color: 'var(--ink)' }}>
                {l}
              </p>
            ))}
            <span class="row" style={{ gap: '8px' }}>
              <span class="footnote">Policy {policy.version}</span>
              <SampleTag label="Sample terms" />
            </span>
          </div>
        </div>
        <Check id="bk-terms" checked={accepted} onChange={setAccepted}>
          I have read the booking terms{deposit.amountMinor > 0 ? ', including when the deposit is refunded' : ''}.
        </Check>
        {error ? <Banner tone="bad">{error}</Banner> : null}
        <details class="disclosure">
          <summary>
            <span class="row" style={{ gap: '10px' }}>
              <Icon name="sliders" size={19} /> Sandbox: simulate a provider problem
            </span>
            <Icon name="down" size={18} />
          </summary>
          <div class="disclosure-body" role="radiogroup" aria-label="Sandbox scenario">
            {SCENARIOS.map((s) => (
              <label class="check" key={s.id} for={`sc-${s.id}`}>
                <input id={`sc-${s.id}`} type="radio" name="scenario" checked={scenario === s.id} onChange={() => setScenario(s.id)} style={{ borderRadius: '999px' }} />
                <span class="callout" style={{ color: 'var(--ink)' }}>{s.label}</span>
              </label>
            ))}
            <p class="footnote">For reviewers: these drive the sandbox adapters so the failure states in the brief can be seen. They do not exist in production.</p>
          </div>
        </details>
      </div>
      <div class="sheet-foot">
        <Button variant="primary" block busy={busy} icon={deposit.amountMinor > 0 ? 'lock' : 'check'} onClick={submit}>
          {deposit.amountMinor > 0 ? `Pay ${formatZar(deposit.amountMinor)} deposit` : 'Confirm booking'}
        </Button>
      </div>
    </>
  );
}

// ----------------------------------------------------------- result view

export function ResultView({ attemptId, onChooseAgain }: { attemptId: string; onChooseAgain?: () => void }) {
  const attempt = sys.bookings.attempt(attemptId);
  const payment = attempt.paymentId ? sys.payments.get(attempt.paymentId) : null;
  const lastPayment = sys.db.where('payments', (p) => p.bookingAttemptId === attemptId).sort((a, b) => b.createdAt - a.createdAt)[0];
  const { close } = useSheet();
  const b = branch(attempt.branchId);
  const [busy, setBusy] = useState(false);

  if (attempt.state === 'confirmed' && attempt.bookingId) {
    return <Confirmation bookingId={attempt.bookingId} onDone={close} />;
  }
  if (attempt.state === 'waitlisted' && attempt.bookingId) {
    const bk = sys.bookings.booking(attempt.bookingId);
    return (
      <div class="sheet-body" style={{ justifyItems: 'center', textAlign: 'center' }}>
        <div class="success-mark" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
          <Icon name="clock" size={34} />
        </div>
        <h2 class="title-1">You are on the waitlist</h2>
        <p class="callout">
          {b.name}, {formatDateLong(bk.date)} around {bk.time} for {plural(bk.partySize, 'guest')}. This is not a confirmed booking; we will tell you if a table opens up.
        </p>
        <span class="reference">{bk.reference}</span>
        <Button variant="primary" onClick={close}>Done</Button>
      </div>
    );
  }

  let tone: 'wait' | 'warn' | 'bad' = 'wait';
  let title = '';
  let body = '';
  let actions: ComponentChildren = null;

  if (attempt.state === 'pending-payment' && payment && !isSettledSuccess(payment.status) && !isTerminalFailure(payment.status)) {
    title = 'Finish paying in the secure checkout';
    body = `Status: ${PAYMENT_STATUS_LABEL[payment.status]}. Your table is held while you pay.`;
    actions = (
      <Button variant="primary" icon="lock" onClick={() => openSheet({ name: 'checkout', paymentId: payment.id, returnTo: { kind: 'attempt', id: attemptId } })}>
        Return to checkout
      </Button>
    );
  } else if ((attempt.state === 'pending-payment' && payment && isSettledSuccess(payment.status)) || attempt.state === 'requested') {
    title = payment && isSettledSuccess(payment.status) ? 'Payment received. Confirming your table…' : 'Confirming with the café…';
    body = 'This can take a moment. Please do not book again; we are confirming the table you chose and will update this screen.';
  } else if (attempt.state === 'reconciliation') {
    tone = 'warn';
    title = 'Your payment is safe. Your table is not confirmed yet.';
    body = `We received your deposit of ${formatZar(attempt.depositAmountMinor)} but could not confirm the table at ${b.name}. Our team has been alerted and will either confirm it or refund you in full. You do not need to pay again.`;
    actions = <Button onClick={close}>Close</Button>;
  } else if (attempt.state === 'availability-selected' && lastPayment && isTerminalFailure(lastPayment.status)) {
    tone = 'bad';
    title = lastPayment.status === 'cancelled' ? 'Payment cancelled' : 'Your payment did not go through';
    body = 'You have not been charged and nothing was booked. Your table is still held for a few minutes.';
    actions = (
      <>
        <Button
          variant="primary"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await sys.bookings.submit(attemptId, { policyAccepted: true });
              if (r.status === 'checkout') openSheet({ name: 'checkout', paymentId: r.paymentId, returnTo: { kind: 'attempt', id: attemptId } });
            } catch (err) {
              toast(errorMessage(err), 'alert');
            } finally {
              setBusy(false);
            }
          }}
        >
          Try paying again
        </Button>
        {onChooseAgain ? <Button onClick={onChooseAgain}>Choose another time</Button> : null}
      </>
    );
  } else if (['failed', 'expired', 'cancelled'].includes(attempt.state)) {
    tone = 'bad';
    const reason = attempt.failureReason ?? attempt.state;
    const refunded = payment ? payment.refundedMinor > 0 || payment.status === 'refund-pending' : false;
    title = 'We could not book that table';
    body =
      reason === 'slot_unavailable'
        ? 'That time was taken just before we could confirm it. You have not been charged.'
        : reason === 'slot_expired_during_payment'
          ? `The table was released while payment was in progress, so your deposit ${refunded ? 'has been refunded in full' : 'is being refunded'}.`
          : reason === 'refunded_after_booking_failure'
            ? 'The café could not confirm the table, so your deposit was refunded in full.'
            : reason === 'hold_expired' || reason === 'payment_not_completed' || reason === 'abandoned'
              ? 'The hold on this table lapsed and it is no longer free. Nothing was charged.'
              : `The booking could not be completed (${reason}). ${payment ? 'Any payment taken is refunded in full.' : 'You have not been charged.'}`;
    actions = onChooseAgain ? (
      <Button variant="primary" onClick={onChooseAgain}>
        Choose another time
      </Button>
    ) : null;
  } else {
    title = 'Working on it…';
    body = '';
  }

  return (
    <div class="sheet-body" style={{ justifyItems: 'center', textAlign: 'center', paddingTop: '28px' }} aria-live="polite">
      {tone === 'wait' ? <span class="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} /> : (
        <div class="success-mark" style={{ background: tone === 'bad' ? 'var(--danger-soft)' : 'var(--warning-soft)', color: tone === 'bad' ? 'var(--danger)' : 'var(--warning)' }}>
          <Icon name={tone === 'bad' ? 'alert' : 'shield'} size={34} />
        </div>
      )}
      <h2 class="title-2" style={{ maxWidth: '30ch' }}>{title}</h2>
      {body ? <p class="callout" style={{ maxWidth: '44ch' }}>{body}</p> : null}
      <div class="stack" style={{ width: '100%', maxWidth: '360px' }}>{actions}</div>
    </div>
  );
}

function Confirmation({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const bk = sys.bookings.booking(bookingId);
  const b = branch(bk.branchId);
  const policy = effectivePolicy(sys.ctx, bk.branchId);
  const calendar = {
    title: `Table at ${b.name}`,
    startsAt: bk.startsAt,
    minutes: 90,
    details: `Booking reference ${bk.reference} for ${plural(bk.partySize, 'guest')}. Manage it in the Tashas app.`,
    location: `${b.name}, ${b.city}`,
  };
  return (
    <>
      <div class="sheet-body" style={{ justifyItems: 'center', textAlign: 'center', paddingTop: '20px' }}>
        <div class="success-mark" aria-hidden="true">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h2 class="title-1">You are booked</h2>
        <p class="callout">We have sent the confirmation to your inbox.</p>
        <button type="button" class="reference" title="Copy reference" onClick={async () => toast((await copyText(bk.reference)) ? 'Reference copied' : 'Select the reference to copy it', 'check')}>
          {bk.reference}
        </button>
        <div class="card" style={{ width: '100%', textAlign: 'left' }}>
          <KV
            rows={[
              ['Café', b.name],
              ['When', `${formatDateLong(bk.date)} at ${bk.time}`],
              ['Guests', String(bk.partySize)],
              ['Deposit paid', bk.depositPaidMinor > 0 ? formatZar(bk.depositPaidMinor) : 'None'],
              ['Cancel free until', bk.depositPaidMinor > 0 ? `${policy.freeCancellationHours} h before` : 'Any time'],
            ]}
          />
        </div>
        <div class="row wrap" style={{ justifyContent: 'center' }}>
          <LinkButton href={googleCalendarHref(calendar)} icon="calendar" small>
            Add to Google Calendar
          </LinkButton>
          {!isArtifactViewer() ? (
            <Button small icon="download" onClick={async () => toast((await saveFile(`tashas-${bk.reference}.ics`, icsFile({ uid: bk.id, ...calendar }), 'text/calendar')).message, 'calendar')}>
              Calendar file
            </Button>
          ) : null}
        </div>
      </div>
      <div class="sheet-foot">
        <div class="row">
          <Button block onClick={() => { onDone(); push({ name: 'booking', id: bk.id }, 'profile'); }}>
            Manage booking
          </Button>
          <Button variant="primary" block onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
}

// -------------------------------------------------------- sandbox checkout

export function CheckoutSheet({ paymentId, returnTo }: { paymentId: string; returnTo: { kind: 'attempt' | 'event'; id: string } }) {
  const payment = sys.payments.get(paymentId);
  const session = payment.providerPaymentId ? sys.gateway.session(payment.providerPaymentId) : null;
  const { close } = useSheet();
  const [phase, setPhase] = useState<'pay' | 'auth' | 'redirect'>(session?.status === 'requires-action' ? 'auth' : 'pay');

  const finish = async () => {
    setPhase('redirect');
    // The app is told the outcome in the query string; it ignores it and asks the gateway.
    window.setTimeout(async () => {
      close();
      await sys.payments.handleReturn(paymentId, { status: 'succeeded' });
      await settle();
      void returnTo;
    }, 650);
  };

  if (!session) return <div class="sheet-body"><Banner tone="bad">This checkout session no longer exists.</Banner></div>;
  const amount = formatZar(session.amountMinor, { cents: true });

  return (
    <div class="gateway" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div class="sheet-head" data-drag-handle style={{ paddingTop: '4px' }}>
        <div class="row" style={{ gap: '10px' }}>
          <span class="g-mark">Sandbox Pay</span>
          <span class="g-test">Test mode</span>
        </div>
        <button type="button" class="iconbtn" aria-label="Cancel and return to Tashas" onClick={() => { sys.gateway.completeCheckout(session.id, 'cancel'); void finish(); }}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div class="sheet-body" style={{ background: 'var(--g-bg)' }}>
        <div class="g-card">
          <span class="g-muted">Pay Tashas (prototype)</span>
          <span style={{ fontSize: '2rem', fontWeight: 750, letterSpacing: '-0.02em' }} class="num">{amount}</span>
          <span class="g-muted">{session.description}</span>
          <span class="g-muted mono" style={{ fontSize: '0.75rem' }}>Ref {session.merchantReference}</span>
        </div>
        <div class="g-card" style={{ background: 'transparent' }}>
          <span class="g-muted">
            This stands in for the gateway’s hosted checkout. No card details are collected and nothing is charged. Choose what the gateway should report back to Tashas.
          </span>
        </div>
        {phase === 'pay' ? (
          <div class="stack">
            <button type="button" class="g-btn pay" onClick={() => { sys.gateway.completeCheckout(session.id, 'succeed'); tick(10); void finish(); }}>
              Pay {amount} · test success
            </button>
            <button type="button" class="g-btn" onClick={() => { sys.gateway.completeCheckout(session.id, 'require-action'); setPhase('auth'); }}>
              Ask for bank authentication (3-D Secure)
            </button>
            <button type="button" class="g-btn" onClick={() => { sys.gateway.completeCheckout(session.id, 'decline'); void finish(); }}>
              Decline the card · test failure
            </button>
            <button type="button" class="g-btn" style={{ border: 0, background: 'transparent' }} onClick={() => { sys.gateway.completeCheckout(session.id, 'cancel'); void finish(); }}>
              Cancel and return to Tashas
            </button>
          </div>
        ) : null}
        {phase === 'auth' ? (
          <div class="g-card">
            <strong>Your bank wants to confirm it is you</strong>
            <span class="g-muted">In a real checkout this is your bank’s screen or app.</span>
            <button type="button" class="g-btn pay" onClick={() => { sys.gateway.authenticate(session.id, true); void finish(); }}>
              Approve · test pass
            </button>
            <button type="button" class="g-btn" onClick={() => { sys.gateway.authenticate(session.id, false); void finish(); }}>
              Fail authentication
            </button>
          </div>
        ) : null}
        {phase === 'redirect' ? (
          <div class="row" style={{ justifyContent: 'center', padding: '20px' }}>
            <span class="spinner" />
            <span class="g-muted">Returning to Tashas…</span>
          </div>
        ) : null}
        <p class="g-muted" style={{ textAlign: 'center', fontSize: '0.75rem' }}>
          <Icon name="lock" size={13} /> Secured by the payment gateway · sandbox
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ reschedule

export function RescheduleSheet({ bookingId }: { bookingId: string }) {
  const bk = sys.bookings.booking(bookingId);
  const b = branch(bk.branchId);
  const policy = effectivePolicy(sys.ctx, bk.branchId);
  const [partySize, setPartySize] = useState(bk.partySize);
  const [date, setDate] = useState(bk.date);
  const [nonce, setNonce] = useState(0);
  const availability = useAvailability(bk.branchId, date, partySize, nonce);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutAttempt, setCheckoutAttempt] = useState<string | null>(null);
  const keyRef = useRef(idempotencyKey('amend'));
  const { close } = useSheet();

  const period = useMemo(() => availability.data?.periods.find((p) => p.slots.some((s) => s.time === time))?.id ?? bk.period, [availability.data, time]);
  const held = bk.depositPaidMinor - bk.depositRefundedMinor;
  const newDeposit = depositFor(policy, { date, period, partySize }).amountMinor;
  const diff = newDeposit - held;

  if (checkoutAttempt) {
    const a = sys.bookings.attempt(checkoutAttempt);
    if (a.state === 'confirmed') {
      return (
        <>
          <SheetHead title="Booking changed" />
          <div class="sheet-body" style={{ justifyItems: 'center', textAlign: 'center' }}>
            <div class="success-mark"><Icon name="check" size={34} /></div>
            <p class="callout">Now {formatDateLong(sys.bookings.booking(bookingId).date)} at {sys.bookings.booking(bookingId).time} for {plural(sys.bookings.booking(bookingId).partySize, 'guest')}.</p>
            <Button variant="primary" onClick={close}>Done</Button>
          </div>
        </>
      );
    }
    return (
      <>
        <SheetHead title="Change booking" />
        <ResultView attemptId={checkoutAttempt} />
      </>
    );
  }

  return (
    <>
      <SheetHead title="Change booking" sub={`${b.name} · now ${formatDateLong(bk.date)} at ${bk.time}`} />
      <div class="sheet-body">
        <div class="row between">
          <span class="caption">Guests</span>
          <Stepper label="Guests" value={partySize} min={1} max={policy.maxOnlinePartySize} onChange={(n) => { setPartySize(n); setTime(null); }} />
        </div>
        <DateStrip branchId={bk.branchId} value={date} onChange={(d) => { setDate(d); setTime(null); }} />
        <Times availability={availability} selected={time} onSelect={(t, ok) => (ok || (t === bk.time && date === bk.date) ? setTime(t) : setError(`${t} is full.`))} />
        {time ? (
          <div class="card stack">
            <p class="title-3">
              {formatDateLong(date)} at {time} · {plural(partySize, 'guest')}
            </p>
            <p class="callout">
              {diff > 0
                ? `The deposit for this table is ${formatZar(newDeposit)}. You will pay the difference of ${formatZar(diff)} now.`
                : diff < 0
                  ? `The deposit for this table is ${formatZar(newDeposit)}, so ${formatZar(-diff)} will be refunded to you.`
                  : 'No change to your deposit.'}
            </p>
          </div>
        ) : null}
        {error ? <Banner tone="bad">{error}</Banner> : null}
      </div>
      <div class="sheet-foot">
        <Button
          variant="primary"
          block
          busy={busy}
          disabled={!time}
          onClick={async () => {
            if (!time) return;
            setBusy(true);
            setError(null);
            try {
              const r = await sys.bookings.reschedule(bookingId, { date, time, partySize }, { actor: { kind: 'guest', id: getDevice().guestId }, idempotencyKey: keyRef.current });
              if (r.status === 'checkout') {
                setCheckoutAttempt(r.attemptId);
                openSheet({ name: 'checkout', paymentId: r.paymentId, returnTo: { kind: 'attempt', id: r.attemptId } });
              } else {
                await settle();
                toast(r.refundMinor > 0 ? `Booking changed. ${formatZar(r.refundMinor)} is on its way back.` : 'Booking changed');
                close();
              }
            } catch (err) {
              setError(errorMessage(err));
              setNonce((n) => n + 1);
              keyRef.current = idempotencyKey('amend');
            } finally {
              setBusy(false);
            }
          }}
        >
          {diff > 0 ? `Pay ${formatZar(diff)} and change` : 'Confirm change'}
        </Button>
      </div>
    </>
  );
}
