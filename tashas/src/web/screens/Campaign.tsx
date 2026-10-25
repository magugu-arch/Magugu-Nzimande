import { useEffect, useRef, useState } from 'preact/hooks';
import { getDevice, settle, sys, track } from '../app.ts';
import { openBook, openSheet, push, switchTab } from '../nav.ts';
import type { Route } from '../nav.ts';
import { Banner, Button, Check, KV, NavBar, Photo, SampleTag, Stepper, errorMessage, toast } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { SheetHead, useSheet } from '../components/Sheet.tsx';
import { branch, idempotencyKey, me, plural } from '../format.ts';
import { formatZar } from '../../domain/util/core.ts';
import { formatDateLong } from '../../domain/util/time.ts';
import { describeSource } from '../../domain/marketing/attribution.ts';

export function CampaignScreen({ route }: { route: Extract<Route, { name: 'campaign' }> }) {
  const page = sys.ctx.content.campaignPages.find((c) => c.slug === route.slug);
  const attribution = getDevice().attribution;
  const tracked = attribution?.lastTouch?.landingSlug === route.slug ? attribution : null;
  const [notifyOpen, setNotifyOpen] = useState(false);

  useEffect(() => {
    track('campaign_view', { slug: route.slug, tracked: !!tracked });
  }, [route.slug]);

  if (!page) return null;

  const act = () => {
    track('campaign_cta', { slug: page.slug, action: page.primary.action.kind });
    const a = page.primary.action;
    if (a.kind === 'book') openBook({ ...(a.period ? { period: a.period } : {}), ...(a.weekday !== undefined ? { weekday: a.weekday } : {}), source: `campaign:${page.slug}` });
    else if (a.kind === 'find-cafe') switchTab('cafes');
    else if (a.kind === 'event') push({ name: 'event', id: a.eventId });
    else if (a.kind === 'menu') switchTab('menu', { menuCategory: a.categoryId });
    else setNotifyOpen(true);
  };

  return (
    <div class="on-photo">
      <NavBar title={page.title} large={false} back onPhoto />
      <Photo id={page.heroImageId} ratio="4 / 5" rounded="0" eager class="campaign-hero" />
      <div class="page-body" style={{ marginTop: '-36px', position: 'relative' }}>
        <div class="card stack" style={{ borderRadius: 'var(--r-xl)', padding: '24px' }}>
          <div class="row" style={{ gap: '8px' }}>
            <span class="caption">{page.eyebrow}</span>
            <SampleTag label="Sample copy" />
          </div>
          <h1 class="display" style={{ fontSize: 'clamp(2rem, 7vw, 3rem)' }}>{page.title}</h1>
          <div class="prose">
            {page.body.map((p) => (
              <p class="body" key={p} style={{ color: 'var(--ink-2)' }}>{p}</p>
            ))}
          </div>
          <Button variant="primary" block icon={page.primary.action.kind === 'book' ? 'calendar' : page.primary.action.kind === 'notify' ? 'mail' : 'chevron'} onClick={act}>
            {page.primary.label}
          </Button>
          {notifyOpen ? <NotifyForm topic={page.slug} onDone={() => setNotifyOpen(false)} /> : null}
        </div>
        {tracked ? (
          <p class="footnote">
            <Icon name="qr" size={14} /> Sandbox: this visit is attributed to {describeSource(tracked)}. The source carries through to any booking and payment you make next.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function NotifyForm({ topic, onDone }: { topic: string; onDone: () => void }) {
  const guest = me()!;
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = sys.db.require('settings', 'global');
  if (sys.consent.hasMarketingConsent(guest.id, 'email')) {
    return (
      <Banner tone="good">
        <p>You are already on the email list, so you will hear when they launch.</p>
      </Banner>
    );
  }
  return (
    <div class="card flat stack">
      <p class="callout" style={{ color: 'var(--ink)' }}>We will email {guest.email} when there is news.</p>
      <Check id="notify-consent" checked={agree} onChange={setAgree}>
        {settings.consentText}
      </Check>
      {error ? <span class="field-error">{error}</span> : null}
      <Button
        variant="primary"
        small
        onClick={() => {
          if (!agree) {
            setError('Tick the box to agree, or close this.');
            return;
          }
          try {
            sys.consent.grant(guest.id, 'email', 'campaign-landing', { kind: 'guest', id: guest.id });
            track('campaign_conversion', { slug: topic, type: 'consent' });
            toast('We will let you know');
            onDone();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        Notify me
      </Button>
    </div>
  );
}

export function EventScreen({ id }: { id: string }) {
  const e = sys.ctx.content.events.find((x) => x.id === id);
  if (!e) return null;
  const when = sys.tickets.startsAt(e);
  const left = sys.tickets.placesLeft(e.id);
  const b = branch(e.branchId);
  const mine = sys.db.where('eventBookings', (x) => x.eventId === e.id && x.guestId === getDevice().guestId && x.status === 'confirmed');
  return (
    <div class="on-photo">
      <NavBar title={e.title} large={false} back onPhoto />
      <Photo id={e.imageId} ratio="4 / 5" rounded="0" eager />
      <div class="page-body" style={{ marginTop: '-36px', position: 'relative' }}>
        <div class="card stack" style={{ borderRadius: 'var(--r-xl)', padding: '24px' }}>
          <div class="row" style={{ gap: '8px' }}>
            <span class="caption">Event · {b.suburb}</span>
            <SampleTag label="Sample event" />
          </div>
          <h1 class="title-1">{e.title}</h1>
          <p class="body" style={{ color: 'var(--ink-2)' }}>{e.body}</p>
          <KV
            rows={[
              ['When', `${formatDateLong(when.date)} at ${e.time}`],
              ['Where', b.name],
              ['Length', `${Math.round(e.durationMinutes / 15) / 4} hours`],
              ['Price', `${formatZar(e.priceMinorPerGuest)} per guest`],
              ['Places left', left > 0 ? `${left} of ${e.capacity}` : 'Full'],
            ]}
          />
          {mine.length ? (
            <Banner tone="good">
              <p>You have {plural(mine.reduce((n, x) => n + x.partySize, 0), 'place')} booked. Reference {mine.map((m) => m.reference).join(', ')}.</p>
            </Banner>
          ) : null}
          <Button variant="primary" block icon="ticket" disabled={left === 0} onClick={() => { track('event_reserve_start', { id }); openSheet({ name: 'event-reserve', id }); }}>
            {left === 0 ? 'Fully booked' : 'Reserve places'}
          </Button>
          <p class="footnote">{e.terms}</p>
        </div>
      </div>
    </div>
  );
}

export function EventReserveSheet({ id }: { id: string }) {
  const e = sys.ctx.content.events.find((x) => x.id === id)!;
  const guest = me()!;
  const [party, setParty] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const key = useRef(idempotencyKey('event'));
  const { close } = useSheet();
  const left = sys.tickets.placesLeft(id);

  if (bookingId) {
    const eb = sys.db.require('eventBookings', bookingId);
    const payment = eb.paymentId ? sys.payments.get(eb.paymentId) : null;
    if (eb.status === 'confirmed') {
      return (
        <>
          <SheetHead title="You are booked" />
          <div class="sheet-body" style={{ justifyItems: 'center', textAlign: 'center' }}>
            <div class="success-mark"><Icon name="check" size={34} /></div>
            <h2 class="title-2">{e.title}</h2>
            <span class="reference">{eb.reference}</span>
            <p class="callout">{plural(eb.partySize, 'place')} · {formatZar(eb.amountMinor)} paid. The confirmation is in your inbox.</p>
            <Button variant="primary" onClick={close}>Done</Button>
          </div>
        </>
      );
    }
    return (
      <>
        <SheetHead title="Reserve places" />
        <div class="sheet-body" style={{ justifyItems: 'center', textAlign: 'center' }} aria-live="polite">
          {eb.status === 'failed' ? (
            <>
              <div class="success-mark" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" size={34} /></div>
              <p class="title-3">{payment?.status === 'succeeded' || payment?.status === 'refunded' || payment?.status === 'refund-pending' ? 'The event filled up while you were paying. Your payment is being refunded in full.' : 'Payment did not go through. You have not been charged.'}</p>
              <Button onClick={() => { key.current = idempotencyKey('event'); setBookingId(null); }}>Try again</Button>
            </>
          ) : (
            <>
              <span class="spinner" style={{ width: '38px', height: '38px' }} />
              <p class="callout">{payment && payment.status === 'pending' ? 'Finish paying in the secure checkout.' : 'Confirming your payment…'}</p>
              {payment && payment.status === 'pending' ? (
                <Button variant="primary" onClick={() => openSheet({ name: 'checkout', paymentId: payment.id, returnTo: { kind: 'event', id: eb.id } })}>Return to checkout</Button>
              ) : null}
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHead title="Reserve places" sub={e.title} />
      <div class="sheet-body">
        <div class="row between">
          <span class="title-3">Places</span>
          <Stepper label="Places" value={party} min={1} max={Math.min(6, left)} onChange={setParty} />
        </div>
        <div class="card row between">
          <span class="callout">{plural(party, 'place')} × {formatZar(e.priceMinorPerGuest)}</span>
          <span class="title-2 num">{formatZar(e.priceMinorPerGuest * party)}</span>
        </div>
        <p class="footnote">Booked for {guest.name} ({guest.email}). {e.terms}</p>
        {error ? <Banner tone="bad">{error}</Banner> : null}
      </div>
      <div class="sheet-foot">
        <Button
          variant="primary"
          block
          icon="lock"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await sys.tickets.reserve({ eventId: id, guestId: guest.id, partySize: party, idempotencyKey: key.current, attribution: getDevice().attribution });
              setBookingId(r.booking.id);
              openSheet({ name: 'checkout', paymentId: r.booking.paymentId!, returnTo: { kind: 'event', id: r.booking.id } });
              void settle();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Pay {formatZar(e.priceMinorPerGuest * party)}
        </Button>
      </div>
    </>
  );
}
