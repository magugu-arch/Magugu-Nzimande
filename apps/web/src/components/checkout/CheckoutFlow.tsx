'use client';

import { CustomerSchema, SERVICE_MODES, type DeliveryQuote } from '@bbq/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DemoFlag } from '@/components/ui/DemoValue';
import { Field, TextArea } from '@/components/ui/Field';
import { Price } from '@/components/ui/Price';
import { ApiError, openPayment, placeOrder, quoteDelivery } from '@/lib/client-api';
import { CheckoutSummary } from './CheckoutSummary';

const STEPS = ['Fulfilment', 'Details', 'Where to', 'Pay'] as const;

type Errors = Partial<
  Record<'name' | 'email' | 'mobile' | 'address' | 'suburb' | 'postalCode', string>
>;

/**
 * @param paymentConfigured Whether this deployment has a gateway. Read on the
 *   server and passed in rather than asked for over the network: it decides
 *   what the last step says and what pressing the button does, and a browser
 *   that could answer it could also answer it wrongly.
 */
export function CheckoutFlow({ paymentConfigured = false }: { paymentConfigured?: boolean }) {
  const router = useRouter();
  const { mode, setMode, store, stores, setStore, lines, totals, promoCode, clearCart, recordOrder, announce } =
    useOrdering();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (lines.length === 0) {
    return (
      <div className="rounded-md border border-line bg-white p-10 text-center">
        <p className="display text-2xl text-black-60">Your basket is empty</p>
        <p className="mt-2 text-sm text-muted">Add something before checking out.</p>
        <div className="mt-5">
          <ButtonLink href="/menu">Browse the menu</ButtonLink>
        </div>
      </div>
    );
  }

  function validateDetails(): boolean {
    const parsed = CustomerSchema.safeParse({ name, email, mobile });
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: Errors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'name' || field === 'email' || field === 'mobile') {
        next[field] ??= issue.message;
      }
    }
    setErrors(next);
    return false;
  }

  async function validateWhere(): Promise<boolean> {
    if (mode !== 'Delivery') {
      setErrors({});
      return true;
    }

    const next: Errors = {};
    if (address.trim().length < 4) next.address = 'Enter your street address';
    if (suburb.trim().length < 2) next.suburb = 'Enter your suburb';
    // Four digits is every South African postal code. Checked here as well as
    // on the server, because a courier needs a complete address and the
    // cheapest place to say so is beside the field.
    if (!/^\d{4}$/.test(postalCode.trim())) next.postalCode = 'Enter a four-digit postal code';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return false;
    }

    setChecking(true);
    try {
      const result = await quoteDelivery(suburb, totals.subtotalCents - totals.discountCents);
      setQuote(result);
      if (!result.serviceable) {
        setErrors({ suburb: result.reason });
        announce(result.reason);
        return false;
      }
      setErrors({});
      return true;
    } catch {
      setErrors({ suburb: 'We could not check that suburb. Try again.' });
      return false;
    } finally {
      setChecking(false);
    }
  }

  async function next() {
    if (step === 1 && !validateDetails()) return;
    if (step === 2 && !(await validateWhere())) return;
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);

    let order;
    try {
      order = await placeOrder({
        storeId: store.id,
        mode,
        customer: { name, email, mobile },
        lines,
        promoCode,
        ...(mode === 'Delivery' ? { address, suburb, postalCode: postalCode.trim() } : {}),
        kitchenNote,
      });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'We could not place your order. Please try again.',
      );
      setSubmitting(false);
      return;
    }

    /**
     * The order exists from here on, so the basket is cleared before payment
     * rather than after it.
     *
     * Leaving it filled through the redirect would give a customer who comes
     * back from the gateway a basket holding the meal they have just paid for,
     * and the obvious thing to do with a full basket is check out again. The
     * order is recorded in this browser at the same moment, which is what the
     * journey screen reads if the redirect never happens.
     */
    recordOrder(order);
    clearCart();
    announce(`Order ${order.orderNumber} placed.`);

    // Inlined at each call rather than held in a variable: Next's typed routes
    // narrow a template literal in argument position, and a `string` in between
    // is not a route as far as the compiler is concerned.
    const placed = order;
    if (!paymentConfigured) {
      router.push(`/journey?order=${encodeURIComponent(placed.id)}`);
      return;
    }

    try {
      const { redirectUrl } = await openPayment(order.id);
      if (redirectUrl) {
        // A real navigation off this site, so router.push is the wrong tool:
        // it would try to resolve the gateway's URL as an internal route.
        window.location.assign(redirectUrl);
        return;
      }
      // A gateway that takes the money without sending the customer anywhere.
      router.push(`/journey?order=${encodeURIComponent(placed.id)}`);
    } catch {
      /**
       * The order is placed but the payment did not open. Sending them to the
       * journey is the honest outcome: it is where the order actually is, and
       * it shows the payment as unpaid with a way to try again — which is
       * better than a checkout screen for an order that already exists and
       * would place a second one.
       */
      router.push(`/journey?order=${encodeURIComponent(placed.id)}`);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <ol className="mb-8 flex flex-wrap gap-x-2 gap-y-2" aria-label="Checkout progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={index === step ? 'step' : undefined}
                className={[
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold',
                  index === step
                    ? 'bg-red text-white'
                    : index < step
                      ? 'bg-red-10 text-red'
                      : 'bg-paper text-muted',
                ].join(' ')}
              >
                <span className="tabular">{index + 1}</span>
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className="h-px w-3 bg-line-strong" />
              )}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section>
            <h2 className="display text-2xl">How would you like it?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {SERVICE_MODES.map((candidate) => {
                const available = store.services[candidate];
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setMode(candidate)}
                    disabled={!available}
                    aria-pressed={mode === candidate}
                    className={[
                      'rounded-md border p-4 text-left transition-colors',
                      mode === candidate ? 'border-red bg-red-10' : 'border-line bg-white',
                      available ? 'hover:border-line-strong' : 'cursor-not-allowed opacity-45',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-extrabold">{candidate}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {available
                        ? candidate === 'Delivery'
                          ? 'To your door'
                          : candidate === 'Collection'
                            ? 'Ready at the counter'
                            : 'A table in store'
                        : 'Not available here'}
                    </span>
                  </button>
                );
              })}
            </div>

            <h3 className="mt-8 text-xs font-bold uppercase tracking-[0.08em] text-muted">
              Which store
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {stores.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setStore(candidate.id)}
                  aria-pressed={store.id === candidate.id}
                  className={[
                    'rounded-md border p-4 text-left transition-colors',
                    store.id === candidate.id
                      ? 'border-red bg-red-10'
                      : 'border-line bg-white hover:border-line-strong',
                  ].join(' ')}
                >
                  <span className="block text-sm font-extrabold">{candidate.name}</span>
                  <span className="mt-1 block text-xs text-muted">{candidate.address}</span>
                  {!candidate.services['Dine-in'] && (
                    <span className="mt-2 block text-[11px] font-semibold text-red">
                      No dine-in at this store
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <h2 className="display text-2xl">Your details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={errors.name}
                autoComplete="name"
                className="sm:col-span-2"
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={errors.email}
                autoComplete="email"
                hint="Your receipt and order updates go here."
              />
              <Field
                label="Mobile"
                type="tel"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                error={errors.mobile}
                autoComplete="tel"
                hint="The driver or the store calls this number."
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 className="display text-2xl">
              {mode === 'Delivery' ? 'Where are we taking it?' : 'Anything for the kitchen?'}
            </h2>

            {mode === 'Delivery' ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Street address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  error={errors.address}
                  autoComplete="street-address"
                  className="sm:col-span-2"
                />
                <Field
                  label="Suburb"
                  value={suburb}
                  onChange={(event) => {
                    setSuburb(event.target.value);
                    setQuote(null);
                  }}
                  error={errors.suburb}
                  autoComplete="address-level2"
                  hint={`${store.name} delivers to ${store.zones.slice(0, 3).join(', ')} and more.`}
                />
                <Field
                  label="Postal code"
                  value={postalCode}
                  onChange={(event) =>
                    // Digits only, four of them. Filtered as it is typed rather
                    // than rejected on submit: a customer who pastes "2196 "
                    // should not be told off for a trailing space.
                    setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  error={errors.postalCode}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  hint="A driver needs this to find you."
                />
                {quote?.serviceable && (
                  <p className="self-end rounded-sm bg-red-10 px-3 py-2.5 text-xs font-semibold text-red">
                    We deliver there. About {quote.etaMinutes} minutes.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 max-w-[52ch] text-sm text-muted">
                {mode === 'Collection'
                  ? `Collect from ${store.name}, ${store.address}.`
                  : `A table at ${store.name}, ${store.address}.`}
              </p>
            )}

            <TextArea
              label="Note for the kitchen"
              value={kitchenNote}
              onChange={(event) => setKitchenNote(event.target.value.slice(0, 280))}
              rows={3}
              className="mt-5"
              hint={`${kitchenNote.length} of 280 characters. Allergies go here, and the store will call if it cannot be met.`}
            />
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 className="display text-2xl">Payment</h2>
            {paymentConfigured ? (
              <div className="mt-4 rounded-md border border-line bg-white p-5">
                <p className="text-sm font-extrabold">You will be taken to our payment provider</p>
                <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">
                  Your order is placed first, then you are handed over to pay. Card details are
                  entered on the provider’s own page and never reach this site. You will come back
                  here to your order as soon as the payment is done.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-gold bg-white p-5">
                <p className="text-sm font-extrabold">No payment provider is configured</p>
                <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">
                  No merchant credentials exist on this deployment, so nothing is charged. Placing
                  the order below records it and starts the kitchen journey, exactly as it will once
                  merchant credentials are issued.
                </p>
                <DemoFlag label="Not live" />
              </div>
            )}

            {submitError && (
              <p role="alert" className="mt-4 rounded-sm bg-red-10 px-4 py-3 text-sm font-semibold text-red">
                {submitError}
              </p>
            )}
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((current) => current - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={checking}>
              {checking ? 'Checking your suburb…' : 'Continue'}
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting
                ? paymentConfigured
                  ? 'Taking you to pay…'
                  : 'Placing your order…'
                : paymentConfigured
                  ? 'Place order and pay'
                  : 'Place order'}
              {!submitting && (
                <>
                  <span aria-hidden="true" className="opacity-70">
                    ·
                  </span>
                  <Price cents={totals.totalCents} />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <CheckoutSummary />
    </div>
  );
}
