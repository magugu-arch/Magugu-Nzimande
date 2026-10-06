import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PayButton, SignAgreement } from '@/components/booking/PortalForms';
import { FormAlert } from '@/components/forms/fields';
import { ButtonLink } from '@/components/ui/Button';
import { getSettings } from '@/content';
import { formatDayLong, formatMoment } from '@/lib/booking/dates';
import { formatZar } from '@/lib/booking/quote';
import { getPortal } from '@/lib/booking/service';
import { CLIENT_TIMELINE, STATUS_META, timelineIndex } from '@/lib/booking/status';
import { EVENT_TYPES, PERFORMANCE_FORMATS } from '@/lib/booking/types';
import { getStore } from '@/lib/store';
import { signContractAction, startPaymentAction } from '../../actions';
import styles from '@/components/booking/Portal.module.css';

export const metadata: Metadata = { title: 'My booking', robots: { index: false, follow: false } };

const EVENT_LABEL: Record<string, string> = {
  enquiry_received: 'Request received',
  quote_ready: 'Quote ready',
  quote_accepted: 'Quote accepted',
  contract_ready: 'Agreement ready',
  contract_signed: 'Agreement signed',
  deposit_requested: 'Deposit requested',
  deposit_received: 'Deposit received',
  balance_received: 'Balance received',
  payment_failed: 'Payment not completed',
  booking_confirmed: 'Booking confirmed',
  balance_reminder: 'Balance reminder',
  event_reminder: 'Event reminder',
};

/** The client portal: my booking, status timeline, quote, agreement, payments, documents, messages. */
export default async function PortalPage(props: PageProps<'/book/confirmation/[id]'>) {
  const { id: token } = await props.params;
  const { payment, accepted } = await props.searchParams;
  const portal = await getPortal(token);
  if (!portal) notFound();

  const { booking, customer, event, quote, contract, payments, documents } = portal;
  const [settings, notifications] = await Promise.all([
    getSettings(),
    getStore().list('notifications', { where: { bookingId: booking.id, channel: 'email', audience: 'client' }, orderBy: { field: 'createdAt', dir: 'desc' }, limit: 20 }),
  ]);
  const reached = timelineIndex(booking.status);
  const cancelled = booking.status === 'CANCELLED';
  const canPayDeposit = booking.status === 'AWAITING_DEPOSIT' && contract?.status === 'signed' && !portal.depositPaid;
  const canPayBalance = booking.status === 'CONFIRMED' && !portal.balancePaid && (quote?.balanceCents ?? 0) > 0;

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="eyebrow eyebrow-accent">My booking</p>
        <h1 className="display display-m">{booking.reference}</h1>
        <p className={styles.status} role="status">
          <span className={styles.statusDot} data-status={booking.status} aria-hidden="true" />
          {STATUS_META[booking.status].client}
        </p>
        <p className="muted">Keep this page’s link private — it is your access to the booking. We have emailed it to {customer.email}.</p>
      </header>

      {accepted === '1' && contract?.status === 'sent' && (
        <FormAlert tone="success">Quote accepted. Your performance agreement is below — sign it to move on to the deposit.</FormAlert>
      )}
      {payment === 'returned' && (
        <FormAlert tone="info">
          Thank you. The payment provider is confirming your payment with us; this page updates as soon as it arrives. If it does not appear within a few minutes,
          contact the booking team.
        </FormAlert>
      )}
      {payment === 'cancelled' && <FormAlert tone="info">Payment cancelled — nothing was charged. You can try again below whenever you are ready.</FormAlert>}

      <div className={styles.layout}>
        <div className={styles.main}>
          <section aria-labelledby="timeline-title" className={styles.block}>
            <h2 id="timeline-title" className={styles.blockTitle}>
              Status
            </h2>
            {cancelled ? (
              <p>This booking has been cancelled. If you think this is a mistake, contact the booking team.</p>
            ) : (
              <ol role="list" className={styles.timeline}>
                {CLIENT_TIMELINE.map((step, i) => (
                  <li key={step.status} data-state={i < reached ? 'done' : i === reached ? 'current' : 'next'} aria-current={i === reached ? 'step' : undefined}>
                    <span className={styles.timelineTitle}>{step.title}</span>
                    <span className="muted">{step.detail}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="quote-title" className={styles.block}>
            <h2 id="quote-title" className={styles.blockTitle}>
              Quote
            </h2>
            {quote ? (
              <div className={styles.summaryRow}>
                <div>
                  <p className={styles.big}>{formatZar(quote.totalCents)}</p>
                  <p className="muted">
                    Version {quote.version} ·{' '}
                    {quote.status === 'accepted' ? 'Accepted' : quote.status === 'changes_requested' ? 'Changes requested — an updated quote will follow' : `Valid until ${formatDayLong(quote.validUntil)}`}
                  </p>
                </div>
                <ButtonLink href={`/book/quote/${token}`} variant={quote.status === 'sent' ? 'primary' : 'outline'} small>
                  {quote.status === 'sent' ? 'Review and respond' : 'View quote'}
                </ButtonLink>
              </div>
            ) : (
              <p className="muted">Your quote appears here after management review. We will email you as soon as it is ready.</p>
            )}
          </section>

          <section aria-labelledby="agreement-title" className={styles.block}>
            <h2 id="agreement-title" className={styles.blockTitle}>
              Agreement
            </h2>
            {!contract && <p className="muted">The performance agreement is issued when you accept the quote.</p>}
            {contract && (
              <>
                <details className={styles.terms} open={contract.status === 'sent'}>
                  <summary>Performance agreement {contract.status === 'signed' ? '(signed)' : ''}</summary>
                  <pre className={styles.termsText}>{contract.terms}</pre>
                </details>
                {contract.status === 'signed' ? (
                  <p>
                    Signed by <strong>{contract.signerName}</strong> on {formatMoment(contract.signedAt!)}.
                  </p>
                ) : (
                  <SignAgreement sign={signContractAction.bind(null, token, contract.id)} defaultName={customer.fullName} />
                )}
              </>
            )}
          </section>

          <section aria-labelledby="payments-title" className={styles.block}>
            <h2 id="payments-title" className={styles.blockTitle}>
              Payments
            </h2>
            {canPayDeposit && quote && <PayButton start={startPaymentAction.bind(null, token, 'deposit')} label={`Pay deposit — ${formatZar(quote.depositCents)}`} />}
            {canPayBalance && quote && <PayButton start={startPaymentAction.bind(null, token, 'balance')} label={`Pay balance — ${formatZar(quote.balanceCents)}`} />}
            {payments.length > 0 ? (
              <ul role="list" className={styles.list}>
                {payments.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.kind === 'deposit' ? 'Deposit' : 'Balance'} · {formatZar(p.amountCents)}
                    </span>
                    <span className={styles.pill} data-tone={p.status}>
                      {p.status === 'complete' ? 'Received' : p.status === 'pending' ? 'Awaiting confirmation' : p.status === 'failed' ? 'Not completed' : p.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              !canPayDeposit && <p className="muted">Payments open once the agreement is signed.</p>
            )}
          </section>

          <section aria-labelledby="documents-title" className={styles.block}>
            <h2 id="documents-title" className={styles.blockTitle}>
              Documents
            </h2>
            {documents.length ? (
              <ul role="list" className={styles.list}>
                {documents.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documents/${d.id}?t=${encodeURIComponent(token)}`}>{d.filename}</a>
                    <span className="muted">{(d.size / 1024).toFixed(0)} KB</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Your event brief and any agreements or riders the team shares will appear here.</p>
            )}
          </section>
        </div>

        <aside className={styles.side}>
          <section aria-labelledby="event-title" className={styles.block}>
            <h2 id="event-title" className={styles.blockTitle}>
              Event details
            </h2>
            <dl className={styles.facts}>
              <div>
                <dt>Date</dt>
                <dd>{formatDayLong(event.date)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {event.startTime ?? 'TBC'}
                  {event.endTime ? ` – ${event.endTime}` : ''}
                </dd>
              </div>
              <div>
                <dt>Event</dt>
                <dd>{EVENT_TYPES.find((t) => t.key === booking.eventType)?.label}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{PERFORMANCE_FORMATS.find((t) => t.key === booking.performanceFormat)?.label}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>
                  {event.venue}, {event.city}, {event.country}
                </dd>
              </div>
              <div>
                <dt>Attendance</dt>
                <dd>{booking.expectedAttendance.toLocaleString('en-ZA')}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="messages-title" className={styles.block}>
            <h2 id="messages-title" className={styles.blockTitle}>
              Notifications
            </h2>
            {notifications.length ? (
              <ul role="list" className={styles.messages}>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <span>{EVENT_LABEL[n.event] ?? n.event}</span>
                    <span className="muted">{formatMoment(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Emails we send you about this booking are listed here.</p>
            )}
          </section>

          <section aria-labelledby="contact-title" className={styles.block}>
            <h2 id="contact-title" className={styles.blockTitle}>
              Contact the booking team
            </h2>
            <p className="muted">Quote your reference, {booking.reference}.</p>
            {settings.bookingEmail ? (
              <a className={styles.contact} href={`mailto:${settings.bookingEmail}?subject=${encodeURIComponent(`Booking ${booking.reference}`)}`}>
                {settings.bookingEmail}
              </a>
            ) : (
              <p>Reply to any email we have sent about this booking and it reaches the team directly.</p>
            )}
          </section>
          <Link href="/" className={styles.back}>
            ← Back to the site
          </Link>
        </aside>
      </div>
    </div>
  );
}
