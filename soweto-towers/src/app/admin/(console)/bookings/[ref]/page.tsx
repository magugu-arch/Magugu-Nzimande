import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { quickCheckInAction, removeClipAction, undoCheckInAction } from '@/app/admin/actions';
import { CancelForm, ClipForm, ResendForm } from '@/components/admin/BookingActions';
import { StatusBadge } from '@/components/admin/BookingStatus';
import { PlainActionButton } from '@/components/admin/forms';
import styles from '@/components/admin/admin.module.css';
import { absoluteUrl } from '@/content/site';
import { requireStaff } from '@/lib/auth/session';
import { bookingAudit } from '@/lib/data/admin';
import { bookingByRef, clipsFor } from '@/lib/data/bookings';
import { rand } from '@/lib/format';
import { formatDayLong, hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Booking' };

type Params = Promise<{ ref: string }>;

const when = (d: Date | null) => (d ? `${formatDayLong(ymdInSast(d))}, ${hmInSast(d)}` : '—');

async function Detail({ params }: { params: Params }) {
  await requireStaff();
  const { ref } = await params;
  const d = await bookingByRef(decodeURIComponent(ref));
  if (!d) notFound();
  const { booking: b, items, people } = d;
  const [clips, log] = await Promise.all([clipsFor(b.ref), bookingAudit(b.ref)]);
  const meta = b.meta as { summary?: string; groupSaving?: number; demo?: boolean; paidAfterHoldExpired?: boolean };
  const minors = people.filter((p) => p.ageBand === 'minor');
  const ticketUrl = absoluteUrl(`/ticket/${b.ref}?t=${b.ticketToken}`);
  const waNumber = b.phone.replace(/[^\d]/g, '').replace(/^0/, '27');

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">
            <Link href="/admin/bookings" className={styles.rowLink}>
              Bookings
            </Link>{' '}
            · <span className={styles.mono}>{b.ref}</span>
          </p>
          <h1 className={styles.pageTitle}>{b.name}</h1>
          <p className={styles.pageSub}>
            {meta.summary ?? b.kind}
            {b.visitDate ? ` · ${formatDayLong(b.visitDate)}` : ''}
          </p>
        </div>
        <div className={styles.rowActions}>
          <StatusBadge status={b.status} />
          {b.checkedInAt ? (
            <>
              <span className={`${styles.st} ${styles.stDark}`}>Checked in {hmInSast(b.checkedInAt)}</span>
              <PlainActionButton action={undoCheckInAction} fields={{ ref: b.ref }} className="btn btn--light btn--sm">
                Undo check-in
              </PlainActionButton>
            </>
          ) : b.status === 'paid' && b.kind !== 'voucher' ? (
            <PlainActionButton action={quickCheckInAction} fields={{ ref: b.ref }} className="btn btn--primary">
              Check in
            </PlainActionButton>
          ) : null}
        </div>
      </header>

      {meta.paidAfterHoldExpired && (
        <p role="alert" className={`${styles.message} ${styles.messageErr}`}>
          Payment arrived after the hold had expired. Check the slot isn’t over capacity before the visit.
        </p>
      )}

      <div className={styles.grid2}>
        <section className={styles.panel} aria-labelledby="items-title">
          <h2 id="items-title" className={styles.panelTitle}>
            What’s booked
          </h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Time</th>
                <th className={styles.num}>Qty</th>
                <th className={styles.num}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.label}
                    {(i.meta as { groupRate?: boolean }).groupRate ? <span className={styles.muted}> · group rate</span> : null}
                  </td>
                  <td>{i.slotTime ?? '—'}</td>
                  <td className={styles.num}>{i.qty}</td>
                  <td className={styles.num}>{rand(i.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {b.discount > 0 && (
                <tr>
                  <td colSpan={3}>Package saving</td>
                  <td className={styles.num}>−{rand(b.discount)}</td>
                </tr>
              )}
              {b.voucherApplied > 0 && (
                <tr>
                  <td colSpan={3}>
                    Voucher <span className={styles.mono}>{b.voucherCode}</span>
                  </td>
                  <td className={styles.num}>−{rand(b.voucherApplied)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td className={styles.num}>
                  <strong>{rand(b.total)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className={styles.panel} aria-labelledby="contact-title">
          <h2 id="contact-title" className={styles.panelTitle}>
            Contact and payment
          </h2>
          <dl className={styles.rows} style={{ margin: 0 }}>
            {[
              [
                'Email',
                <a key="e" href={`mailto:${b.email}?subject=${encodeURIComponent(`Your booking ${b.ref}`)}`}>
                  {b.email}
                </a>,
              ],
              [
                'Phone',
                <span key="p">
                  <a href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a> ·{' '}
                  <a
                    href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi ${b.name.split(' ')[0]}, it’s Soweto Towers about booking ${b.ref}. `)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    WhatsApp
                  </a>
                </span>,
              ],
              [
                'Messages',
                `${b.notifyWhatsapp ? 'WhatsApp updates on' : 'WhatsApp updates off'} · ${b.marketingOptIn ? 'marketing opt-in' : 'no marketing'} · ${b.clipConsent ? 'clip may be reposted' : 'no repost'}`,
              ],
              ['Paid', b.paidAt ? `${when(b.paidAt)} · ${b.paymentProvider ?? ''}${b.paymentRef ? ` · ${b.paymentRef}` : ''}` : '—'],
              ['Booked', `${when(b.createdAt)}${b.source ? ` · source ${b.source}` : ''}${b.partnerCode ? ` · partner ${b.partnerCode}` : ''}`],
              [
                'Ticket',
                <a key="t" href={ticketUrl} target="_blank" rel="noopener">
                  Open ticket
                </a>,
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className={styles.row} style={{ gridTemplateColumns: '110px minmax(0,1fr)' }}>
                <dt className={styles.muted}>{label}</dt>
                <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className={styles.grid2}>
        <section className={styles.panel} aria-labelledby="people-title">
          <h2 id="people-title" className={styles.panelTitle}>
            People and waiver
          </h2>
          {people.length === 0 ? (
            <p className={styles.muted}>No participant details on this booking.</p>
          ) : (
            <ul className={styles.rows} role="list">
              {people.map((p) => (
                <li key={p.id} className={`${styles.row} ${styles.rowSplit}`}>
                  <span className={styles.rowTitle}>{p.name}</span>
                  <span className={styles.rowActions}>
                    {p.weightKg != null && <span className={styles.st}>{p.weightKg} kg</span>}
                    {p.ageBand === 'minor' && <span className={`${styles.st} ${styles.stWarn}`}>Under 18</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {b.waiver ? (
            <p className={styles.small}>
              Indemnity accepted by <strong>{b.waiver.signedName}</strong> on {when(new Date(b.waiver.signedAt))}.
              {b.waiver.acceptedMedical ? ' Medical declaration confirmed.' : ' Medical declaration not confirmed.'}
              {b.waiver.guardian ? ` Guardian consent: ${b.waiver.guardian.name} for ${b.waiver.guardian.for.join(', ')}.` : ''}
            </p>
          ) : (
            <p className={styles.muted}>No waiver on file.</p>
          )}
          {minors.length > 0 && !b.waiver?.guardian && (
            <p className={`${styles.message} ${styles.messageErr}`}>Minors on this booking but no guardian consent recorded: collect it at the gate.</p>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="clips-title">
          <h2 id="clips-title" className={styles.panelTitle}>
            Scream Clip and videos
          </h2>
          {clips.length > 0 && (
            <ul className={styles.rows} role="list">
              {clips.map((c) => (
                <li key={c.id} className={`${styles.row} ${styles.rowSplit}`}>
                  <span>
                    <span className={styles.rowTitle}>{c.kind === 'scream' ? 'Scream Clip' : 'Full HD edit'}</span>
                    <span className={styles.rowMeta}>
                      {c.participant ?? 'Whole booking'} ·{' '}
                      <a href={c.url} target="_blank" rel="noopener">
                        Open
                      </a>
                    </span>
                  </span>
                  <PlainActionButton
                    action={removeClipAction}
                    fields={{ id: String(c.id), ref: b.ref }}
                    className={styles.linkBtn}
                    confirmText="Remove this video link?"
                  >
                    Remove
                  </PlainActionButton>
                </li>
              ))}
            </ul>
          )}
          {b.status === 'paid' && b.kind === 'adventure' ? (
            <ClipForm bookingRef={b.ref} people={people.map((p) => p.name)} />
          ) : (
            <p className={styles.muted}>Videos attach to paid adventure bookings.</p>
          )}
        </section>
      </div>

      <div className={styles.grid2}>
        <section className={styles.panel} aria-labelledby="resend-title">
          <h2 id="resend-title" className={styles.panelTitle}>
            Messages
          </h2>
          <p className={styles.small}>Re-sends the email and, if they opted in, the WhatsApp confirmation with the ticket link.</p>
          {b.status === 'paid' ? <ResendForm bookingRef={b.ref} /> : <p className={styles.muted}>Only paid bookings get confirmations.</p>}
          {log.length > 0 && (
            <details className={styles.details}>
              <summary>History ({log.length})</summary>
              <ul className={styles.rows} role="list">
                {log.map((l) => (
                  <li key={l.id} className={styles.row}>
                    <span className={styles.small}>
                      {when(l.createdAt)} · {l.staffName ?? 'System'} · {l.action.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        {['paid', 'pending_payment', 'held'].includes(b.status) && (
          <section className={styles.panel} aria-labelledby="cancel-title">
            <h2 id="cancel-title" className={styles.panelTitle}>
              Cancel
            </h2>
            <CancelForm bookingRef={b.ref} paid={b.status === 'paid'} />
          </section>
        )}
      </div>
      {meta.demo && <p className={styles.muted}>Sample booking from the preview database.</p>}
    </>
  );
}

export default function BookingDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className={styles.skeleton} />}>
      <Detail params={params} />
      <p className={styles.small}>
        <Link href={'/admin/bookings' as Route} className="link-arrow">
          Back to bookings
        </Link>
      </p>
    </Suspense>
  );
}
