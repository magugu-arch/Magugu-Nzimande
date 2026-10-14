'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { type ReactNode, useActionState, useRef, useState } from 'react';
import { type BookingState, submitBooking } from '@/app/bookings/actions';
import type { FormState } from '@/app/actions';
import { track } from '@/lib/analytics';
import { bookingMode, formatUsd, orderTotal, seatsLabel } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { clamp, springs } from '@/lib/motion';
import { CheckboxField, Honeypot, TextArea, TextField } from '../forms/Field';
import { FormErrors, SuccessPanel, formHelpers } from '../forms/FormShell';
import { buttonClasses } from '../ui/Button';
import { Pill } from '../ui/Section';
import {
  AlertIcon,
  CalendarIcon,
  ClockIcon,
  GlobeIcon,
  LockIcon,
  MinusIcon,
  PinIcon,
  PlusIcon,
} from '../ui/icons';

/** Everything the form shows about the event: plain data, prepared on the server. */
export interface BookingOffer {
  eventSlug: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  zoneLabel: string;
  location: string;
  online: boolean;
  ticketName: string;
  priceCents: number | null;
  maxPerOrder: number;
  isDemo: boolean;
  refundPolicyUrl: string | null;
}

const labels: Record<string, string> = {
  quantity: 'Seats',
  name: 'Full name',
  email: 'Email',
  phone: 'Phone',
  attendees: 'Other attendees',
  accessNeeds: 'Access needs',
  consent: 'Refund policy and terms',
};

const initial: BookingState = { status: 'idle' };

/**
 * One page, three groups — seats, details, confirm — with the order summary
 * beside them on wide screens and after them on phones. It is a real form
 * posting to a server action, so it works before (and without) JavaScript;
 * script adds the stepper, the live total and inline focus handling.
 */
export function BookingForm({
  offer,
  paymentsReady,
  preview,
  photo,
}: {
  offer: BookingOffer;
  /** Checkout can open (a usable Stripe key and every guard satisfied). */
  paymentsReady: boolean;
  preview: boolean;
  photo: ReactNode;
}) {
  const [state, action, pending] = useActionState(submitBooking, initial);
  const asForm: FormState = state.status === 'error' ? state : { status: 'idle' };
  const f = formHelpers(asForm);
  const restored = state.status === 'payments-off' ? state.values : null;
  const value = (name: string) => {
    const v = restored?.[name];
    return typeof v === 'string' ? v : f.value(name);
  };

  const [qtyText, setQtyText] = useState(() => value('quantity') ?? '1');
  const [direction, setDirection] = useState<1 | -1>(1);
  const quantity = clamp(Math.round(Number(qtyText)) || 1, 1, offer.maxPerOrder);
  const started = useRef(false);

  const priceMode = bookingMode(offer);
  // Production never shows a Pay button it cannot honour; preview shows it so the flow can be reviewed.
  const mode = priceMode === 'paid' && !paymentsReady && !preview ? 'request' : priceMode;
  const total = orderTotal(offer, quantity);
  const totalLabel = total === null ? 'To be confirmed' : total === 0 ? 'Free' : formatUsd(total);
  const unitLabel =
    offer.priceCents === null
      ? 'Price to be confirmed'
      : offer.priceCents === 0
        ? 'Free'
        : formatUsd(offer.priceCents);

  const step = (delta: 1 | -1) => {
    const next = clamp(quantity + delta, 1, offer.maxPerOrder);
    if (next === quantity) return;
    setDirection(delta);
    setQtyText(String(next));
  };

  if (state.status === 'success') {
    return (
      <SuccessPanel title={state.title} message={state.message} preview={state.preview}>
        <dl className="mt-6 grid gap-1 rounded-xl bg-ink/60 px-5 py-4 ring-1 ring-ivory/10">
          <dt className="type-eyebrow text-ivory/60">Your reference</dt>
          <dd className="font-display text-[1.5rem] tracking-[0.04em] text-gold-bright tabular-nums">
            {state.reference}
          </dd>
        </dl>
        <p className="mt-4 text-[0.9rem] text-ivory/70">
          Quote this reference if you contact the team about this booking.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/events/${offer.eventSlug}`} className={buttonClasses('secondary')}>
            Back to the event
          </Link>
          <Link href="/events" className={buttonClasses('ghost')}>
            All events
          </Link>
        </div>
      </SuccessPanel>
    );
  }

  return (
    <form
      action={action}
      noValidate
      data-booking-form
      data-unit-cents={offer.priceCents ?? ''}
      data-max={offer.maxPerOrder}
      onFocusCapture={() => {
        if (started.current) return;
        started.current = true;
        track('form_start', { form: 'booking' });
      }}
      onSubmit={(e) => {
        const intent = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
        if (intent === 'pay') track('event_registration_start', { event: offer.eventSlug });
      }}
      className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14"
    >
      <div className="min-w-0 space-y-12">
        <FormErrors state={asForm} labels={labels} />
        <Honeypot />
        <input type="hidden" name="eventSlug" value={offer.eventSlug} />

        <fieldset>
          <legend className="type-eyebrow mb-5 text-gold">Seats</legend>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl bg-ink/60 p-5 ring-1 ring-ivory/10">
            <div className="min-w-0">
              <p className="font-semibold">{offer.ticketName}</p>
              <p className="mt-1 text-[0.9rem] text-ivory/65">
                {unitLabel}
                {offer.priceCents ? ' each' : ''} · up to {offer.maxPerOrder} per order
              </p>
            </div>
            <div
              role="group"
              aria-labelledby="quantity-label"
              className="flex items-center gap-1 rounded-full bg-ivory/[0.06] p-1 ring-1 ring-ivory/15"
            >
              <label id="quantity-label" htmlFor="quantity" className="sr-only">
                Number of seats
              </label>
              <StepButton label="One seat fewer" delta={-1} disabled={quantity <= 1} onStep={step}>
                <MinusIcon size={18} />
              </StepButton>
              <input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={offer.maxPerOrder}
                step={1}
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value)}
                onBlur={() => setQtyText(String(quantity))}
                aria-invalid={f.error('quantity') ? true : undefined}
                aria-describedby={f.error('quantity') ? 'quantity-error' : undefined}
                className="h-10 w-12 [appearance:textfield] bg-transparent text-center text-[1.125rem] font-semibold tabular-nums focus:outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-gold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <StepButton
                label="One seat more"
                delta={1}
                disabled={quantity >= offer.maxPerOrder}
                onStep={step}
              >
                <PlusIcon size={18} />
              </StepButton>
            </div>
          </div>
          {f.error('quantity') ? (
            <p
              id="quantity-error"
              className="mt-2 flex items-start gap-1.5 text-[0.875rem] text-[#f0b4a8]"
            >
              <AlertIcon size={16} className="mt-0.5 shrink-0" />
              {f.error('quantity')}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-6">
          <legend className="type-eyebrow mb-6 text-gold">Your details</legend>
          <div className="grid gap-6 md:grid-cols-2">
            <TextField
              name="name"
              label={labels.name!}
              required
              autoComplete="name"
              defaultValue={value('name')}
              error={f.error('name')}
            />
            <TextField
              name="email"
              type="email"
              label={labels.email!}
              required
              autoComplete="email"
              inputMode="email"
              hint="Confirmation and joining details go here."
              defaultValue={value('email')}
              error={f.error('email')}
            />
            <TextField
              name="phone"
              type="tel"
              label={labels.phone!}
              autoComplete="tel"
              hint="Only used if the event changes at short notice."
              defaultValue={value('phone')}
              error={f.error('phone')}
            />
          </div>
          <TextArea
            name="attendees"
            label={labels.attendees!}
            rows={2}
            hint="Booking for other people? Add their names so the team can greet them."
            defaultValue={value('attendees')}
            error={f.error('attendees')}
          />
          <TextArea
            name="accessNeeds"
            label={labels.accessNeeds!}
            rows={2}
            hint="Anything that helps the team prepare. Shared only with the people running the event."
            defaultValue={value('accessNeeds')}
            error={f.error('accessNeeds')}
          />
        </fieldset>
      </div>

      <aside
        aria-label="Order summary"
        className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start"
      >
        <div className="overflow-hidden rounded-[1.5rem] bg-ink/70 ring-1 ring-ivory/10">
          <div className="relative aspect-[16/9] max-w-full">{photo}</div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {offer.isDemo ? <Pill tone="demo">Demo event</Pill> : null}
              {offer.isDemo && offer.priceCents ? <Pill tone="demo">Demo price</Pill> : null}
            </div>
            <h2 className="mt-3 font-display text-[1.5rem] leading-tight font-semibold text-balance">
              {offer.title}
            </h2>
            <ul className="mt-4 space-y-2 text-[0.9rem] text-ivory/75">
              <li className="flex gap-2.5">
                <CalendarIcon size={17} className="mt-0.5 shrink-0 text-gold" />
                {offer.dateLabel}
              </li>
              <li className="flex gap-2.5">
                <ClockIcon size={17} className="mt-0.5 shrink-0 text-gold" />
                <span>
                  {offer.timeLabel}
                  <span className="block text-ivory/55">{offer.zoneLabel}</span>
                </span>
              </li>
              <li className="flex gap-2.5">
                {offer.online ? (
                  <GlobeIcon size={17} className="mt-0.5 shrink-0 text-gold" />
                ) : (
                  <PinIcon size={17} className="mt-0.5 shrink-0 text-gold" />
                )}
                {offer.location}
              </li>
            </ul>

            <dl className="mt-6 space-y-3 border-t border-ivory/10 pt-5 text-[0.95rem]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ivory/75">
                  {offer.ticketName} ×{' '}
                  <span data-booking-qty className="tabular-nums">
                    {quantity}
                  </span>
                </dt>
                <dd className="tabular-nums">{unitLabel}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-ivory/10 pt-3">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display text-[1.625rem] leading-none font-semibold">
                  <span data-booking-total>
                    <Rolling value={totalLabel} direction={direction} />
                  </span>
                  <span className="sr-only" aria-live="polite">
                    {`${seatsLabel(quantity)}, total ${totalLabel}`}
                  </span>
                </dd>
              </div>
            </dl>
            {total !== null && total > 0 ? (
              <p className="mt-3 text-[0.8rem] text-ivory/55">Charged in US dollars.</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-5 px-1">
          <CheckboxField
            name="consent"
            defaultChecked={restored ? restored.consent === 'on' : f.checked('consent')}
            error={f.error('consent')}
            label={
              <>
                I have read the{' '}
                {offer.refundPolicyUrl ? (
                  <a
                    href={offer.refundPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    refund policy
                  </a>
                ) : (
                  <Link href="/refunds" className="underline">
                    refund policy
                  </Link>
                )}{' '}
                and{' '}
                <Link href="/terms" className="underline">
                  terms
                </Link>
                .
              </>
            }
          />

          <SubmitArea
            mode={mode}
            priceMode={priceMode}
            state={state}
            pending={pending}
            paymentsReady={paymentsReady}
            preview={preview}
          />

          <p className="text-[0.8rem] text-ivory/55">
            Your details are used to manage this booking, as described in the{' '}
            <Link href="/privacy" className="underline">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

function SubmitArea({
  mode,
  priceMode,
  state,
  pending,
  paymentsReady,
  preview,
}: {
  mode: 'paid' | 'free' | 'request';
  priceMode: 'paid' | 'free' | 'request';
  state: BookingState;
  pending: boolean;
  paymentsReady: boolean;
  preview: boolean;
}) {
  if (state.status === 'payments-off') {
    return (
      <div role="alert" className="space-y-4 rounded-2xl bg-[#2c2414] p-5 ring-1 ring-gold/35">
        <p className="font-semibold text-gold-bright">Checkout is not available yet</p>
        <p className="text-[0.9rem] text-ivory/80">{state.message}</p>
        {state.detail ? (
          <p className="rounded-lg bg-ink/60 px-3 py-2 text-[0.8rem] text-ivory/70">
            Preview: {state.detail}
          </p>
        ) : null}
        <button
          type="submit"
          name="intent"
          value="request"
          disabled={pending}
          className={cn(buttonClasses('primary', 'lg'), 'w-full')}
        >
          {pending ? 'Sending…' : 'Send a booking request instead'}
        </button>
      </div>
    );
  }

  const button =
    mode === 'paid'
      ? { intent: 'pay', label: pending ? 'Opening checkout…' : 'Continue to payment' }
      : mode === 'free'
        ? { intent: 'reserve', label: pending ? 'Sending…' : 'Complete registration' }
        : { intent: 'request', label: pending ? 'Sending…' : 'Send booking request' };

  return (
    <div className="space-y-3">
      {mode === 'paid' && !paymentsReady && preview ? (
        <p className="rounded-xl bg-ink/60 px-4 py-3 text-[0.85rem] text-gold-bright ring-1 ring-gold/25">
          Preview: payments are not connected, so this stops before Stripe and nothing is charged.
        </p>
      ) : null}
      <button
        type="submit"
        name="intent"
        value={button.intent}
        disabled={pending}
        className={cn(buttonClasses('primary', 'lg'), 'w-full')}
      >
        {mode === 'paid' ? <LockIcon size={18} /> : null}
        {button.label}
      </button>
      <p className="text-center text-[0.8rem] text-ivory/60">
        {mode === 'paid'
          ? 'You pay on Stripe’s secure checkout page. Card details never reach this site.'
          : mode === 'free'
            ? 'No payment needed.'
            : priceMode === 'paid'
              ? 'Online payment is not available for this event yet. Sending this does not book seats or take payment; the team replies by email.'
              : 'Sending this does not book seats or take payment. The team replies by email.'}
      </p>
    </div>
  );
}

/** − / + with press feedback; stays focusable at its limit (aria-disabled) so focus is never lost. */
function StepButton({
  label,
  delta,
  disabled,
  onStep,
  children,
}: {
  label: string;
  delta: 1 | -1;
  disabled: boolean;
  onStep: (delta: 1 | -1) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-controls="quantity"
      aria-disabled={disabled || undefined}
      data-stepper={delta}
      onClick={() => {
        if (!disabled) onStep(delta);
      }}
      className={cn(
        'pressable grid size-10 place-items-center rounded-full text-ivory transition-[background-color,opacity] duration-200 hover:bg-ivory/10',
        disabled && 'opacity-35 hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The total rolls in the direction of the change — up when seats are added,
 * down when removed — on a critically damped spring, so rapid taps retarget
 * smoothly instead of queueing. Reduced motion keeps only the cross-fade.
 */
function Rolling({ value, direction }: { value: string; direction: 1 | -1 }) {
  const reduce = useReducedMotion();
  const offset = reduce ? 0 : 0.6;
  return (
    <span aria-hidden="true" className="relative inline-flex overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={{
            enter: (d: number) => ({ y: `${d * offset}em`, opacity: 0 }),
            center: { y: 0, opacity: 1 },
            exit: (d: number) => ({ y: `${-d * offset}em`, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={springs.settle}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
