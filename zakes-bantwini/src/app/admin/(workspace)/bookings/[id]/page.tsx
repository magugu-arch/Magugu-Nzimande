import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, QuoteEditor } from '@/components/admin/AdminForms';
import { Checkbox, Select, TextArea, TextField } from '@/components/forms/fields';
import { requireAdmin } from '@/lib/auth/admin';
import { addDays, formatDay, formatDayLong, formatMoment, todayIso } from '@/lib/booking/dates';
import { formatZar } from '@/lib/booking/quote';
import { portalUrl } from '@/lib/booking/service';
import { STATUS_META, TRANSITIONS } from '@/lib/booking/status';
import { BUDGET_RANGES, EVENT_TYPES, PERFORMANCE_FORMATS } from '@/lib/booking/types';
import { getStore } from '@/lib/store';
import {
  addNoteAction,
  changeStatusAction,
  confirmBookingAction,
  holdDateAction,
  recordPaymentAction,
  reissueContractAction,
  saveQuoteAction,
  uploadDocumentAction,
} from '../../../actions';
import styles from '../../../admin.module.css';

const label = <T extends { key: string; label: string }>(list: readonly T[], key: string) => list.find((i) => i.key === key)?.label ?? key;

export default async function BookingDetail(props: PageProps<'/admin/bookings/[id]'>) {
  const { id } = await props.params;
  const admin = await requireAdmin();
  const store = getStore();
  const booking = await store.get('bookings', id);
  if (!booking) notFound();
  const [customer, event, quotes, contracts, payments, documents, notes, notifications, audit] = await Promise.all([
    store.get('customers', booking.customerId),
    store.get('events', booking.eventId),
    store.list('quotes', { where: { bookingId: id }, orderBy: { field: 'version', dir: 'desc' } }),
    store.list('contracts', { where: { bookingId: id }, orderBy: { field: 'createdAt', dir: 'desc' } }),
    store.list('payments', { where: { bookingId: id }, orderBy: { field: 'createdAt', dir: 'desc' } }),
    store.list('documents', { where: { bookingId: id }, orderBy: { field: 'createdAt', dir: 'desc' } }),
    store.list('internal_notes', { where: { bookingId: id }, orderBy: { field: 'createdAt', dir: 'desc' } }),
    store.list('notifications', { where: { bookingId: id }, orderBy: { field: 'createdAt', dir: 'desc' }, limit: 40 }),
    store.list('audit_log', { where: { bookingId: id }, orderBy: { field: 'createdAt', dir: 'desc' }, limit: 60 }),
  ]);
  if (!customer || !event) notFound();

  const readOnly = admin.role === 'viewer';
  const closed = ['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(booking.status);
  const draft = quotes.find((q) => q.status === 'draft') ?? null;
  const accepted = quotes.find((q) => q.status === 'accepted');
  const signed = contracts.find((c) => c.status === 'signed');
  const openContract = contracts.find((c) => c.status === 'sent');
  const depositPaid = payments.some((p) => p.kind === 'deposit' && p.status === 'complete');
  const moves = TRANSITIONS[booking.status].filter((s) => s !== 'CONFIRMED');
  const today = todayIso();

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">
            <Link href="/admin/bookings">Bookings</Link> / {booking.reference}
          </p>
          <h1>
            {customer.fullName}
            {customer.organisation ? ` · ${customer.organisation}` : ''}
          </h1>
          <p className={styles.small}>
            {formatDayLong(event.date)} · {event.venue}, {event.city}
          </p>
        </div>
        <span className={styles.badge} data-status={booking.status} style={{ fontSize: 13 }}>
          {STATUS_META[booking.status].label}
        </span>
      </header>

      <div className={styles.detail}>
        <div style={{ display: 'grid', gap: 20 }}>
          <section className={styles.panel} aria-labelledby="request-title">
            <h2 id="request-title">Request</h2>
            <dl className={styles.dl}>
              <dt>Contact</dt>
              <dd>
                <a href={`mailto:${customer.email}`}>{customer.email}</a> · <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
                {customer.whatsappOptIn ? ' · WhatsApp updates on' : ''}
              </dd>
              <dt>Event</dt>
              <dd>
                {label(EVENT_TYPES, booking.eventType)} · {label(PERFORMANCE_FORMATS, booking.performanceFormat)}
              </dd>
              <dt>When</dt>
              <dd>
                {formatDayLong(event.date)} · {event.startTime}
                {event.endTime ? `–${event.endTime}` : ''}
              </dd>
              <dt>Where</dt>
              <dd>
                {event.venue}, {event.city}, {event.country}
              </dd>
              <dt>Attendance</dt>
              <dd>{booking.expectedAttendance.toLocaleString('en-ZA')}</dd>
              <dt>Budget</dt>
              <dd>{label(BUDGET_RANGES, booking.budgetRange)}</dd>
              <dt>Travel</dt>
              <dd>{booking.travelRequired ? booking.travelNotes || 'Required' : 'Not required'}</dd>
              <dt>Accommodation</dt>
              <dd>{booking.accommodationRequired ? booking.accommodationNotes || 'Required' : 'Not required'}</dd>
              <dt>Production</dt>
              <dd>{booking.productionNotes ?? '—'}</dd>
              <dt>Notes</dt>
              <dd>{booking.additionalInfo ?? '—'}</dd>
              <dt>Received</dt>
              <dd>{formatMoment(booking.createdAt)}</dd>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="quote-title">
            <h2 id="quote-title">Quote</h2>
            {quotes.filter((q) => q.status !== 'draft').length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Client note</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes
                    .filter((q) => q.status !== 'draft')
                    .map((q) => (
                      <tr key={q.id}>
                        <td>v{q.version}</td>
                        <td>{q.status.replace('_', ' ')}</td>
                        <td>{formatZar(q.totalCents)}</td>
                        <td className={styles.small}>{q.clientResponseNote ?? '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {closed ? (
              <p className={styles.small}>Quotes are locked once a booking is confirmed or closed.</p>
            ) : readOnly ? (
              <p className={styles.small}>Read-only role.</p>
            ) : (
              <>
                <p className={styles.small}>{draft ? `Editing draft v${draft.version}.` : quotes.length ? 'Start a revised quote.' : 'Prepare the first quote.'} Sending supersedes any open quote and holds the date.</p>
                <QuoteEditor
                  action={saveQuoteAction.bind(null, id)}
                  draft={draft ?? quotes.find((q) => q.status === 'changes_requested' || q.status === 'sent') ?? null}
                  defaults={{ depositDueDate: addDays(today, 7), validUntil: addDays(today, 14), balanceDueDate: event.date > addDays(today, 21) ? addDays(event.date, -14) : null }}
                />
              </>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="contract-title">
            <h2 id="contract-title">Agreement</h2>
            {signed ? (
              <p>
                Signed by <strong>{signed.signerName}</strong> on {formatMoment(signed.signedAt!)} · terms hash <code>{signed.termsHash.slice(0, 12)}</code>
              </p>
            ) : openContract ? (
              <p>Issued {formatMoment(openContract.sentAt ?? openContract.createdAt)} — awaiting the client’s signature.</p>
            ) : (
              <p className={styles.small}>Issued automatically when the client accepts a quote.</p>
            )}
            {(signed ?? openContract) && (
              <details>
                <summary className={styles.small}>Show agreement text</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--bone)' }}>{(signed ?? openContract)!.terms}</pre>
              </details>
            )}
            {accepted && !signed && !readOnly && <ActionForm action={reissueContractAction.bind(null, id)} submit="Reissue agreement" variant="outline" />}
          </section>

          <section className={styles.panel} aria-labelledby="payments-title">
            <h2 id="payments-title">Payments</h2>
            {payments.length ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Amount</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.kind}</td>
                      <td>{formatZar(p.amountCents)}</td>
                      <td>{p.provider}</td>
                      <td>{p.status}</td>
                      <td className={styles.small}>{p.providerReference ?? p.merchantReference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.small}>No payments yet. The client pays the deposit from their booking page after signing.</p>
            )}
            {accepted && !readOnly && (
              <ActionForm action={recordPaymentAction.bind(null, id)} submit="Record EFT payment" variant="outline">
                <Select name="kind" label="Kind" options={[{ key: 'deposit', label: 'Deposit' }, { key: 'balance', label: 'Balance' }]} defaultValue="deposit" />
                <TextField name="amount" label="Amount (R)" inputMode="decimal" placeholder={formatZar(accepted.depositCents)} />
                <TextField name="reference" label="Bank reference" optional />
              </ActionForm>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="docs-title">
            <h2 id="docs-title">Documents</h2>
            {documents.length ? (
              <ul role="list" className={styles.feed}>
                {documents.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documents/${d.id}`}>{d.filename}</a>
                    <span className={styles.meta}>
                      {d.kind} · {(d.size / 1024).toFixed(0)} KB · {d.uploadedBy} · {d.clientVisible ? 'visible to client' : 'internal'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.small}>No documents.</p>
            )}
            {!readOnly && (
              <ActionForm action={uploadDocumentAction.bind(null, id)} submit="Upload" variant="outline" resetOnSuccess>
                <Select
                  name="kind"
                  label="Type"
                  options={[
                    { key: 'agreement', label: 'Signed agreement' },
                    { key: 'rider', label: 'Technical rider' },
                    { key: 'receipt', label: 'Receipt / invoice' },
                    { key: 'other', label: 'Other' },
                  ]}
                  defaultValue="rider"
                />
                <div>
                  <label htmlFor="file" className="eyebrow">
                    File
                  </label>
                  <input id="file" name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required />
                </div>
                <Checkbox name="clientVisible" label="Share with client" />
              </ActionForm>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="notify-title">
            <h2 id="notify-title">Notifications</h2>
            {notifications.length ? (
              <ul role="list" className={styles.feed}>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <span>
                      {n.event.replace(/_/g, ' ')} · {n.channel} → {n.recipient} ({n.audience})
                    </span>
                    <span className={styles.meta}>
                      {n.status} via {n.provider} · {formatMoment(n.createdAt)}
                      {n.error ? ` · ${n.error}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.small}>None sent yet.</p>
            )}
          </section>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className={styles.panel} aria-labelledby="status-title">
            <h2 id="status-title">Status</h2>
            <p>
              <strong>{STATUS_META[booking.status].label}</strong> — {STATUS_META[booking.status].meaning}. Client sees “{STATUS_META[booking.status].client}”.
            </p>
            {booking.holdExpiresAt && booking.status === 'ON_HOLD' && <p className={styles.small}>Hold expires {formatMoment(booking.holdExpiresAt)}.</p>}
            {!readOnly && moves.length > 0 && (
              <ActionForm action={changeStatusAction.bind(null, id)} submit="Update status" className={styles.panel} variant="outline">
                <Select name="status" label="Move to" options={moves.map((s) => ({ key: s, label: STATUS_META[s].label }))} />
                <TextField name="note" label="Note for the audit trail" optional />
              </ActionForm>
            )}
            {!readOnly && !closed && (
              <ActionForm action={holdDateAction.bind(null, id)} submit="Hold the date" variant="outline">
                <TextField name="days" label="Hold for (days)" type="number" min={1} max={60} defaultValue={7} />
              </ActionForm>
            )}
            {!readOnly && booking.status === 'AWAITING_DEPOSIT' && (
              <ActionForm action={confirmBookingAction.bind(null, id)} submit="Confirm booking" className={styles.panel}>
                <p className={styles.small}>
                  Agreement {signed ? 'signed ✓' : 'not signed ✗'} · Deposit {depositPaid ? 'received ✓' : 'not received ✗'}
                </p>
                {admin.role === 'owner' && (!signed || !depositPaid) && (
                  <>
                    <Checkbox name="override" label="Override (owner only) — confirm without the missing items" />
                    <TextField name="reason" label="Reason" optional />
                  </>
                )}
              </ActionForm>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="client-title">
            <h2 id="client-title">Client booking page</h2>
            <p className={styles.small}>Private link — emailed automatically. Share only with the client.</p>
            <code style={{ fontSize: 12, overflowWrap: 'anywhere', color: 'var(--bone)' }}>{portalUrl(id)}</code>
          </section>

          <section className={styles.panel} aria-labelledby="notes-title">
            <h2 id="notes-title">Internal notes</h2>
            {!readOnly && (
              <ActionForm action={addNoteAction.bind(null, id)} submit="Add note" variant="outline" className={styles.panel} resetOnSuccess>
                <TextArea name="body" label="Note" rows={3} />
              </ActionForm>
            )}
            <ul role="list" className={styles.feed}>
              {notes.map((n) => (
                <li key={n.id}>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{n.body}</span>
                  <span className={styles.meta}>
                    {n.authorName} · {formatMoment(n.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel} aria-labelledby="audit-title">
            <h2 id="audit-title">Audit trail</h2>
            <ul role="list" className={styles.feed}>
              {audit.map((a) => (
                <li key={a.id}>
                  <span>
                    {a.action.replace(/_/g, ' ')}
                    {typeof a.detail.from === 'string' && typeof a.detail.to === 'string' ? `: ${a.detail.from} → ${a.detail.to}` : ''}
                  </span>
                  <span className={styles.meta}>
                    {a.actor} · {formatMoment(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.small}>Event date {formatDay(event.date)} · reference {booking.reference}</p>
          </section>
        </div>
      </div>
    </>
  );
}
