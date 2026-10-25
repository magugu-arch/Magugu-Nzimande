import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { getDevice, resetSandbox, setDevice, settle, sys, track } from '../app.ts';
import { push, switchTab } from '../nav.ts';
import { Banner, Button, Disclosure, Field, IconButton, NavBar, Row, SectionHead, Toggle, errorMessage, toast } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { STATUS_LABEL, ago, branch, idempotencyKey, pct, statusTone } from '../format.ts';
import { FUNNELS, computeKpis } from '../../domain/analytics.ts';
import { reconciliationReport, settlementCsv } from '../../domain/payments/reconciliation.ts';
import { PAYMENT_STATUS_LABEL } from '../../domain/payments/stateMachine.ts';
import { ROLE_LABELS, can } from '../../domain/roles.ts';
import type { Permission } from '../../domain/roles.ts';
import { CAMPAIGN_TEMPLATES, TEMPLATES } from '../../domain/notifications/templates.ts';
import { UTM_STANDARDS, buildTrackedQuery, recordTouch } from '../../domain/marketing/attribution.ts';
import { DAY, HOUR, formatZar, maskEmail, maskName } from '../../domain/util/core.ts';
import { dateKeyAt, formatDateLong, timeKeyAt } from '../../domain/util/time.ts';
import { effectivePolicy } from '../../domain/content.ts';
import type { Actor, Booking, BookingStatus, Campaign, Channel, SandboxScenario, StaffRole } from '../../domain/types.ts';
import { saveFile } from '../share.ts';
import { PROVIDER_CHECKLIST } from '../checklist.ts';

type Section = 'overview' | 'bookings' | 'payments' | 'messages' | 'campaigns' | 'cafes' | 'sandbox';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'payments', label: 'Payments' },
  { id: 'messages', label: 'Messages' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'cafes', label: 'Café settings' },
  { id: 'sandbox', label: 'Sandbox' },
];

function actor(): Actor {
  const role = getDevice().role;
  return { kind: 'staff', id: `staff-${role}`, role };
}

function needs(perm: Permission): string {
  const roles = (Object.keys(ROLE_LABELS) as StaffRole[]).filter((r) => can({ kind: 'staff', id: 'x', role: r }, perm));
  return `Needs ${roles.map((r) => ROLE_LABELS[r]).join(' or ')}`;
}

function Guarded({ perm, amount, children }: { perm: Permission; amount?: number; children: (allowed: boolean) => ComponentChildren }) {
  const allowed = can(actor(), perm, amount);
  return (
    <span class="stack-sm" style={{ display: 'inline-grid' }}>
      {children(allowed)}
      {!allowed ? <span class="role-note">{needs(perm)}</span> : null}
    </span>
  );
}

const when = (t: number) => `${formatDateLong(dateKeyAt(t, 120))} ${timeKeyAt(t, 120)}`;

export function OpsScreen() {
  const [section, setSection] = useState<Section>('overview');
  const role = getDevice().role;
  return (
    <>
      <NavBar
        title="Operations"
        leading={
          <span class="mobile-only">
            <IconButton icon="back" label="Back to profile" onClick={() => switchTab('profile')} />
          </span>
        }
        trailing={
          <label class="row" style={{ gap: '6px' }}>
            <span class="vh">Signed in as</span>
            <select class="select" style={{ minHeight: '36px', padding: '4px 10px', width: 'auto', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600 }} value={role} onChange={(e) => setDevice({ role: (e.target as HTMLSelectElement).value as StaffRole })}>
              {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div class="page-body tight">
        <p class="footnote">
          Staff view of the sandbox, acting as <strong>{ROLE_LABELS[role]}</strong>. Every action is checked against this role on the server side and written to the audit log. Guest details are masked unless you are an administrator.
        </p>
        <div class="hscroll ops-tabs" role="tablist" aria-label="Operations sections" style={{ background: 'var(--paper)', paddingTop: '4px', paddingBottom: '8px' }}>
          {SECTIONS.map((s) => (
            <button type="button" key={s.id} class="chip" role="tab" aria-selected={section === s.id} aria-pressed={section === s.id ? 'true' : 'false'} onClick={() => setSection(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        {section === 'overview' ? <Overview /> : null}
        {section === 'bookings' ? <BookingsOps /> : null}
        {section === 'payments' ? <PaymentsOps /> : null}
        {section === 'messages' ? <MessagesOps /> : null}
        {section === 'campaigns' ? <CampaignsOps /> : null}
        {section === 'cafes' ? <CafeSettings /> : null}
        {section === 'sandbox' ? <SandboxOps /> : null}
      </div>
    </>
  );
}

function guestLabel(guestId: string | null): string {
  if (!guestId) return '–';
  const g = sys.db.get('guests', guestId);
  if (!g) return '–';
  if (can(actor(), 'guest.view-unmasked')) return `${g.name}${g.email ? ` · ${g.email}` : ''}`;
  return `${maskName(g.name)}${g.email ? ` · ${maskEmail(g.email)}` : ''}`;
}

// ------------------------------------------------------------ overview

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div class="kpi">
      <span class="caption">{label}</span>
      <span class="v">{value}</span>
      <span class="footnote">{sub}</span>
    </div>
  );
}

function Overview() {
  const [excludeDemo, setExcludeDemo] = useState(false);
  const k = computeKpis(sys.ctx, excludeDemo);
  const alerts = sys.db.where('alerts', (a) => a.resolvedAt === null).sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1) || b.at - a.at);
  return (
    <>
      <section class="section">
        <SectionHead title="Needs attention" />
        {alerts.length === 0 ? (
          <Banner tone="good">
            <p>No open alerts. Payments, bookings and messages reconcile.</p>
          </Banner>
        ) : (
          <div class="stack">
            {alerts.map((a) => (
              <div class="card stack" key={a.id}>
                <div class="row between">
                  <span class={`tag ${a.severity === 'critical' ? 'bad' : 'warn'}`}>{a.severity}</span>
                  <span class="footnote">{ago(a.at)}</span>
                </div>
                <p class="title-3">{a.title}</p>
                <p class="footnote">{a.body}</p>
                {a.entityType === 'attempt' ? <ReconcileActions attemptId={a.entityId} /> : null}
                {a.entityType === 'outbox' ? (
                  <Button small icon="refresh" onClick={() => { sys.outbox.replay(a.entityId); sys.db.update('alerts', a.id, { resolvedAt: sys.ctx.clock.now(), resolvedBy: actor().id }); void settle(); toast('Event re-queued'); }}>
                    Replay event
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      <section class="section">
        <SectionHead
          title="Measures"
          eyebrow="Observed in this sandbox"
          action={
            <label class="row" style={{ gap: '8px' }}>
              <span class="footnote">Exclude demo guests</span>
              <Toggle label="Exclude demo guests" checked={excludeDemo} onChange={setExcludeDemo} />
            </label>
          }
        />
        <div class="kpis">
          <Kpi label="Booking conversion" value={pct(k.bookingConversion.value)} sub={`${k.bookingConversion.confirmed} confirmed of ${k.bookingConversion.qualifiedStarts} that chose a time`} />
          <Kpi label="Payment success" value={pct(k.paymentSuccess.value)} sub={`${k.paymentSuccess.succeeded} verified of ${k.paymentSuccess.initiated} started`} />
          <Kpi label="Abandonment" value={pct(k.abandonment.value)} sub={`${k.abandonment.abandoned} of ${k.abandonment.attempts} attempts, after 30 min`} />
          <Kpi label="Open reconciliation" value={String(k.reconciliation.open)} sub={`${formatZar(k.reconciliation.valueMinor)} held without a table`} />
          <Kpi label="Cancellations" value={pct(k.cancellationRate)} sub="of bookings" />
          <Kpi label="No-shows" value={pct(k.noShowRate)} sub="of visits due" />
          <Kpi label="Messages delivered" value={String(k.notificationHealth.delivered)} sub={`${k.notificationHealth.failed + k.notificationHealth.bounced} failed · ${k.notificationHealth.retrying} retrying · ${k.notificationHealth.blocked} blocked by rules`} />
          <Kpi label="Opt-out rate" value={pct(k.optOutRate.value)} sub={`${k.optOutRate.withdrawals} withdrawals of ${k.optOutRate.consented} consents`} />
          <Kpi label="Repeat guests" value={pct(k.repeatGuestRate.value)} sub={`${k.repeatGuestRate.repeat} of ${k.repeatGuestRate.visited} with 2+ visits in a year`} />
        </div>
        <p class="footnote">Revenue is not shown: attribution rules and windows have to be agreed with Tashas before any revenue is credited to the app.</p>
      </section>
      <section class="section">
        <SectionHead title="Funnels" eyebrow="Sessions on this device" />
        <div class="grid-cards">
          {FUNNELS.map((f) => {
            const steps = sys.analytics.funnel(f.steps);
            const top = Math.max(1, steps[0]?.sessions ?? 1);
            return (
              <div class="card stack" key={f.id}>
                <p class="title-3">{f.label}</p>
                {steps.map((s) => (
                  <div class="stack-sm" key={s.step}>
                    <div class="row between">
                      <span class="footnote">{s.step.replace(/_/g, ' ')}</span>
                      <span class="footnote num">{s.sessions}</span>
                    </div>
                    <div class="bar"><span style={{ width: `${(s.sessions / top) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
      <section class="section">
        <SectionHead title="By source and café" />
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Source / medium · campaign</th><th class="r">Chose a time</th><th class="r">Confirmed</th></tr>
            </thead>
            <tbody>
              {k.bySource.length ? k.bySource.map((s) => (
                <tr key={s.source}><td>{s.source}</td><td class="r">{s.starts}</td><td class="r">{s.confirmed}</td></tr>
              )) : <tr><td colSpan={3}>No booking attempts yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Café</th><th class="r">Booked</th><th class="r">Visited</th><th class="r">Cancelled</th><th class="r">No-show</th></tr>
            </thead>
            <tbody>
              {k.byBranch.map((b) => (
                <tr key={b.branchId}><td>{branch(b.branchId).suburb}</td><td class="r">{b.confirmed}</td><td class="r">{b.completed}</td><td class="r">{b.cancelled}</td><td class="r">{b.noShow}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ReconcileActions({ attemptId }: { attemptId: string }) {
  const [busy, setBusy] = useState(false);
  const a = sys.db.get('bookingAttempts', attemptId);
  if (!a || a.state !== 'reconciliation') return null;
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      await settle();
      toast(done);
    } catch (err) {
      toast(errorMessage(err), 'alert');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Guarded perm="booking.reconcile">
      {(ok) => (
        <div class="row wrap">
          <Button small variant="primary" disabled={!ok} busy={busy} onClick={() => run(() => sys.bookings.retryReconciliation(attemptId, actor()), 'Reservation retried')}>
            Retry the reservation
          </Button>
          <Button small variant="danger" disabled={!ok} busy={busy} onClick={() => run(() => sys.bookings.refundReconciliation(attemptId, actor()), 'Refund issued')}>
            Refund in full
          </Button>
        </div>
      )}
    </Guarded>
  );
}

// ------------------------------------------------------------ bookings

function BookingsOps() {
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [cafe, setCafe] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const allowed = can(actor(), 'booking.view-all');
  const bookings = sys.db
    .where('bookings', (b) => (status === 'all' || b.status === status) && (cafe === 'all' || b.branchId === cafe))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 60);
  const recon = sys.db.where('bookingAttempts', (a) => a.state === 'reconciliation' || a.state === 'requested');
  if (!allowed) return <Banner tone="neutral" icon="lock"><p>{needs('booking.view-all')} to see bookings.</p></Banner>;
  return (
    <>
      {recon.length ? (
        <section class="section">
          <SectionHead title="In progress or stuck" />
          {recon.map((a) => (
            <div class="card stack" key={a.id}>
              <div class="row between">
                <span class={`tag ${a.state === 'reconciliation' ? 'bad' : 'warn'}`}>{a.state}</span>
                <span class="mono footnote">{a.id}</span>
              </div>
              <p class="callout">
                {branch(a.branchId).suburb} · {a.selectedSlot ? `${formatDateLong(a.selectedSlot.date)} ${a.selectedSlot.time}` : ''} · {guestLabel(a.guestId)} · {a.failureReason ?? ''}
              </p>
              <ReconcileActions attemptId={a.id} />
            </div>
          ))}
        </section>
      ) : null}
      <div class="row wrap">
        <select class="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value as BookingStatus | 'all')} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select class="select" style={{ width: 'auto' }} value={cafe} onChange={(e) => setCafe((e.target as HTMLSelectElement).value)} aria-label="Filter by café">
          <option value="all">All cafés</option>
          {sys.ctx.content.branches.map((b) => (
            <option key={b.id} value={b.id}>{b.suburb}</option>
          ))}
        </select>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr><th>Reference</th><th>Guest</th><th>Café</th><th>When</th><th class="r">Guests</th><th class="r">Deposit</th><th>Status</th></tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} style={{ cursor: 'pointer', background: selected === b.id ? 'var(--sage-soft)' : undefined }} onClick={() => setSelected(selected === b.id ? null : b.id)}>
                <td class="mono">{b.reference}</td>
                <td>{guestLabel(b.guestId)}</td>
                <td>{branch(b.branchId).suburb}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{b.date} {b.time}</td>
                <td class="r">{b.partySize}</td>
                <td class="r">{b.depositPaidMinor ? formatZar(b.depositPaidMinor) : '–'}</td>
                <td><span class={`tag ${statusTone(b.status)}`}>{STATUS_LABEL[b.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? <BookingOpsDetail b={sys.bookings.booking(selected)} /> : <p class="footnote">Select a booking for its audit trail and staff actions.</p>}
    </>
  );
}

function BookingOpsDetail({ b }: { b: Booking }) {
  const [busy, setBusy] = useState(false);
  const active = b.status === 'confirmed' || b.status === 'amended';
  const audit = sys.db.where('audit', (a) => a.entityId === b.id || (b.attemptId !== null && a.entityId === b.attemptId) || b.paymentIds.includes(a.entityId)).sort((x, y) => x.at - y.at);
  const events = sys.db.where('bookingEvents', (e) => e.bookingId === b.id);
  const outcome = (o: 'seated' | 'completed' | 'no-show') => {
    try {
      sys.bookings.staffMarkOutcome(b.id, o, actor());
      toast(`Sent to the reservation provider; the change applies when its signed webhook arrives`, 'clock');
      window.setTimeout(() => void settle(), 600);
    } catch (err) {
      toast(errorMessage(err), 'alert');
    }
  };
  return (
    <div class="card stack">
      <div class="row between">
        <p class="title-3">{b.reference}</p>
        <span class={`tag ${statusTone(b.status)}`}>{STATUS_LABEL[b.status]}</span>
      </div>
      <p class="footnote">Provider record {b.externalId} · policy {b.policyVersion} · version {b.version}</p>
      {active ? (
        <Guarded perm="booking.mark-outcome">
          {(ok) => (
            <div class="row wrap">
              <Button small disabled={!ok} onClick={() => outcome('seated')}>Seated</Button>
              <Button small variant="primary" disabled={!ok} onClick={() => outcome('completed')}>Visit completed</Button>
              <Button small variant="danger" disabled={!ok} onClick={() => outcome('no-show')}>No-show</Button>
              <Button
                small
                disabled={!ok}
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await sys.bookings.cancel(b.id, { actor: actor(), reason: 'cancelled-by-staff', idempotencyKey: idempotencyKey('staff-cancel') });
                    await settle();
                    toast(`Cancelled${r.refundMinor ? `; ${formatZar(r.refundMinor)} refunded` : ''}`);
                  } catch (err) {
                    toast(errorMessage(err), 'alert');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel with full refund
              </Button>
            </div>
          )}
        </Guarded>
      ) : null}
      <p class="footnote">In production, seat / complete / no-show are recorded in the reservation provider and reach Tashas only as signed webhooks; these buttons stand in for that tool.</p>
      <Disclosure summary={`Provider webhooks (${events.length})`}>
        {events.map((e) => (
          <p class="footnote mono" key={e.id}>
            {when(e.receivedAt)} · {e.eventType} · signature {e.signatureVerified ? 'verified' : 'failed'} · {e.outcome}
          </p>
        ))}
      </Disclosure>
      <Disclosure summary={`Audit trail (${audit.length})`} open>
        {audit.map((a) => (
          <p class="footnote" key={a.id}>
            {when(a.at)} · {a.actor.role ?? a.actor.kind} · {a.action}
            {Object.keys(a.details).length ? ` · ${Object.entries(a.details).map(([k, v]) => `${k}: ${String(v)}`).join(', ')}` : ''}
          </p>
        ))}
      </Disclosure>
    </div>
  );
}

// ------------------------------------------------------------ payments

function PaymentsOps() {
  const [selected, setSelected] = useState<string | null>(null);
  if (!can(actor(), 'payment.view')) return <Banner tone="neutral" icon="lock"><p>{needs('payment.view')} to see payments.</p></Banner>;
  const payments = sys.db.all('payments').sort((a, b) => b.createdAt - a.createdAt).slice(0, 60);
  const report = reconciliationReport(sys.ctx);
  const webhooks = [
    ...sys.db.all('paymentEvents').map((e) => ({ id: e.id, at: e.receivedAt, kind: 'payment', type: e.eventType, verified: e.signatureVerified, outcome: e.outcome })),
    ...sys.db.all('bookingEvents').map((e) => ({ id: e.id, at: e.receivedAt, kind: 'reservation', type: e.eventType, verified: e.signatureVerified, outcome: e.outcome })),
  ].sort((a, b) => b.at - a.at).slice(0, 30);
  return (
    <>
      <section class="section">
        <SectionHead
          title="Reconciliation"
          action={
            <Button small icon="download" onClick={async () => toast((await saveFile(`tashas-settlement-${dateKeyAt(sys.ctx.clock.now(), 120)}.csv`, settlementCsv(sys.ctx), 'text/csv')).message, 'download')}>
              Settlement CSV
            </Button>
          }
        />
        {report.length === 0 ? (
          <Banner tone="good"><p>Every payment matches its booking or refund.</p></Banner>
        ) : (
          <div class="stack">
            {report.map((m) => (
              <div class="card stack" key={m.id}>
                <div class="row between">
                  <span class={`tag ${m.severity === 'critical' ? 'bad' : 'warn'}`}>{m.kind.replace(/-/g, ' ')}</span>
                  <span class="num footnote">{formatZar(m.amountMinor)}</span>
                </div>
                <p class="callout">{m.summary}</p>
                {m.entityType === 'attempt' ? <ReconcileActions attemptId={m.entityId} /> : null}
              </div>
            ))}
          </div>
        )}
      </section>
      <section class="section">
        <SectionHead title="Payments" />
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Payment</th><th>Purpose</th><th>Guest</th><th class="r">Amount</th><th class="r">Refunded</th><th>Status</th><th>Created</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer', background: selected === p.id ? 'var(--sage-soft)' : undefined }} onClick={() => setSelected(selected === p.id ? null : p.id)}>
                  <td class="mono">{p.gatewayReference ?? p.id}</td>
                  <td>{p.purpose}</td>
                  <td>{guestLabel(p.guestId)}</td>
                  <td class="r">{formatZar(p.amountMinor)}</td>
                  <td class="r">{p.refundedMinor ? formatZar(p.refundedMinor) : '–'}</td>
                  <td><span class={`tag ${p.status === 'succeeded' ? 'good' : p.status === 'failed' || p.status === 'cancelled' ? 'bad' : 'warn'}`}>{PAYMENT_STATUS_LABEL[p.status]}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{ago(p.createdAt)}</td>
                </tr>
              ))}
              {payments.length === 0 ? <tr><td colSpan={7}>No payments yet. Book a table with a deposit to create one.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {selected ? <RefundPanel paymentId={selected} /> : <p class="footnote">Select a payment to see its history or issue a refund.</p>}
      </section>
      <section class="section">
        <SectionHead title="Webhook log" />
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Received</th><th>From</th><th>Event</th><th>Signature</th><th>Outcome</th></tr></thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{ago(w.at)}</td>
                  <td>{w.kind}</td>
                  <td class="mono">{w.type}</td>
                  <td>{w.verified ? <span class="tag good">verified</span> : <span class="tag bad">rejected</span>}</td>
                  <td>{w.outcome}</td>
                </tr>
              ))}
              {webhooks.length === 0 ? <tr><td colSpan={5}>No webhooks received yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RefundPanel({ paymentId }: { paymentId: string }) {
  const p = sys.payments.get(paymentId);
  const refundable = sys.payments.refundable(p);
  const [amount, setAmount] = useState(String(refundable / 100));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minor = Math.round(Number(amount.replace(',', '.')) * 100);
  const refunds = sys.db.where('refunds', (r) => r.paymentId === paymentId);
  return (
    <div class="card stack">
      <p class="title-3">{p.description}</p>
      <p class="footnote mono">{p.id} · gateway {p.gatewayReference} · {p.provider}</p>
      <Disclosure summary={`Status history (${p.history.length})`}>
        {p.history.map((h, i) => (
          <p class="footnote" key={i}>{when(h.at)} · {PAYMENT_STATUS_LABEL[h.status]} · via {h.source}</p>
        ))}
      </Disclosure>
      {refunds.length ? (
        <div class="stack-sm">
          {refunds.map((r) => (
            <p class="footnote" key={r.id}>Refund {formatZar(r.amountMinor)} · {r.status} · {r.reason} · approved by {r.approvedBy}</p>
          ))}
        </div>
      ) : null}
      {refundable > 0 ? (
        <Guarded perm="payment.refund" amount={minor}>
          {(ok) => (
            <form
              class="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                try {
                  await sys.payments.refund({ paymentId, amountMinor: minor, reason, actor: actor(), idempotencyKey: idempotencyKey('refund') });
                  await settle();
                  toast(`Refund of ${formatZar(minor)} sent to the gateway`);
                  setReason('');
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div class="grid-2">
                <Field id="rf-amount" label={`Amount (up to ${formatZar(refundable)})`}>
                  <input id="rf-amount" class="input" inputMode="decimal" value={amount} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
                </Field>
                <Field id="rf-reason" label="Reason">
                  <input id="rf-reason" class="input" value={reason} placeholder="Required" onInput={(e) => setReason((e.target as HTMLInputElement).value)} />
                </Field>
              </div>
              {error ? <span class="field-error">{error}</span> : null}
              <Button type="submit" variant="danger" small disabled={!ok || !reason.trim() || !(minor > 0)} busy={busy}>
                Refund {Number.isFinite(minor) && minor > 0 ? formatZar(minor) : ''}
              </Button>
            </form>
          )}
        </Guarded>
      ) : (
        <p class="footnote">Nothing left to refund on this payment.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------ messages

function MessagesOps() {
  if (!can(actor(), 'notifications.view')) return <Banner tone="neutral" icon="lock"><p>{needs('notifications.view')} to see message delivery.</p></Banner>;
  const deliveries = sys.db.all('notificationDeliveries').slice(-50).reverse();
  const outbox = sys.db.all('outbox');
  const dead = outbox.filter((o) => o.status === 'dead-letter');
  return (
    <>
      <section class="section">
        <SectionHead title="Channels" />
        <div class="group">
          {(Object.values(sys.notifications.adapters)).map((a) => (
            <Row key={a.channel} icon={a.channel === 'email' ? 'mail' : a.channel === 'in-app' ? 'bell' : 'chat'} title={a.label} meta={<span class={`tag ${a.configured ? (a.isSandbox ? 'warn' : 'good') : 'bad'}`}>{a.configured ? (a.isSandbox ? 'sandbox' : 'live') : 'off'}</span>} chevron={false} />
          ))}
        </div>
      </section>
      <section class="section">
        <SectionHead title="Event queue" />
        <div class="kpis">
          <Kpi label="Waiting" value={String(outbox.filter((o) => o.status === 'pending').length)} sub="events not yet handled" />
          <Kpi label="Handled" value={String(outbox.filter((o) => o.status === 'published').length)} sub="by every consumer" />
          <Kpi label="Dead-letter" value={String(dead.length)} sub="failed 5 times, need review" />
        </div>
        {dead.map((d) => (
          <div class="card row between" key={d.id}>
            <span class="footnote mono">{d.eventType} · {d.lastError}</span>
            <Button small icon="refresh" onClick={() => { sys.outbox.replay(d.id); void settle(); }}>Replay</Button>
          </div>
        ))}
      </section>
      <section class="section">
        <SectionHead title="Deliveries" eyebrow="Latest 50" />
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Message</th><th>Kind</th><th>Guest</th><th>Channel</th><th>Status</th><th>Why</th><th class="r">Tries</th></tr></thead>
            <tbody>
              {deliveries.map((d) => {
                const n = sys.db.get('notifications', d.notificationId);
                return (
                  <tr key={d.id}>
                    <td>{n?.title}</td>
                    <td>{n?.kind === 'marketing' ? <span class="tag warn">marketing</span> : <span class="tag">service</span>}</td>
                    <td>{guestLabel(d.guestId)}</td>
                    <td>{d.channel}</td>
                    <td><span class={`tag ${d.status === 'delivered' || d.status === 'accepted' ? 'good' : d.status === 'blocked' ? '' : d.status === 'retrying' ? 'warn' : 'bad'}`}>{d.status}</span></td>
                    <td class="footnote">{d.lastError ?? ''}</td>
                    <td class="r">{d.attempts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p class="footnote">“Blocked” means a rule stopped the send: no consent, suppression, frequency cap, a channel switched off or not configured. Blocked marketing is the system working.</p>
      </section>
      <section class="section">
        <SectionHead title="Templates" eyebrow="Sample wording, needs approval" />
        <div class="stack">
          {Object.values(TEMPLATES).map((t) => {
            const r = t.render({ branch: 'Tashas Rosebank', date: 'Saturday 7 Nov', time: '09:30', party: '2 guests', reference: 'TSH-SAMPLE', amount: 'R600', points: 50, balance: 200, title: 'A coffee on us', code: 'TV-SAMPLE', expires: '7 Dec', when: 'tomorrow', event: 'Spring menu tasting', description: 'Table deposit' });
            return (
              <Disclosure key={t.id} summary={<span class="row" style={{ gap: '8px' }}><span class={`tag ${t.kind === 'marketing' ? 'warn' : ''}`}>{t.kind === 'marketing' ? 'marketing' : 'service'}</span><span>{t.id} · v{t.version}</span></span>}>
                <p class="title-3">{r.title}</p>
                <p class="callout">{r.body}</p>
                <p class="footnote">Category {t.category} · channels {t.channels.join(', ')}{t.required.length ? ` · always on ${t.required.join(', ')}` : ''}</p>
              </Disclosure>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------ campaigns

function CampaignsOps() {
  const list = sys.campaigns.list();
  return (
    <>
      <CampaignCreate />
      <section class="section">
        <SectionHead title="Campaigns" />
        <div class="stack">
          {list.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      </section>
      <TrackedLinks />
    </>
  );
}

const STATUS_TONE: Record<Campaign['status'], string> = {
  draft: '',
  'pending-approval': 'warn',
  approved: 'good',
  scheduled: 'good',
  sending: 'good',
  sent: 'ink',
  paused: 'warn',
  cancelled: 'bad',
};

function CampaignCard({ c }: { c: Campaign }) {
  const [preview, setPreview] = useState<ReturnType<typeof sys.campaigns.preview> | null>(null);
  const [test, setTest] = useState<{ title: string; body: string } | null>(null);
  const stats = c.status === 'sent' ? sys.campaigns.stats(c.id) : null;
  const act = async (fn: () => unknown, msg: string) => {
    try {
      fn();
      await settle();
      toast(msg);
      track('campaign_admin', { action: msg });
    } catch (err) {
      toast(errorMessage(err), 'alert');
    }
  };
  const a = actor();
  const audience = [
    c.audience.branchIds.length ? c.audience.branchIds.map((b) => branch(b).suburb).join(', ') : 'All cafés',
    c.audience.minCompletedVisits ? `${c.audience.minCompletedVisits}+ visits` : null,
    c.audience.inactiveForDays ? `no visit in ${c.audience.inactiveForDays} days` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div class="card stack">
      <div class="row between">
        <span class={`tag ${STATUS_TONE[c.status]}`}>{c.status.replace('-', ' ')}</span>
        <span class="footnote">{c.channel} · cap {c.frequencyCapPerWeek}/week</span>
      </div>
      <p class="title-3">{c.name}</p>
      <p class="footnote">{audience} · template {c.templateId} · landing /{c.landingSlug} · utm {c.utm.source}/{c.utm.medium}/{c.utm.campaign}</p>
      <div class="row wrap">
        <Button small icon="users" onClick={() => setPreview(sys.campaigns.preview(c.id))}>Preview audience</Button>
        {c.status === 'draft' ? (
          <Guarded perm="campaign.create">{(ok) => <Button small disabled={!ok} onClick={() => act(() => sys.campaigns.submitForApproval(c.id, a), 'Sent for approval')}>Send for approval</Button>}</Guarded>
        ) : null}
        {c.status === 'draft' || c.status === 'pending-approval' ? (
          <Guarded perm="campaign.create">{(ok) => <Button small disabled={!ok} onClick={() => setTest(sys.campaigns.testSend(c.id, a))}>Test send</Button>}</Guarded>
        ) : null}
        {c.status === 'pending-approval' ? (
          <Guarded perm="campaign.approve">
            {(ok) => (
              <span class="row wrap">
                <Button small variant="primary" disabled={!ok} onClick={() => act(() => sys.campaigns.approve(c.id, a), 'Campaign approved')}>Approve</Button>
                <Button small disabled={!ok} onClick={() => act(() => sys.campaigns.reject(c.id, a), 'Returned to draft')}>Return to draft</Button>
              </span>
            )}
          </Guarded>
        ) : null}
        {c.status === 'approved' || c.status === 'paused' ? (
          <Guarded perm="campaign.send">
            {(ok) => (
              <span class="row wrap">
                <Button small disabled={!ok} onClick={() => act(() => sys.campaigns.schedule(c.id, sys.ctx.clock.now() + HOUR, a), 'Scheduled for an hour from now')}>Schedule +1 h</Button>
                {c.status === 'approved' ? <Button small variant="primary" disabled={!ok} onClick={() => act(() => sys.campaigns.sendNow(c.id, a), 'Campaign sent; every message is re-checked at send time')}>Send now</Button> : null}
              </span>
            )}
          </Guarded>
        ) : null}
        {c.status === 'scheduled' ? (
          <Guarded perm="campaign.send">{(ok) => <Button small disabled={!ok} onClick={() => act(() => sys.campaigns.pause(c.id, a), 'Paused')}>Pause</Button>}</Guarded>
        ) : null}
        {['draft', 'pending-approval', 'approved', 'scheduled', 'paused'].includes(c.status) ? (
          <Guarded perm="campaign.send">{(ok) => <Button small variant="danger" disabled={!ok} onClick={() => act(() => sys.campaigns.cancel(c.id, a), 'Cancelled')}>Cancel</Button>}</Guarded>
        ) : null}
      </div>
      {c.status === 'scheduled' && c.scheduledAt ? <p class="footnote">Sends {when(c.scheduledAt)}. Move the sandbox clock forward to send it.</p> : null}
      {preview ? (
        <div class="card flat stack">
          <p class="callout" style={{ color: 'var(--ink)' }}>
            {preview.eligible} of {preview.targeted} in the audience can receive this now{preview.deferred ? ` (${preview.deferred} after quiet hours)` : ''}.
          </p>
          {Object.entries(preview.excluded).map(([reason, n]) => (
            <div class="row between" key={reason}>
              <span class="footnote">Excluded: {reason.replace(/[-:]/g, ' ')}</span>
              <span class="footnote num">{n}</span>
            </div>
          ))}
          <p class="footnote">Sample recipients (masked): {preview.sample.join(', ') || 'none'}</p>
        </div>
      ) : null}
      {test ? (
        <div class="card flat stack">
          <span class="caption">Test message (recorded, not sent to guests)</span>
          <p class="title-3">{test.title}</p>
          <p class="callout">{test.body}</p>
        </div>
      ) : null}
      {stats ? (
        <div class="kpis">
          <Kpi label="Targeted" value={String(stats.targeted)} sub="matched the audience" />
          <Kpi label="Sent" value={String(stats.sent)} sub={`${stats.delivered} confirmed delivered`} />
          <Kpi label="Blocked at send" value={String(stats.blockedAtSend)} sub={Object.entries(stats.excluded).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'} />
          <Kpi label="Opt-outs" value={String(stats.optOuts)} sub="after this send" />
          <Kpi label="Bookings" value={String(stats.attributedBookings)} sub={`within ${c.attributionWindowDays} days of a visit`} />
        </div>
      ) : null}
      <Disclosure summary={`History (${c.history.length})`}>
        {c.history.map((h, i) => (
          <p class="footnote" key={i}>{when(h.at)} · {h.actor} · {h.action}</p>
        ))}
      </Disclosure>
    </div>
  );
}

function CampaignCreate() {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(CAMPAIGN_TEMPLATES[0]!.id);
  const [channel, setChannel] = useState<Channel>('email');
  const [cafes, setCafes] = useState<string[]>([]);
  const [minVisits, setMinVisits] = useState('1');
  const [inactive, setInactive] = useState('');
  const [landing, setLanding] = useState(sys.ctx.content.campaignPages[0]!.slug);
  const [error, setError] = useState<string | null>(null);
  const allowed = can(actor(), 'campaign.create');
  return (
    <Disclosure summary="New campaign">
      {!allowed ? <p class="role-note">{needs('campaign.create')}</p> : null}
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          try {
            const std = UTM_STANDARDS.find((u) => u.medium === (channel === 'email' ? 'email' : channel === 'push' ? 'push' : 'in-app'))!;
            sys.campaigns.create(
              {
                name,
                channel,
                templateId,
                landingSlug: landing,
                audience: {
                  branchIds: cafes,
                  ...(Number(minVisits) > 0 ? { minCompletedVisits: Number(minVisits) } : {}),
                  ...(Number(inactive) > 0 ? { inactiveForDays: Number(inactive) } : {}),
                },
                utm: { source: std.source, medium: std.medium, campaign: landing },
              },
              actor(),
            );
            toast('Draft created');
            setName('');
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <Field id="cp-name" label="Name">
          <input id="cp-name" class="input" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="For example: Spring tasting · Rosebank regulars" />
        </Field>
        <div class="grid-2">
          <Field id="cp-template" label="Message">
            <select id="cp-template" class="select" value={templateId} onChange={(e) => setTemplateId((e.target as HTMLSelectElement).value)}>
              {CAMPAIGN_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.render({}).title}</option>
              ))}
            </select>
          </Field>
          <Field id="cp-channel" label="Channel">
            <select id="cp-channel" class="select" value={channel} onChange={(e) => setChannel((e.target as HTMLSelectElement).value as Channel)}>
              <option value="email">Email</option>
              <option value="push">Push</option>
              <option value="in-app">In-app</option>
            </select>
          </Field>
        </div>
        <div class="stack">
          <span class="caption">Cafés (none = all)</span>
          <div class="row wrap" style={{ gap: '8px' }}>
            {sys.ctx.content.branches.map((b) => (
              <button type="button" key={b.id} class="chip" aria-pressed={cafes.includes(b.id) ? 'true' : 'false'} onClick={() => setCafes(cafes.includes(b.id) ? cafes.filter((x) => x !== b.id) : [...cafes, b.id])}>
                {b.suburb}
              </button>
            ))}
          </div>
        </div>
        <div class="grid-2">
          <Field id="cp-min" label="At least this many visits">
            <input id="cp-min" class="input" inputMode="numeric" value={minVisits} onInput={(e) => setMinVisits((e.target as HTMLInputElement).value)} />
          </Field>
          <Field id="cp-inactive" label="No visit for (days)">
            <input id="cp-inactive" class="input" inputMode="numeric" value={inactive} placeholder="Optional" onInput={(e) => setInactive((e.target as HTMLInputElement).value)} />
          </Field>
        </div>
        <Field id="cp-landing" label="Landing page (one clear action)">
          <select id="cp-landing" class="select" value={landing} onChange={(e) => setLanding((e.target as HTMLSelectElement).value)}>
            {sys.ctx.content.campaignPages.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title} → {p.primary.label}</option>
            ))}
          </select>
        </Field>
        <p class="footnote">Audiences use only cafés, visit history and reward tier; no sensitive traits are inferred. Consent, suppression, caps and quiet hours apply at send time.</p>
        {error ? <span class="field-error">{error}</span> : null}
        <Button type="submit" variant="primary" disabled={!allowed}>Create draft</Button>
      </form>
    </Disclosure>
  );
}

function TrackedLinks() {
  const page = sys.ctx.content.campaignPages[0]!;
  const [slug, setSlug] = useState(page.slug);
  const links = UTM_STANDARDS.map((u) => ({ ...u, query: buildTrackedQuery({ source: u.source, medium: u.medium, campaign: slug }, null, slug) }));
  return (
    <section class="section">
      <SectionHead title="Tracked links" eyebrow="UTM standards" />
      <select class="select" value={slug} onChange={(e) => setSlug((e.target as HTMLSelectElement).value)} aria-label="Landing page">
        {sys.ctx.content.campaignPages.map((p) => (
          <option key={p.slug} value={p.slug}>{p.title}</option>
        ))}
      </select>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Channel</th><th>Query string</th><th /></tr></thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.channel}>
                <td>{l.channel}</td>
                <td class="mono" style={{ fontSize: '0.75rem', overflowWrap: 'anywhere' }}>?{l.query}</td>
                <td>
                  <button
                    type="button"
                    class="link"
                    onClick={() => {
                      setDevice({ attribution: recordTouch(getDevice().attribution, { utm: { source: l.source, medium: l.medium, campaign: slug }, campaignId: null, landingSlug: slug, at: sys.ctx.clock.now() }) });
                      switchTab('today');
                      push({ name: 'campaign', slug }, 'today');
                    }}
                  >
                    Arrive as a guest
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="footnote">Links never carry names, emails or phone numbers. “Arrive as a guest” records the visit as if it came from that link, so you can follow the source through a booking.</p>
    </section>
  );
}

// ---------------------------------------------------------- café settings

function CafeSettings() {
  const [id, setId] = useState(sys.ctx.content.branches[0]!.id);
  return (
    <>
      <select class="select" value={id} onChange={(e) => setId((e.target as HTMLSelectElement).value)} aria-label="Café">
        {sys.ctx.content.branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <PolicyEditor key={id} id={id} />
      <section class="section">
        <SectionHead title="Content status" />
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Content</th><th>Status</th><th>Needed from Tashas</th></tr></thead>
            <tbody>
              <tr><td>Café details ({sys.ctx.content.branches.length})</td><td><span class="tag sample">sample</span></td><td>Addresses, phones, hours, Google Business Profile links, stories</td></tr>
              <tr><td>Menu ({sys.ctx.content.menuItems.length} dishes)</td><td><span class="tag sample">sample</span></td><td>Approved names, prices per café, verified dietary and allergen data</td></tr>
              <tr><td>Events ({sys.ctx.content.events.length})</td><td><span class="tag sample">sample</span></td><td>Dates, capacity, prices, terms</td></tr>
              <tr><td>Campaign pages ({sys.ctx.content.campaignPages.length})</td><td><span class="tag sample">sample</span></td><td>Approved copy and offer terms</td></tr>
              <tr><td>Reward rules</td><td><span class="tag sample">sample</span></td><td>Earning rules, rewards, tiers, expiry</td></tr>
              <tr><td>Images (28)</td><td><span class="tag good">supplied</span></td><td>Confirm which interiors may represent which café</td></tr>
            </tbody>
          </table>
        </div>
        <Button icon="photo" onClick={() => push({ name: 'assets' })}>Open the asset library</Button>
      </section>
    </>
  );
}

function PolicyEditor({ id }: { id: string }) {
  const policy = effectivePolicy(sys.ctx, id);
  const base = branch(id).policy;
  const allowed = can(actor(), 'branch.configure');
  const [draft, setDraft] = useState(() => toDraft(policy));
  const override = sys.db.get('branchOverrides', id);
  const save = () => {
    if (!allowed) return;
    const deposits = Number(draft.deposit) > 0 ? [{ id: 'override', label: `Parties of ${draft.minParty} or more`, perGuestMinor: Math.round(Number(draft.deposit) * 100), minPartySize: Number(draft.minParty) }] : [];
    const patch = {
      deposits,
      freeCancellationHours: Number(draft.freeHours),
      lateCancellationRefundPercent: Math.max(0, Math.min(100, Number(draft.latePct))),
      holdMinutes: Math.max(2, Number(draft.hold)),
      maxOnlinePartySize: Math.max(1, Number(draft.maxParty)),
      waitlist: draft.waitlist,
      version: `${id}-override-${dateKeyAt(sys.ctx.clock.now(), 120)}-${sys.ctx.ids.id('v').slice(-4)}`,
    };
    sys.db.upsert('branchOverrides', { id, policy: patch, updatedAt: sys.ctx.clock.now(), updatedBy: actor().id });
    sys.db.insert('audit', { id: sys.ctx.ids.id('aud'), at: sys.ctx.clock.now(), actor: actor(), action: 'branch.policy-updated', entityType: 'branch', entityId: id, details: { version: patch.version } });
    toast('Policy saved. New bookings use it straight away.');
  };
  return (
    <div class="card stack">
      <div class="row between">
        <p class="title-3">Booking policy</p>
        <span class="tag">{policy.version}</span>
      </div>
      {!allowed ? <p class="role-note">{needs('branch.configure')}</p> : null}
      <fieldset disabled={!allowed} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: '12px' }}>
        <div class="grid-2">
          <Field id="cs-dep" label="Deposit per guest (R, 0 = none)"><input id="cs-dep" class="input" inputMode="decimal" value={draft.deposit} onInput={(e) => setDraft({ ...draft, deposit: (e.target as HTMLInputElement).value })} /></Field>
          <Field id="cs-min" label="…for parties of at least"><input id="cs-min" class="input" inputMode="numeric" value={draft.minParty} onInput={(e) => setDraft({ ...draft, minParty: (e.target as HTMLInputElement).value })} /></Field>
          <Field id="cs-free" label="Free cancellation (hours before)"><input id="cs-free" class="input" inputMode="numeric" value={draft.freeHours} onInput={(e) => setDraft({ ...draft, freeHours: (e.target as HTMLInputElement).value })} /></Field>
          <Field id="cs-late" label="Late cancellation refund (%)"><input id="cs-late" class="input" inputMode="numeric" value={draft.latePct} onInput={(e) => setDraft({ ...draft, latePct: (e.target as HTMLInputElement).value })} /></Field>
          <Field id="cs-hold" label="Hold a chosen slot (minutes)"><input id="cs-hold" class="input" inputMode="numeric" value={draft.hold} onInput={(e) => setDraft({ ...draft, hold: (e.target as HTMLInputElement).value })} /></Field>
          <Field id="cs-max" label="Largest party online"><input id="cs-max" class="input" inputMode="numeric" value={draft.maxParty} onInput={(e) => setDraft({ ...draft, maxParty: (e.target as HTMLInputElement).value })} /></Field>
        </div>
        <div class="pref" style={{ padding: 0 }}>
          <span style={{ fontWeight: 560 }}>Online waitlist</span>
          <Toggle label="Online waitlist" checked={draft.waitlist} onChange={(v) => setDraft({ ...draft, waitlist: v })} disabled={!allowed} />
        </div>
      </fieldset>
      <div class="row wrap">
        <Button variant="primary" disabled={!allowed} onClick={save}>Save policy</Button>
        {override ? (
          <Button disabled={!allowed} onClick={() => { sys.db.delete('branchOverrides', id); setDraft(toDraft(base)); toast('Back to the sample policy'); }}>Revert to sample</Button>
        ) : null}
      </div>
      <p class="footnote">Bookings keep the policy version they were made under; a change applies to new bookings only. Deposits are always recalculated on the server at confirmation.</p>
    </div>
  );
}

function toDraft(p: ReturnType<typeof effectivePolicy>) {
  const d = p.deposits[0];
  return {
    deposit: d ? String(d.perGuestMinor / 100) : '0',
    minParty: d ? String(d.minPartySize) : '6',
    freeHours: String(p.freeCancellationHours),
    latePct: String(p.lateCancellationRefundPercent),
    hold: String(p.holdMinutes),
    maxParty: String(p.maxOnlinePartySize),
    waitlist: p.waitlist,
  };
}

// ------------------------------------------------------------- sandbox

function SandboxOps() {
  const settings = sys.db.require('settings', 'global');
  const s = settings.sandbox;
  const allowed = can(actor(), 'sandbox.control');
  const [url, setUrl] = useState(settings.publicAppUrl ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const offset = getDevice().clockOffsetMs;
  const set = (patch: Partial<SandboxScenario>) => sys.db.update('settings', 'global', (x) => ({ ...x, sandbox: { ...x.sandbox, ...patch } }));
  const travel = async (ms: number) => {
    setDevice({ clockOffsetMs: ms === 0 ? 0 : offset + ms });
    await settle();
    toast(ms === 0 ? 'Clock back to now' : 'Clock moved forward; reminders, expiries and scheduled sends have run');
  };
  const scenarioRow = (label: string, sub: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div class="pref">
      <span style={{ fontWeight: 560 }}>{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} disabled={!allowed} />
      <span class="footnote">{sub}</span>
    </div>
  );
  return (
    <>
      {!allowed ? <Banner tone="neutral" icon="lock"><p>{needs('sandbox.control')} to change sandbox settings. Switch role at the top.</p></Banner> : null}
      <section class="section">
        <SectionHead title="Provider behaviour" />
        <div class="group">
          <div class="pref">
            <span style={{ fontWeight: 560 }}>Next reservation request</span>
            <select class="select" style={{ width: 'auto', minHeight: '38px' }} disabled={!allowed} value={s.nextCreate} onChange={(e) => set({ nextCreate: (e.target as HTMLSelectElement).value as SandboxScenario['nextCreate'] })}>
              <option value="normal">Succeeds</option>
              <option value="timeout-after-commit">Saves, then times out</option>
              <option value="unavailable">Refused: slot gone</option>
              <option value="error">Provider error</option>
            </select>
            <span class="footnote">Applies once, then returns to normal.</span>
          </div>
          {scenarioRow('Another guest takes the held slot', 'The next confirmation finds its table gone.', s.stealHeldSlot, (v) => set({ stealHeldSlot: v }))}
          {scenarioRow('Reservation system outage', 'Availability and bookings fail; the app says so and books nothing.', s.reservationOutage, (v) => set({ reservationOutage: v }))}
          {scenarioRow('Duplicate webhooks', 'Every webhook arrives twice; deduplication keeps one.', s.duplicateWebhooks, (v) => set({ duplicateWebhooks: v }))}
          {scenarioRow('Lost payment webhooks', 'Outcomes are found through the status API after a grace period.', s.dropWebhooks, (v) => set({ dropWebhooks: v }))}
          <div class="pref">
            <span style={{ fontWeight: 560 }}>Email failures</span>
            <select class="select" style={{ width: 'auto', minHeight: '38px' }} disabled={!allowed} value={String(s.emailFailures)} onChange={(e) => set({ emailFailures: Number((e.target as HTMLSelectElement).value) })}>
              {[0, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : `Next ${n}`}</option>)}
            </select>
            <span class="footnote">Temporary failures, retried with backoff.</span>
          </div>
          {scenarioRow('Refund automatically when a paid booking fails', 'Off: staff choose to retry or refund. On: the refund is issued at once.', settings.autoRefundOnBookingFailure, (v) => sys.db.update('settings', 'global', { autoRefundOnBookingFailure: v }))}
        </div>
      </section>
      <section class="section">
        <SectionHead title="Clock" eyebrow={offset ? `Ahead by ${Math.round(offset / HOUR)} hours` : 'Real time'} />
        <div class="row wrap">
          <Button small disabled={!allowed} onClick={() => travel(HOUR)}>+1 hour</Button>
          <Button small disabled={!allowed} onClick={() => travel(DAY)}>+1 day</Button>
          <Button small disabled={!allowed} onClick={() => travel(7 * DAY)}>+1 week</Button>
          <Button small disabled={!allowed || offset === 0} onClick={() => travel(0)}>Back to now</Button>
        </div>
        <p class="footnote">Moving the clock fires booking reminders, lapses holds and points, and sends scheduled campaigns, through the same workers production runs.</p>
      </section>
      <section class="section">
        <SectionHead title="Public address" />
        <div class="card stack">
          <Field id="sb-url" label="App URL after HTTPS deployment" hint="WhatsApp and the share sheet use this link. Leave empty until the app has a stable HTTPS domain.">
            <input id="sb-url" class="input" type="url" placeholder="https://app.example.com" value={url} disabled={!allowed} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} />
          </Field>
          <Button
            small
            disabled={!allowed}
            onClick={() => {
              const v = url.trim();
              if (v && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(v)) {
                toast('Use a full https:// address', 'alert');
                return;
              }
              sys.db.update('settings', 'global', { publicAppUrl: v || null });
              toast(v ? 'Public address saved' : 'Public address cleared');
            }}
          >
            Save address
          </Button>
        </div>
      </section>
      <section class="section">
        <SectionHead title="Data" />
        <div class="row wrap">
          <Button small icon="refresh" onClick={async () => { await settle(); toast('Queues processed'); }}>Run queues now</Button>
          {!confirmReset ? (
            <Button small variant="danger" disabled={!allowed} onClick={() => setConfirmReset(true)}>Reset sandbox</Button>
          ) : (
            <span class="row wrap">
              <span class="callout">Erase everything on this device and start again?</span>
              <Button small variant="danger" onClick={async () => { await resetSandbox(); setConfirmReset(false); toast('Sandbox reset'); }}>Erase and reseed</Button>
              <Button small onClick={() => setConfirmReset(false)}>Keep</Button>
            </span>
          )}
        </div>
      </section>
      <Disclosure summary={`Before go-live: credentials and approvals (${PROVIDER_CHECKLIST.length})`}>
        {PROVIDER_CHECKLIST.map((c) => (
          <p class="callout" key={c}>
            <Icon name="check" size={14} /> {c}
          </p>
        ))}
      </Disclosure>
    </>
  );
}
