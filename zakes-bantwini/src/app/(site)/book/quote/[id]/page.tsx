import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuoteResponse, TrackOnView } from '@/components/booking/PortalForms';
import { QuoteTable } from '@/components/booking/QuoteTable';
import { formatDayLong } from '@/lib/booking/dates';
import { getPortal } from '@/lib/booking/service';
import { EVENT_TYPES, PERFORMANCE_FORMATS } from '@/lib/booking/types';
import { acceptQuoteAction, requestChangesAction } from '../../actions';
import styles from '@/components/booking/Portal.module.css';

export const metadata: Metadata = { title: 'Your quote', robots: { index: false, follow: false } };

/**
 * The formal quotation (brief §10 QUOTE): event, date, venue, performance,
 * travel, accommodation, production, additional costs, tax, total, deposit,
 * balance, payment deadline, cancellation terms.
 */
export default async function QuotePage(props: PageProps<'/book/quote/[id]'>) {
  const { id: token } = await props.params;
  const portal = await getPortal(token);
  if (!portal) notFound();
  const { booking, event, customer, quote } = portal;
  const portalHref = `/book/confirmation/${token}`;

  if (!quote) {
    return (
      <div className={`container ${styles.page}`}>
        <header className={styles.head}>
          <p className="eyebrow eyebrow-accent">{booking.reference}</p>
          <h1 className="display display-m">Quote in preparation</h1>
          <p className="lede">Management is reviewing your request. We will email you the moment your quote is ready.</p>
          <Link href={portalHref} className={styles.back}>
            ← My booking
          </Link>
        </header>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <TrackOnView event="quote_viewed" />
      <header className={styles.head}>
        <p className="eyebrow eyebrow-accent">
          {booking.reference} · Quote version {quote.version}
        </p>
        <h1 className="display display-m">Your quote</h1>
        <p className="muted">
          Prepared for {customer.fullName}
          {customer.organisation ? `, ${customer.organisation}` : ''}. Valid until {formatDayLong(quote.validUntil)}.
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          {quote.clientMessage && <p className={`statement ${styles.message}`}>{quote.clientMessage}</p>}
          <QuoteTable quote={quote} />
          <section aria-labelledby="terms-title" className={styles.block}>
            <h2 id="terms-title" className={styles.blockTitle}>
              Cancellation terms
            </h2>
            <div className={styles.termsText}>{quote.cancellationTerms}</div>
          </section>
          <section aria-labelledby="respond-title" className={styles.block}>
            <h2 id="respond-title" className={styles.blockTitle}>
              {quote.status === 'sent' ? 'Respond' : 'Status'}
            </h2>
            {quote.status === 'sent' ? (
              <>
                <p className="muted">Accepting issues the performance agreement for your signature. The date is secured once the agreement is signed and the deposit received.</p>
                <QuoteResponse accept={acceptQuoteAction.bind(null, token, quote.id)} requestChanges={requestChangesAction.bind(null, token, quote.id)} />
              </>
            ) : (
              <p>
                {quote.status === 'accepted' ? 'You accepted this quote. ' : 'You asked for changes; an updated quote will follow. '}
                <Link href={portalHref} className="link-underline">
                  Go to my booking
                </Link>
              </p>
            )}
          </section>
        </div>
        <aside className={styles.side}>
          <section className={styles.block} aria-labelledby="event-title">
            <h2 id="event-title" className={styles.blockTitle}>
              Event
            </h2>
            <dl className={styles.facts}>
              <div>
                <dt>Event</dt>
                <dd>{EVENT_TYPES.find((t) => t.key === booking.eventType)?.label}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDayLong(event.date)}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>
                  {event.venue}, {event.city}, {event.country}
                </dd>
              </div>
              <div>
                <dt>Performance</dt>
                <dd>{PERFORMANCE_FORMATS.find((t) => t.key === booking.performanceFormat)?.label}</dd>
              </div>
              <div>
                <dt>Payment deadline</dt>
                <dd>Deposit by {formatDayLong(quote.depositDueDate)}</dd>
              </div>
            </dl>
          </section>
          <Link href={portalHref} className={styles.back}>
            ← My booking
          </Link>
        </aside>
      </div>
    </div>
  );
}
