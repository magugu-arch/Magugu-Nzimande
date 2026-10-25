import { useState } from 'preact/hooks';
import { getDevice, isArtifactViewer, settle, sys } from '../app.ts';
import { openSheet, push } from '../nav.ts';
import { Banner, Button, Empty, KV, LinkButton, NavBar, Photo, Row, Segmented, SectionHead, errorMessage, toast } from '../components/ui.tsx';
import { SheetHead, useSheet } from '../components/Sheet.tsx';
import { STATUS_LABEL, ago, branch, idempotencyKey, past, plural, statusTone, upcoming, whenLabel } from '../format.ts';
import { ResultView } from './Book.tsx';
import { effectivePolicy } from '../../domain/content.ts';
import { policyLines, depositFor } from '../../domain/booking/policy.ts';
import { formatZar } from '../../domain/util/core.ts';
import { formatDateLong, dateKeyAt, timeKeyAt } from '../../domain/util/time.ts';
import { PAYMENT_STATUS_LABEL } from '../../domain/payments/stateMachine.ts';
import { googleCalendarHref, icsFile, mapsHref, saveFile } from '../share.ts';
import type { Booking } from '../../domain/types.ts';

export function BookingCard({ b, onClick }: { b: Booking; onClick: () => void }) {
  const br = branch(b.branchId);
  const tone = statusTone(b.status);
  return (
    <button type="button" class="card pressable summary-card" style={{ textAlign: 'left' }} onClick={onClick}>
      <Photo id={br.heroImageId} />
      <span class="stack-sm">
        <span class="row" style={{ gap: '8px' }}>
          <span class={`tag ${tone}`}>{STATUS_LABEL[b.status]}</span>
        </span>
        <span class="title-3">{whenLabel(b)}</span>
        <span class="footnote">{br.name} · {plural(b.partySize, 'guest')}</span>
        <span class="footnote mono">{b.reference}</span>
      </span>
    </button>
  );
}

export function BookingsList() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const list = tab === 'upcoming' ? upcoming() : past();
  return (
    <>
      <NavBar title="Bookings" back />
      <div class="page-body tight">
        <Segmented label="Bookings" value={tab} onChange={setTab} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />
        {list.length === 0 ? (
          <Empty icon="calendar" title={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings yet'}>
            <p class="footnote">Bookings you make appear here, with changes and receipts.</p>
          </Empty>
        ) : (
          <div class="stack">
            {list.map((b) => (
              <BookingCard key={b.id} b={b} onClick={() => push({ name: 'booking', id: b.id })} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Timeline({ b }: { b: Booking }) {
  const items: { at: number; text: string; icon: string }[] = [];
  items.push({ at: b.createdAt, text: b.status === 'waitlisted' ? 'Joined the waitlist' : 'Booking confirmed by the café', icon: 'check' });
  for (const pid of b.paymentIds) {
    const p = sys.payments.get(pid);
    for (const h of p.history) {
      if (h.status === 'succeeded') items.push({ at: h.at, text: `Deposit ${formatZar(p.amountMinor)} verified with the gateway`, icon: 'receipt' });
      if (h.status === 'partially-refunded' || h.status === 'refunded') items.push({ at: h.at, text: `${PAYMENT_STATUS_LABEL[h.status]} (${formatZar(p.refundedMinor)} in total)`, icon: 'refresh' });
    }
  }
  for (const a of sys.db.where('audit', (x) => x.entityId === b.id && ['booking.amended', 'booking.cancelled', 'booking.completed', 'booking.no-show'].includes(x.action))) {
    const label =
      a.action === 'booking.amended'
        ? `Changed to ${a.details.date ? formatDateLong(String(a.details.date)) : ''} ${a.details.time ?? ''}, ${a.details.partySize ?? ''} guests`
        : a.action === 'booking.cancelled'
          ? 'Cancelled'
          : a.action === 'booking.completed'
            ? 'Visit completed (from the café)'
            : 'Marked as not attended (from the café)';
    items.push({ at: a.at, text: label, icon: a.action === 'booking.cancelled' ? 'close' : 'clock' });
  }
  for (const n of sys.db.where('notifications', (x) => x.link?.id === b.id && x.status !== 'scheduled' && x.status !== 'cancelled')) {
    items.push({ at: n.scheduledAt, text: `Message: ${n.title}`, icon: 'bell' });
  }
  const scheduled = sys.db.where('notifications', (x) => x.link?.id === b.id && x.status === 'scheduled');
  items.sort((x, y) => x.at - y.at);
  return (
    <div class="group">
      {items.map((i, k) => (
        <Row key={k} icon={i.icon} title={i.text} sub={ago(i.at)} chevron={false} />
      ))}
      {scheduled.map((n) => (
        <Row key={n.id} icon="bell" title={`Reminder scheduled: ${n.title}`} sub={`${formatDateLong(dateKeyAt(n.scheduledAt, 120))} at ${timeKeyAt(n.scheduledAt, 120)}`} chevron={false} />
      ))}
    </div>
  );
}

export function BookingDetail({ id }: { id: string }) {
  if (id.startsWith('attempt:')) return <AttemptDetail id={id.slice(8)} />;
  const b = sys.db.get('bookings', id);
  if (!b) {
    return (
      <>
        <NavBar title="Booking" back large={false} />
        <div class="page-body">
          <Empty icon="calendar" title="Booking not found" />
        </div>
      </>
    );
  }
  const br = branch(b.branchId);
  const policy = effectivePolicy(sys.ctx, b.branchId);
  const active = b.status === 'confirmed' || b.status === 'amended';
  const canChange = active && sys.ctx.clock.now() < sys.bookings.amendableUntil(b.id) && sys.bookings.provider.capabilities.amend;
  const earned = sys.db.where('rewardLedger', (e) => e.referenceId === b.id && e.type === 'earn')[0];
  const calendar = { title: `Table at ${br.name}`, startsAt: b.startsAt, minutes: 90, details: `Reference ${b.reference}`, location: `${br.name}, ${br.city}` };

  return (
    <>
      <NavBar title={b.reference} back large={false} />
      <div class="page-body tight">
        <div class="card pad-0">
          <Photo id={br.heroImageId} ratio="16 / 9" rounded="0" />
          <div class="stack" style={{ padding: '18px' }}>
            <div class="row between">
              <span class={`tag ${statusTone(b.status)}`}>{STATUS_LABEL[b.status]}</span>
              <span class="mono footnote">{b.reference}</span>
            </div>
            <h1 class="title-1">{whenLabel(b)}</h1>
            <p class="callout">{br.name} · {plural(b.partySize, 'guest')}{b.occasion ? ` · ${b.occasion}` : ''}{b.seating ? ` · ${b.seating}` : ''}</p>
            {b.status === 'waitlisted' ? (
              <Banner tone="neutral" icon="clock">
                <p>You are on the waitlist. This is not a confirmed table; we will message you if one opens up.</p>
              </Banner>
            ) : null}
            {b.status === 'completed' ? (
              <Banner tone="good" icon="rewards">
                <p>Thank you for visiting.{earned ? ` You earned ${earned.points} points.` : ''}</p>
              </Banner>
            ) : null}
            {b.status === 'no-show' ? (
              <Banner tone="bad" icon="alert">
                <p>The café marked this booking as not attended.{b.depositPaidMinor > 0 && policy.noShowRetainsDeposit ? ' Under its policy the deposit is kept.' : ''} If this is wrong, contact the café.</p>
              </Banner>
            ) : null}
            <div class="row wrap">
              {canChange ? (
                <Button icon="edit" onClick={() => openSheet({ name: 'reschedule', bookingId: b.id })}>
                  Change
                </Button>
              ) : null}
              {active || b.status === 'waitlisted' ? (
                <Button variant="danger" icon="close" onClick={() => openSheet({ name: 'cancel-booking', id: b.id })}>
                  {b.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel'}
                </Button>
              ) : null}
              {active ? (
                <LinkButton icon="calendar" href={googleCalendarHref(calendar)}>
                  Calendar
                </LinkButton>
              ) : null}
              {active && !isArtifactViewer() ? (
                <Button icon="download" onClick={async () => toast((await saveFile(`tashas-${b.reference}.ics`, icsFile({ uid: b.id, ...calendar }), 'text/calendar')).message)}>
                  .ics
                </Button>
              ) : null}
              <LinkButton icon="directions" href={mapsHref(`Tashas ${br.suburb} ${br.city}`)}>
                Directions
              </LinkButton>
            </div>
            {active && !canChange ? <p class="footnote">Online changes closed {policy.amendCutoffHours} hours before the booking. Please contact the café.</p> : null}
          </div>
        </div>

        {b.depositAmountMinor > 0 || b.depositPaidMinor > 0 ? (
          <section class="section">
            <SectionHead title="Deposit" />
            <div class="card">
              <KV
                rows={[
                  ['Deposit for this table', formatZar(b.depositAmountMinor)],
                  ['Paid', formatZar(b.depositPaidMinor)],
                  ['Refunded', formatZar(b.depositRefundedMinor)],
                  ...b.paymentIds.map((pid): [string, string] => {
                    const p = sys.payments.get(pid);
                    return [`Payment ${p.gatewayReference?.slice(-6) ?? ''}`, `${PAYMENT_STATUS_LABEL[p.status]} · ${formatZar(p.amountMinor)}`];
                  }),
                ]}
              />
            </div>
          </section>
        ) : null}

        <section class="section">
          <SectionHead title="Terms" />
          <div class="card flat stack">
            {policyLines(policy, depositFor(policy, b)).map((l) => (
              <p class="footnote" key={l}>{l}</p>
            ))}
          </div>
        </section>

        <section class="section">
          <SectionHead title="History" />
          <Timeline b={b} />
        </section>
      </div>
    </>
  );
}

function AttemptDetail({ id }: { id: string }) {
  const a = sys.db.get('bookingAttempts', id);
  return (
    <>
      <NavBar title="Booking status" back large={false} />
      <div class="page-body">
        {a ? (
          a.bookingId ? (
            <Button variant="primary" onClick={() => push({ name: 'booking', id: a.bookingId! })}>
              Open the booking
            </Button>
          ) : (
            <div class="card">
              <ResultView attemptId={id} />
            </div>
          )
        ) : (
          <Empty icon="calendar" title="Nothing to show" />
        )}
      </div>
    </>
  );
}

export function CancelSheet({ id }: { id: string }) {
  const b = sys.bookings.booking(id);
  const actor = { kind: 'guest' as const, id: getDevice().guestId };
  const quote = sys.bookings.cancellationQuote(id, actor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => idempotencyKey('cancel'));
  const { close } = useSheet();
  const paid = b.depositPaidMinor - b.depositRefundedMinor;
  return (
    <>
      <SheetHead title={b.status === 'waitlisted' ? 'Leave the waitlist?' : 'Cancel this booking?'} sub={`${branch(b.branchId).name} · ${whenLabel(b)}`} />
      <div class="sheet-body">
        {paid > 0 ? (
          quote.refundMinor === paid ? (
            <Banner tone="good" icon="refresh">
              <p class="title-3">You will get {formatZar(quote.refundMinor)} back</p>
              <p class="callout">You are cancelling inside the free cancellation window. Refunds go back to the card you paid with.</p>
            </Banner>
          ) : quote.refundMinor > 0 ? (
            <Banner tone="warn" icon="refresh">
              <p class="title-3">You will get {formatZar(quote.refundMinor)} of {formatZar(paid)} back</p>
              <p class="callout">The free cancellation window has passed, so the café’s late-cancellation terms apply.</p>
            </Banner>
          ) : (
            <Banner tone="bad" icon="alert">
              <p class="title-3">The {formatZar(paid)} deposit will not be refunded</p>
              <p class="callout">The free cancellation window has passed. If your plans have changed for a reason the café should know about, contact it before cancelling.</p>
            </Banner>
          )
        ) : (
          <p class="callout">There is nothing to refund on this booking.</p>
        )}
        {error ? <Banner tone="bad">{error}</Banner> : null}
      </div>
      <div class="sheet-foot">
        <Button
          variant="danger"
          block
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await sys.bookings.cancel(id, { actor, idempotencyKey: key });
              await settle();
              toast(r.refundMinor > 0 ? `Cancelled. ${formatZar(r.refundMinor)} is on its way back.` : 'Booking cancelled', 'check');
              close();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {b.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel booking'}
        </Button>
        <Button block onClick={close}>
          Keep it
        </Button>
      </div>
    </>
  );
}

export function UpcomingList() {
  const list = upcoming();
  if (list.length === 0) return null;
  return (
    <div class="stack">
      {list.map((b) => (
        <BookingCard key={b.id} b={b} onClick={() => push({ name: 'booking', id: b.id })} />
      ))}
    </div>
  );
}
