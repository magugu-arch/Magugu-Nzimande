import { CalendarPlus, LoaderCircle, Mail, MessageCircle, Phone } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { formatDuration, formatLongDate, formatRand, sastToDate } from '../../shared/format';
import type { PublicBooking } from '../../shared/types';
import { Alert } from '../components/forms/Field';
import { ButtonLink } from '../components/ui/Button';
import { FadeIn, ImageReveal } from '../components/ui/ImageReveal';
import { Picture } from '../components/ui/Picture';
import { site } from '../data/site';
import { useBooking } from '../lib/useBooking';
import { useTitle } from '../lib/useTitle';

function googleCalendarUrl(b: PublicBooking) {
  const start = sastToDate(b.date, b.time);
  const end = new Date(start.getTime() + b.durationMinutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Grateful — ${b.serviceName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Your appointment with Grateful. To reschedule, call ${site.phone} or email ${site.email}.`,
    location: site.location,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/**
 * Shown after booking or payment. When a payment is involved it waits for the
 * server to verify the gateway's notification before saying "confirmed" —
 * returning from checkout proves nothing on its own.
 */
export default function Confirmation() {
  useTitle('Confirmation');
  const [params] = useSearchParams();
  const { booking, error, loading, timedOut, reload } = useBooking(params.get('booking'), (b) => b.status === 'pending_payment' && b.paymentStatus === 'pending');

  if (loading) {
    return (
      <div className="page-gutter pt-32 pb-24" aria-busy="true">
        <div className="skeleton h-24 w-3/4" />
        <div className="skeleton mt-10 h-64" />
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="page-gutter pt-32 pb-24">
        <h1 className="editorial-title text-5xl">We couldn’t find that booking</h1>
        <p className="mt-6 max-w-md opacity-70">{error} If you’ve just paid, please contact the studio and we’ll sort it out.</p>
        <ButtonLink to="/contact" className="mt-10">
          Contact the studio
        </ButtonLink>
      </div>
    );
  }

  const confirmed = booking.status === 'confirmed';
  const waiting = booking.status === 'pending_payment' && booking.paymentStatus === 'pending';

  if (!confirmed) {
    return (
      <div className="page-gutter flex min-h-[80svh] flex-col justify-center pt-32 pb-24">
        {waiting && !timedOut && (
          <div role="status" className="max-w-xl">
            <LoaderCircle aria-hidden className="size-8 animate-spin" />
            <h1 className="editorial-title mt-8 text-5xl lg:text-6xl">Confirming your payment…</h1>
            <p className="mt-6 opacity-70">This usually takes a few seconds. Please keep this page open.</p>
          </div>
        )}
        {waiting && timedOut && (
          <div className="max-w-xl space-y-6">
            <h1 className="editorial-title text-5xl">Still waiting to hear from the bank</h1>
            <p className="opacity-70">If you completed payment, your confirmation email will arrive as soon as it is verified. You can check again, or contact the studio.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="ui-label inline-flex min-h-11 items-center justify-center bg-white px-6 text-black" onClick={() => void reload()}>
                Check again
              </button>
              <ButtonLink to="/contact" variant="secondary">
                Contact the studio
              </ButtonLink>
            </div>
          </div>
        )}
        {(booking.paymentStatus === 'failed' || booking.paymentStatus === 'cancelled') && booking.status === 'pending_payment' && (
          <div className="max-w-xl space-y-6">
            <h1 className="editorial-title text-5xl">Payment didn’t go through</h1>
            <Alert kind="error">Nothing has been charged. Your time may still be held — try again now.</Alert>
            <ButtonLink to={`/payment?booking=${booking.id}`} arrow>
              Try payment again
            </ButtonLink>
          </div>
        )}
        {booking.status === 'expired' && (
          <div className="max-w-xl space-y-6">
            <h1 className="editorial-title text-5xl">This booking has lapsed</h1>
            <p className="opacity-70">The time was held while checkout was open and has since been released.</p>
            <ButtonLink to={`/booking?service=${booking.serviceId}`} arrow>
              Book again
            </ButtonLink>
          </div>
        )}
        {booking.status === 'needs_attention' && (
          <div className="max-w-xl space-y-6">
            <h1 className="editorial-title text-5xl">Payment received — we’ll be in touch</h1>
            <p className="opacity-70">
              Your payment came through, but the time you chose was taken while checkout was open. The studio will contact you shortly to find a new time or refund you in full. You can also call {site.phone}.
            </p>
          </div>
        )}
        {booking.status === 'cancelled' && (
          <div className="max-w-xl space-y-6">
            <h1 className="editorial-title text-5xl">This booking was cancelled</h1>
            <ButtonLink to="/booking" arrow>
              Make a new booking
            </ButtonLink>
          </div>
        )}
      </div>
    );
  }

  const paymentLine =
    booking.amountPaidCents != null
      ? `${booking.amountPaidCents < (booking.priceCents ?? 0) ? 'Deposit paid' : 'Paid in full'} — ${formatRand(booking.amountPaidCents)}`
      : booking.priceCents == null
        ? 'Quote to follow after your consultation'
        : 'No payment required';

  return (
    <div className="pt-16 lg:grid lg:min-h-svh lg:grid-cols-12 lg:pt-20">
      <ImageReveal className="relative h-[46svh] lg:order-2 lg:col-span-5 lg:h-auto">
        <Picture image={booking.serviceImage} mono priority sizes="(min-width: 1024px) 42vw, 100vw" className="h-full" />
      </ImageReveal>

      <div className="page-gutter pt-12 pb-24 lg:order-1 lg:col-span-7 lg:pt-16">
        <p className="ui-label opacity-60" role="status">
          Booking confirmed
        </p>
        <h1 className="editorial-title mt-6 text-[3.2rem] sm:text-7xl lg:text-[6.5rem]">
          Your Grateful
          <br />
          <span className="editorial-italic">journey begins.</span>
        </h1>
        <FadeIn delay={0.2}>
          <p className="mt-8 max-w-lg text-lg opacity-80">
            Thank you, {booking.clientName.split(' ')[0]}. A confirmation has been sent to <strong className="font-semibold">{booking.email}</strong>.
          </p>

          <dl className="mt-12 max-w-xl border-t border-line">
            {(
              [
                ['Service', booking.serviceName],
                ['Date', formatLongDate(booking.date)],
                ['Time', `${booking.time} SAST`],
                ['Duration', formatDuration(booking.durationMinutes)],
                ['Payment', paymentLine],
                ['Location', `${site.location} — details to follow`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 border-b border-line py-4">
                <dt className="ui-label pt-1 opacity-60">{k}</dt>
                <dd className="col-span-2">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href={`/api/booking/${booking.id}/calendar.ics`} className="ui-label inline-flex min-h-11 items-center justify-center gap-3 bg-white px-6 text-black hover:bg-white/85">
              <CalendarPlus aria-hidden className="size-4" /> Add to Calendar
            </a>
            <a
              href={googleCalendarUrl(booking)}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-label inline-flex min-h-11 items-center justify-center gap-3 border border-white/40 px-6 hover:bg-white hover:text-black"
            >
              Google Calendar
            </a>
          </div>

          <section aria-labelledby="next-title" className="mt-16 max-w-xl">
            <h2 id="next-title" className="font-serif text-2xl">
              What happens next
            </h2>
            <ul className="mt-4 space-y-2 opacity-80">
              <li>— We’ll be in touch before your appointment to confirm the details.</li>
              <li>— Bring any inspiration you love: images, fabrics, a garment you want to reference.</li>
              <li>— To reschedule or cancel, contact us at least 48 hours before your appointment.</li>
            </ul>
            <div className="mt-8 flex flex-col gap-1 font-sans text-sm">
              <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-3 hover:underline">
                <Phone aria-hidden className="size-4" /> {site.phone}
              </a>
              <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center gap-3 hover:underline">
                <Mail aria-hidden className="size-4" /> {site.email}
              </a>
              <a href={site.whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-3 hover:underline">
                <MessageCircle aria-hidden className="size-4" /> WhatsApp
              </a>
            </div>
          </section>
        </FadeIn>
      </div>
    </div>
  );
}
