import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { formatDuration, formatLongDate, formatRand } from '../../shared/format';
import type { PaymentOption } from '../../shared/types';
import { Alert, Checkbox } from '../components/forms/Field';
import { Button, ButtonLink } from '../components/ui/Button';
import { Picture } from '../components/ui/Picture';
import { BookingHelp } from '../components/booking/BookingHelp';
import { site } from '../data/site';
import { api, RequestError, submitCheckout } from '../lib/api';
import { useBooking } from '../lib/useBooking';
import { useTitle } from '../lib/useTitle';

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
}

/**
 * The order summary and the only place money is asked for. Everything the
 * client is agreeing to — amount, service, date, time and terms — is on
 * screen before the button, and the button hands off to the gateway's hosted
 * checkout; no card details are ever entered on this site.
 */
export default function Payment() {
  useTitle('Payment');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('booking');
  const cancelled = params.get('cancelled') === '1';
  const { booking, error, loading } = useBooking(id);
  const [option, setOption] = useState<PaymentOption | null>(null);
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const secondsLeft = useCountdown(booking?.holdExpiresAt ?? null);

  if (loading) {
    return (
      <div className="page-gutter pt-32 pb-24" aria-busy="true">
        <div className="skeleton h-16 w-2/3" />
        <div className="skeleton mt-10 h-72" />
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="page-gutter pt-32 pb-24">
        <h1 className="editorial-title text-5xl">Booking not found</h1>
        <p className="mt-6 opacity-70">{error}</p>
        <ButtonLink to="/booking" className="mt-10">
          Start a booking
        </ButtonLink>
      </div>
    );
  }
  if (booking.status === 'confirmed' || booking.paymentStatus === 'paid') return <Navigate to={`/confirmation?booking=${booking.id}`} replace />;

  const expired = booking.status === 'expired' || secondsLeft === 0;
  const price = booking.priceCents ?? 0;
  const deposit = booking.depositCents && booking.depositCents < price ? booking.depositCents : null;
  const chosen: PaymentOption = option ?? (deposit ? 'deposit' : 'full');
  const amount = chosen === 'deposit' && deposit ? deposit : price;

  async function pay() {
    if (!accept) {
      setFieldError('Please accept the payment and cancellation terms.');
      return;
    }
    setSubmitting(true);
    setPayError(null);
    try {
      const checkout = await api.startPayment({ bookingId: booking!.id, option: chosen, acceptTerms: true });
      submitCheckout(checkout, navigate);
    } catch (e) {
      setPayError(e instanceof RequestError ? e.message : 'Payment could not be started. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="page-gutter pt-28 pb-24 lg:pt-36">
      <p className="ui-label opacity-60">(Payment)</p>
      <h1 className="editorial-title mt-6 text-5xl sm:text-6xl lg:text-7xl">
        Secure your <span className="editorial-italic">appointment.</span>
      </h1>
      <BookingHelp lead="Questions about payment?" className="mt-4 max-w-md" />

      <div className="mt-14 lg:grid lg:grid-cols-12 lg:gap-12">
        {/* Order summary first on mobile: it must be visible before checkout. */}
        <section aria-labelledby="summary-title" className="lg:order-2 lg:col-span-5 lg:col-start-8">
          <div className="border border-line lg:sticky lg:top-28">
            <Picture image={booking.serviceImage} alt="" sizes="(min-width: 1024px) 36vw, 100vw" className="aspect-[16/9]" />
            <div className="p-6">
              <h2 id="summary-title" className="ui-label opacity-60">
                Order summary
              </h2>
              <p className="mt-3 font-serif text-3xl leading-tight">{booking.serviceName}</p>
              <dl className="mt-6 border-t border-line font-sans text-sm">
                {(
                  [
                    ['Date', formatLongDate(booking.date)],
                    ['Time', `${booking.time} SAST`],
                    ['Duration', formatDuration(booking.durationMinutes)],
                    ['Name', booking.clientName],
                    ['Service total', formatRand(price)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 border-b border-line py-3">
                    <dt className="opacity-60">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-6 pt-5">
                  <dt className="ui-label">Due now</dt>
                  <dd className="font-serif text-3xl">{formatRand(amount)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="pay-title" className="mt-12 lg:order-1 lg:col-span-6 lg:mt-0">
          <h2 id="pay-title" className="font-serif text-3xl">
            How would you like to pay?
          </h2>

          {cancelled && !expired && (
            <div className="mt-6">
              <Alert kind="error">Payment was cancelled — nothing has been charged. Your time is still held; you can try again below.</Alert>
            </div>
          )}
          {booking.paymentStatus === 'failed' && !expired && (
            <div className="mt-6">
              <Alert kind="error">The last payment attempt did not go through. Nothing has been charged. Please try again.</Alert>
            </div>
          )}

          {expired ? (
            <div className="mt-8 space-y-6">
              <Alert kind="error">Your time slot was held for 20 minutes and has now been released. Please choose a time again — it only takes a moment.</Alert>
              <ButtonLink to={`/booking?service=${booking.serviceId}`} arrow>
                Choose a new time
              </ButtonLink>
            </div>
          ) : (
            <>
              {secondsLeft !== null && (
                <p className="mt-3 font-sans text-sm opacity-70" aria-live={secondsLeft < 120 ? 'polite' : 'off'}>
                  Your time is held for{' '}
                  <strong className="font-medium tabular-nums">
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </strong>
                </p>
              )}

              <fieldset className="mt-8 space-y-3">
                <legend className="sr-only">Payment option</legend>
                {(deposit ? (['deposit', 'full'] as const) : (['full'] as const)).map((o) => {
                  const on = chosen === o;
                  const value = o === 'deposit' ? deposit! : price;
                  return (
                    <label
                      key={o}
                      className={`flex min-h-16 cursor-pointer items-center justify-between gap-4 border px-5 py-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white ${on ? 'border-white bg-white text-black' : 'border-white/30 hover:border-white'}`}
                    >
                      <input type="radio" name="option" value={o} checked={on} onChange={() => setOption(o)} className="sr-only" />
                      <span>
                        <span className="block font-serif text-xl">{o === 'deposit' ? 'Pay a deposit' : 'Pay in full'}</span>
                        <span className="mt-1 block font-sans text-sm opacity-70">
                          {o === 'deposit' ? `The balance of ${formatRand(price - value)} is settled with the studio.` : 'Nothing more to pay for this service.'}
                        </span>
                      </span>
                      <span className="font-serif text-2xl">{formatRand(value)}</span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="mt-10 border-t border-line pt-6">
                <p className="ui-label opacity-60">Payment &amp; cancellation terms</p>
                <ul className="mt-3 space-y-1.5 font-sans text-sm opacity-80">
                  {site.paymentTerms.map((t) => (
                    <li key={t}>— {t}</li>
                  ))}
                </ul>
                <div className="mt-5">
                  <Checkbox
                    checked={accept}
                    onChange={(e) => {
                      setAccept(e.target.checked);
                      setFieldError(undefined);
                    }}
                    error={fieldError}
                    label="I have read and accept the payment and cancellation terms."
                  />
                </div>
              </div>

              {payError && (
                <div className="mt-6">
                  <Alert kind="error">{payError}</Alert>
                </div>
              )}

              <Button className="mt-8 w-full sm:w-auto" onClick={() => void pay()} loading={submitting}>
                <Lock aria-hidden className="size-4" /> Pay Securely · {formatRand(amount)}
              </Button>
              <p className="mt-4 font-sans text-xs opacity-60">You will be taken to our payment partner’s secure page to pay. Grateful never sees or stores your card details.</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
