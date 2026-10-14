'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { type ReactNode, useRef, useState, useSyncExternalStore } from 'react';
import { formatUsd } from '@/lib/booking';
import { cn } from '@/lib/cn';
import {
  cardBrand,
  checkCardNumber,
  checkCvc,
  checkEmail,
  checkExpiry,
  checkZip,
  DEMO_ORDER_KEY,
  declineMessages,
  type DemoOrder,
  formatCardNumber,
  formatExpiry,
  orderTotalCents,
  parseDemoOrder,
  TEST_CARDS,
} from '@/lib/demo-payment';
import { springs } from '@/lib/motion';
import { cart } from '../shop/cart-store';
import { buttonClasses } from '../ui/Button';
import { AlertIcon, CheckIcon, LockIcon } from '../ui/icons';

const noop = () => () => {};

function readOrder(): DemoOrder | null {
  try {
    return parseDemoOrder(window.sessionStorage.getItem(DEMO_ORDER_KEY));
  } catch {
    return null;
  }
}

const brandNames = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' } as const;

type Fields = Record<string, string>;
type Errors = Record<string, string>;

const labels: Record<string, string> = {
  'demo-email': 'Email',
  'demo-name': 'Full name',
  'demo-address1': 'Address',
  'demo-city': 'City',
  'demo-state': 'State',
  'demo-zip': 'ZIP code',
  'demo-card': 'Card number',
  'demo-exp': 'Expiry date',
  'demo-cvc': 'Security code',
  'demo-cardname': 'Name on card',
};

/**
 * The preview's payment step, standing in for Stripe's hosted page while no
 * Stripe key is set. One page: contact, delivery (books only) and card, with
 * the order summary and Pay button beside them. Errors show next to the
 * field once it has been left, and all at once on Pay. Only Stripe's test
 * card numbers are accepted; nothing typed here leaves the page.
 */
export function DemoCheckout() {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [stored] = useState<DemoOrder | null>(() =>
    typeof window === 'undefined' ? null : readOrder(),
  );
  const [fields, setFields] = useState<Fields>({});
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'processing' | 'paid'>('form');
  const summaryRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // Same markup as the server until hydrated, so the two always match.
  const order = hydrated ? stored : null;

  function bind(id: string) {
    return {
      value: fields[id] ?? '',
      error: errors[id],
      onValue: (value: string) => set(id, value),
      onLeave: () => blur(id),
    };
  }

  // Before hydration (and in the single-file export, which is captured with
  // scripts off) the form renders with an empty summary for script to fill.
  if (hydrated && !order) {
    return (
      <div className="rounded-[1.5rem] bg-ink/60 px-6 py-14 text-center ring-1 ring-ivory/10">
        <h2 className="font-display text-[2rem] leading-tight font-semibold">
          There is nothing to pay for yet
        </h2>
        <p className="mt-2 text-ivory/70">
          Start from your cart or an event’s booking page, and checkout brings you here.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/cart" className={buttonClasses('primary', 'lg')}>
            Go to your cart
          </Link>
          <Link href="/events" className={buttonClasses('secondary', 'lg')}>
            See events
          </Link>
        </div>
      </div>
    );
  }

  const total = order ? orderTotalCents(order) : 0;
  const shipping = order ? order.shipping : true;
  const brand = cardBrand(fields['demo-card'] ?? '');
  const required = [
    'demo-email',
    ...(shipping ? ['demo-name', 'demo-address1', 'demo-city', 'demo-state', 'demo-zip'] : []),
    'demo-card',
    'demo-exp',
    'demo-cvc',
    'demo-cardname',
  ];

  const check = (id: string, value: string): string | undefined => {
    const v = value.trim();
    switch (id) {
      case 'demo-email':
        return checkEmail(v) ?? undefined;
      case 'demo-zip':
        return checkZip(v) ?? undefined;
      case 'demo-card': {
        const result = checkCardNumber(v);
        return result.ok ? undefined : result.message;
      }
      case 'demo-exp':
        return checkExpiry(v) ?? undefined;
      case 'demo-cvc':
        return checkCvc(v, cardBrand(fields['demo-card'] ?? '')) ?? undefined;
      case 'demo-state':
        return /^[A-Za-z]{2}$/.test(v) ? undefined : 'Enter the two-letter state, such as TX.';
      default:
        return v ? undefined : `Enter the ${labels[id]!.toLowerCase()}.`;
    }
  };

  const set = (id: string, value: string) => {
    setFields((f) => ({ ...f, [id]: value }));
    if (errors[id]) {
      setErrors((e) => {
        const next = { ...e };
        const message = check(id, value);
        if (message) next[id] = message;
        else delete next[id];
        return next;
      });
    }
  };

  const blur = (id: string) => {
    const value = fields[id] ?? '';
    if (!value) return;
    const message = check(id, value);
    setErrors((e) => {
      const next = { ...e };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  };

  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== 'form' || !order) return;
    const found: Errors = {};
    for (const id of required) {
      const message = check(id, fields[id] ?? '');
      if (message) found[id] = message;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSummary('Some details need attention before you pay.');
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const result = checkCardNumber(fields['demo-card'] ?? '');
    setSummary(null);
    setPhase('processing');
    // A pause like a real authorisation, so the step reads as one.
    window.setTimeout(() => {
      if (result.ok && result.outcome !== 'success') {
        setPhase('form');
        setErrors({ 'demo-card': declineMessages[result.outcome] });
        setSummary('Your payment did not go through.');
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      try {
        window.sessionStorage.removeItem(DEMO_ORDER_KEY);
      } catch {
        // Storage blocked: nothing to tidy.
      }
      if (order.kind === 'books') cart.clear();
      setPhase('paid');
    }, 1200);
  };

  if (phase === 'paid' && order) {
    const deliverTo = order.shipping
      ? [
          fields['demo-name'],
          fields['demo-address1'],
          fields['demo-address2'],
          `${fields['demo-city'] ?? ''}, ${(fields['demo-state'] ?? '').toUpperCase()} ${fields['demo-zip'] ?? ''}`,
        ]
          .filter(Boolean)
          .join(', ')
      : null;
    return (
      <div
        ref={(node) => node?.focus()}
        tabIndex={-1}
        role="status"
        className="mx-auto max-w-2xl outline-none"
      >
        <motion.span
          initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springs.flick}
          className="grid size-16 place-items-center rounded-full bg-gold text-ink"
        >
          <CheckIcon size={32} />
        </motion.span>
        <h2 className="type-display-md mt-6">Payment complete</h2>
        <p className="type-lede mt-4 text-ivory/80">
          This was a demo payment, so nothing was charged. On the live site, Stripe takes the
          payment and sends the receipt.
        </p>
        <dl className="mt-10 grid gap-x-8 gap-y-5 rounded-2xl bg-ink/60 p-7 ring-1 ring-ivory/10 sm:grid-cols-2">
          <Detail label="Reference">
            <span className="font-display text-[1.5rem] tracking-[0.04em] text-gold-bright">
              {order.reference}
            </span>
          </Detail>
          <Detail label="Paid (demo)">{formatUsd(total)}</Detail>
          <Detail label={order.kind === 'books' ? 'Books' : 'Booking'} wide>
            <ul className="space-y-1">
              {order.lines.map((l) => (
                <li key={l.title}>
                  {l.title} × {l.quantity}
                </li>
              ))}
            </ul>
          </Detail>
          {deliverTo ? (
            <Detail label="Deliver to" wide>
              {deliverTo}
            </Detail>
          ) : null}
          <Detail label="Email" wide>
            {fields['demo-email']}
          </Detail>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={order.back.href} className={buttonClasses('secondary')}>
            {order.back.label}
          </Link>
          <Link href="/" className={buttonClasses('ghost')}>
            Home
          </Link>
        </div>
      </div>
    );
  }

  const busy = phase === 'processing';
  const errorEntries = Object.entries(errors);

  return (
    <form
      noValidate
      onSubmit={pay}
      data-demo-checkout
      aria-busy={busy || undefined}
      className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14"
    >
      <div className="min-w-0 space-y-10">
        <p
          data-demo-banner
          className="flex items-start gap-3 rounded-2xl bg-[#1d1810] p-4 text-[0.9rem] text-gold-bright ring-1 ring-gold/30"
        >
          <LockIcon size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">Demo checkout.</strong> Payments are not connected
            yet, so this page stands in for Stripe’s secure checkout. Use a test card such as 4242
            4242 4242 4242 with any future date and any security code. Real cards are refused, and
            nothing is charged or sent anywhere.
          </span>
        </p>

        <div data-demo-errors>
          {summary ? (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="rounded-2xl bg-[#3a1d18] p-5 ring-1 ring-[#e8a598]/40 outline-none"
            >
              <p className="flex items-center gap-2 font-semibold text-[#f0b4a8]">
                <AlertIcon size={18} />
                {summary}
              </p>
              {errorEntries.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-6 text-[0.9rem] text-[#f0b4a8]">
                  {errorEntries.map(([id, message]) => (
                    <li key={id}>
                      <a href={`#${id}`} className="underline">
                        {labels[id]}: {message}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <fieldset className="space-y-6" disabled={busy}>
          <legend className="type-eyebrow mb-6 text-gold">Contact</legend>
          <div className="grid gap-6 md:grid-cols-2">
            <Input
              id="demo-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              label="Email"
              hint="For the receipt."
              {...bind('demo-email')}
            />
            <Input
              id="demo-phone"
              type="tel"
              autoComplete="tel"
              label="Phone"
              optional
              {...bind('demo-phone')}
            />
          </div>
        </fieldset>

        {shipping ? (
          <fieldset data-demo-shipping className="space-y-6" disabled={busy}>
            <legend className="type-eyebrow mb-6 text-gold">Delivery</legend>
            <Input id="demo-name" autoComplete="name" label="Full name" {...bind('demo-name')} />
            <Input
              id="demo-address1"
              autoComplete="address-line1"
              label="Address"
              {...bind('demo-address1')}
            />
            <Input
              id="demo-address2"
              autoComplete="address-line2"
              label="Apartment, suite or unit"
              optional
              {...bind('demo-address2')}
            />
            <div className="grid gap-6 sm:grid-cols-[1.4fr_0.8fr_1fr]">
              <Input
                id="demo-city"
                autoComplete="address-level2"
                label="City"
                {...bind('demo-city')}
              />
              <Input
                id="demo-state"
                autoComplete="address-level1"
                label="State"
                maxLength={2}
                {...bind('demo-state')}
              />
              <Input
                id="demo-zip"
                autoComplete="postal-code"
                inputMode="numeric"
                label="ZIP code"
                maxLength={10}
                {...bind('demo-zip')}
              />
            </div>
            <p className="text-[0.85rem] text-ivory/60">Delivery within the United States.</p>
          </fieldset>
        ) : null}

        <fieldset className="space-y-6" disabled={busy}>
          <legend className="type-eyebrow mb-6 text-gold">Payment</legend>
          <div className="flex flex-wrap items-center gap-2 text-[0.85rem] text-ivory/70">
            <span>Test cards:</span>
            <TestCard
              number={TEST_CARDS.visa}
              label="4242 … succeeds"
              onFill={() => set('demo-card', formatCardNumber(TEST_CARDS.visa))}
            />
            <TestCard
              number={TEST_CARDS.declined}
              label="0002 … declines"
              onFill={() => set('demo-card', formatCardNumber(TEST_CARDS.declined))}
            />
          </div>
          <Input
            id="demo-card"
            inputMode="numeric"
            autoComplete="off"
            label="Card number"
            placeholder="1234 1234 1234 1234"
            format={formatCardNumber}
            trailing={
              <span data-demo-brand className="text-[0.8rem] font-semibold text-ivory/70">
                {brand !== 'unknown' ? brandNames[brand] : ''}
              </span>
            }
            {...bind('demo-card')}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              id="demo-exp"
              inputMode="numeric"
              autoComplete="off"
              label="Expiry date"
              placeholder="MM / YY"
              format={formatExpiry}
              {...bind('demo-exp')}
            />
            <Input
              id="demo-cvc"
              inputMode="numeric"
              autoComplete="off"
              label="Security code"
              placeholder={brand === 'amex' ? '4 digits' : '3 digits'}
              format={(v) => v.replace(/\D/g, '').slice(0, brand === 'amex' ? 4 : 3)}
              {...bind('demo-cvc')}
            />
          </div>
          <Input
            id="demo-cardname"
            autoComplete="off"
            label="Name on card"
            {...bind('demo-cardname')}
          />
        </fieldset>
      </div>

      <aside
        aria-label="Order summary"
        className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start"
      >
        <div className="rounded-[1.5rem] bg-ink/70 p-6 ring-1 ring-ivory/10">
          <h2 className="font-display text-[1.75rem] leading-tight font-semibold">Order summary</h2>
          <ul data-demo-lines className="mt-5 space-y-4 border-b border-ivory/10 pb-5">
            {(order?.lines ?? []).map((l) => (
              <li
                key={l.title}
                className="flex items-baseline justify-between gap-4 text-[0.95rem]"
              >
                <span className="min-w-0">
                  {l.title} <span className="text-ivory/60">× {l.quantity}</span>
                  {l.detail ? (
                    <span className="block text-[0.8rem] text-ivory/55">{l.detail}</span>
                  ) : null}
                </span>
                <span className="tabular-nums">{formatUsd(l.unitCents * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 text-[0.95rem]">
            {shipping ? (
              <div data-demo-shipping-row className="flex justify-between gap-4 text-ivory/75">
                <dt>Shipping</dt>
                <dd>Not charged in this demo</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold">Total</dt>
              <dd
                data-demo-total
                className="font-display text-[1.75rem] leading-none font-semibold tabular-nums"
              >
                {order ? formatUsd(total) : '—'}
              </dd>
            </div>
          </dl>
          <button
            type="submit"
            data-demo-pay
            disabled={busy}
            className={cn(buttonClasses('primary', 'lg'), 'mt-6 w-full')}
          >
            {busy ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink motion-reduce:animate-none"
                />
                Processing…
              </>
            ) : (
              <>
                <LockIcon size={18} />
                <span data-demo-pay-label>{order ? `Pay ${formatUsd(total)}` : 'Pay'}</span>
              </>
            )}
          </button>
          <p data-demo-reference className="mt-3 text-center text-[0.8rem] text-ivory/60">
            {order ? `Reference ${order.reference}. ` : ''}Demo only: nothing is charged.
          </p>
        </div>
        <Link
          href={!order || order.kind === 'books' ? '/cart' : order.back.href}
          data-demo-back
          className="mt-4 inline-block px-1 text-[0.9rem] font-semibold text-gold-bright hover:text-ivory"
        >
          ← {!order || order.kind === 'books' ? 'Back to cart' : 'Back to booking'}
        </Link>
      </aside>
    </form>
  );
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="type-eyebrow text-ivory/55">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

function TestCard({
  number,
  label,
  onFill,
}: {
  number: string;
  label: string;
  onFill: () => void;
}) {
  return (
    <button
      type="button"
      data-demo-fill={number}
      onClick={onFill}
      className="pressable rounded-full bg-ivory/[0.07] px-3 py-1 font-semibold text-ivory/85 ring-1 ring-ivory/15 hover:bg-ivory/10"
    >
      {label}
    </button>
  );
}

/**
 * A labelled field with no `name`: nothing here is ever submitted. `format`
 * reshapes what is typed (card spacing, MM / YY) without fighting the caret
 * at the end of the field, which is where people type.
 */
function Input({
  id,
  label,
  hint,
  optional,
  error,
  value,
  onValue,
  onLeave,
  format,
  trailing,
  type = 'text',
  ...rest
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  value: string;
  onValue: (value: string) => void;
  onLeave: () => void;
  format?: (value: string) => string;
  trailing?: ReactNode;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric' | 'tel';
  placeholder?: string;
  maxLength?: number;
}) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.9rem] font-semibold">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-ivory/55">(optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="-mt-1 mb-2 text-[0.85rem] text-ivory/60">
          {hint}
        </p>
      ) : null}
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onValue(format ? format(e.target.value) : e.target.value)}
          onBlur={onLeave}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={!optional}
          className={cn(
            'block h-12 w-full rounded-xl border bg-ink/60 px-4 text-[1rem] text-ivory tabular-nums [color-scheme:dark] placeholder:text-ivory/35',
            'transition-[border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_rgb(203_164_93/0.25)] focus:outline-none',
            error ? 'border-[#e8a598]' : 'border-ivory/15 hover:border-ivory/30 focus:border-gold',
            trailing ? 'pr-36' : null,
          )}
          {...rest}
        />
        {trailing ? (
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
            {trailing}
          </span>
        ) : null}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-2 flex items-start gap-1.5 text-[0.875rem] text-[#f0b4a8]"
        >
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
