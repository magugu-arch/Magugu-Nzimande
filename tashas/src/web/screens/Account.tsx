import { useMemo, useState } from 'preact/hooks';
import { getDevice, setDevice, settle, sys } from '../app.ts';
import { openBook, openSheet, push, switchTab } from '../nav.ts';
import { Banner, Button, Disclosure, Empty, Field, IconButton, KV, NavBar, Photo, Row, SampleTag, SectionHead, Toggle, errorMessage, toast } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { SheetHead } from '../components/Sheet.tsx';
import { InboxButton, PrototypeCard } from './Today.tsx';
import { BookingCard } from './Bookings.tsx';
import { ago, branch, me, plural, upcoming } from '../format.ts';
import type { AppLink, Channel, NotificationCategory, NotificationRecord } from '../../domain/types.ts';
import { recordTouch } from '../../domain/marketing/attribution.ts';
import { MANIFEST_NOTE, brandAssets } from '../../content/assets.ts';
import { formatDateLong, dateKeyAt, timeKeyAt } from '../../domain/util/time.ts';
import { downloadApp, publicUrl, saveFile, shareApp, whatsappHref } from '../share.ts';
import { SAMPLE_GUEST } from '../../domain/seed.ts';
import { PROVIDER_CHECKLIST } from '../checklist.ts';

// ------------------------------------------------------------- profile

export function ProfileScreen() {
  const guest = me();
  const list = upcoming();
  const unread = guest ? sys.notifications.unreadCount(guest.id) : 0;
  const favourites = guest ? sys.db.where('favourites', (f) => f.guestId === guest.id).length : 0;
  if (!guest) return null;
  return (
    <>
      <NavBar title="Profile" trailing={<InboxButton />} />
      <div class="page-body">
        <button type="button" class="card pressable row" style={{ textAlign: 'left' }} onClick={() => push({ name: 'details' })}>
          <span style={{ width: '56px', height: '56px', borderRadius: '999px', background: 'var(--sage)', color: 'var(--sage-ink)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: '1.6rem', flex: 'none' }} aria-hidden="true">
            {guest.name.slice(0, 1)}
          </span>
          <span class="stack-sm grow">
            <span class="row" style={{ gap: '8px' }}>
              <span class="title-3">{guest.name}</span>
              {guest.email === SAMPLE_GUEST.email ? <SampleTag label="Sample profile" /> : null}
            </span>
            <span class="footnote">{guest.email}</span>
            <span class="footnote">{guest.phone}</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>

        <section class="section">
          <SectionHead title="Upcoming" action={<button type="button" class="link" onClick={() => push({ name: 'bookings' })}>All bookings</button>} />
          {list.length ? (
            <div class="stack">
              {list.map((b) => (
                <BookingCard key={b.id} b={b} onClick={() => push({ name: 'booking', id: b.id })} />
              ))}
            </div>
          ) : (
            <div class="card row between">
              <span class="callout">No upcoming bookings.</span>
              <Button small variant="primary" onClick={() => openBook({ source: 'profile' })}>
                Book
              </Button>
            </div>
          )}
        </section>

        <div class="group">
          <Row icon="calendar" title="Bookings" sub="Upcoming, past, changes and receipts" onClick={() => push({ name: 'bookings' })} />
          <Row icon="heart" title="Saved cafés and favourites" meta={favourites || undefined} onClick={() => push({ name: 'favourites' })} />
          <Row icon="rewards" title="Rewards" onClick={() => switchTab('rewards')} />
          <Row icon="bell" title="Inbox" meta={unread ? <span class="tag good">{unread} new</span> : undefined} onClick={() => push({ name: 'inbox' })} />
        </div>
        <div class="group">
          <Row icon="sliders" title="Notifications and consent" sub="Choose what we send and where" onClick={() => push({ name: 'preferences' })} />
          <Row icon="shield" title="Privacy and your data" sub="Download or delete what Tashas holds" onClick={() => push({ name: 'privacy' })} />
          <Row icon="info" title="Help" onClick={() => push({ name: 'help' })} />
        </div>
        <div class="group">
          <Row icon="sparkle" title="About this prototype" onClick={() => push({ name: 'about' })} />
          <Row icon="photo" title="Brand asset library" sub="All 28 supplied images with metadata" onClick={() => push({ name: 'assets' })} />
          <Row icon="ops" title="Staff operations" sub="Bookings, payments, messages, campaigns" onClick={() => switchTab('ops')} />
        </div>
      </div>
    </>
  );
}

export function DetailsScreen() {
  const guest = me()!;
  const [name, setName] = useState(guest.name);
  const [email, setEmail] = useState(guest.email ?? '');
  const [phone, setPhone] = useState(guest.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <NavBar title="Your details" back large={false} />
      <div class="page-body tight">
        <h1 class="title-1">Your details</h1>
        <p class="callout">Used to hold bookings and send their confirmations. We do not ask for anything else.</p>
        <form
          class="stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            try {
              sys.guests.updateContact(guest.id, { name, email, phone }, { kind: 'guest', id: guest.id });
              toast('Details saved');
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field id="me-name" label="Name">
            <input id="me-name" class="input" autocomplete="name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          </Field>
          <Field id="me-email" label="Email">
            <input id="me-email" class="input" type="email" autocomplete="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
          </Field>
          <Field id="me-phone" label="Mobile">
            <input id="me-phone" class="input" type="tel" autocomplete="tel" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} />
          </Field>
          {error ? <Banner tone="bad">{error}</Banner> : null}
          <Button type="submit" variant="primary">
            Save
          </Button>
        </form>
      </div>
    </>
  );
}

export function FavouritesScreen() {
  const guestId = getDevice().guestId;
  const favs = sys.db.where('favourites', (f) => f.guestId === guestId);
  const cafes = favs.filter((f) => f.kind === 'branch').map((f) => branch(f.refId));
  const dishes = favs.filter((f) => f.kind === 'menu-item').map((f) => sys.ctx.content.menuItems.find((m) => m.id === f.refId)!).filter(Boolean);
  return (
    <>
      <NavBar title="Saved" back />
      <div class="page-body">
        <section class="section">
          <SectionHead title="Cafés" />
          {cafes.length ? (
            <div class="group">
              {cafes.map((c) => (
                <Row key={c.id} icon="pin" title={c.name} sub={c.city} onClick={() => push({ name: 'cafe', id: c.id })} />
              ))}
            </div>
          ) : (
            <p class="callout">Tap the heart on a café to save it.</p>
          )}
        </section>
        <section class="section">
          <SectionHead title="Dishes" />
          {dishes.length ? (
            <div class="grid-2">
              {dishes.map((m) => (
                <button type="button" key={m.id} class="ed-card pressable" onClick={() => openSheet({ name: 'menu-item', id: m.id })}>
                  <Photo id={m.imageId} />
                  <span class="title-3">{m.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p class="callout">Save dishes from the menu to find them here.</p>
          )}
        </section>
      </div>
    </>
  );
}

// --------------------------------------------------------------- inbox

export function followLink(link: AppLink | null): void {
  if (!link) return;
  switch (link.screen) {
    case 'booking':
      if (link.id) push({ name: 'booking', id: link.id });
      return;
    case 'rewards':
      switchTab('rewards');
      return;
    case 'campaign':
      if (link.id) {
        if (link.utm) {
          const d = getDevice();
          setDevice({ attribution: recordTouch(d.attribution, { utm: link.utm, campaignId: link.campaignId ?? null, landingSlug: link.id, at: sys.ctx.clock.now() }) });
        }
        push({ name: 'campaign', slug: link.id, ...(link.utm ? { utm: link.utm } : {}), ...(link.campaignId ? { campaignId: link.campaignId } : {}) });
      }
      return;
    case 'event':
      if (link.id) push({ name: 'event', id: link.id });
      return;
    case 'book':
      openBook({ ...(link.id ? { branchId: link.id } : {}), source: 'inbox' });
      return;
    case 'preferences':
      push({ name: 'preferences' });
      return;
    case 'cafe':
      if (link.id) push({ name: 'cafe', id: link.id });
      return;
    case 'menu':
      switchTab('menu');
      return;
  }
}

export function InboxScreen() {
  const guestId = getDevice().guestId;
  const items = sys.notifications.inbox(guestId);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <NavBar
        title="Inbox"
        back
        trailing={unread ? <button type="button" class="btn quiet small" onClick={() => sys.notifications.markAllRead(guestId)}>Mark all read</button> : <IconButton icon="sliders" label="Notification settings" onClick={() => push({ name: 'preferences' })} />}
      />
      <div class="page-body tight">
        {items.length === 0 ? (
          <Empty icon="bell" title="Nothing here yet">
            <p class="footnote">Confirmations, receipts, reminders and reward notices appear here.</p>
          </Empty>
        ) : (
          <div class="group">
            {items.map((n) => (
              <InboxRow key={n.id} n={n} />
            ))}
          </div>
        )}
        <p class="footnote">Your inbox keeps booking confirmations, receipts and service messages even when email or push is switched off.</p>
      </div>
    </>
  );
}

function InboxRow({ n }: { n: NotificationRecord }) {
  const icon = n.kind === 'marketing' ? 'sparkle' : n.category === 'rewards' ? 'rewards' : n.templateId.startsWith('payment') ? 'receipt' : n.category === 'events' ? 'ticket' : 'calendar';
  return (
    <button
      type="button"
      class="list-row"
      style={{ alignItems: 'flex-start' }}
      onClick={() => {
        sys.notifications.markRead(n.id, { kind: 'guest', id: n.guestId });
        followLink(n.link);
      }}
    >
      <span class="lead" style={n.kind === 'marketing' ? { background: 'var(--warning-soft)', color: 'var(--warning)' } : undefined}>
        <Icon name={icon} size={17} />
      </span>
      <span class="stack-sm grow">
        <span class="row between" style={{ alignItems: 'baseline' }}>
          <span style={{ fontWeight: n.readAt ? 520 : 700 }}>{n.title}</span>
          <span class="footnote" style={{ flex: 'none' }}>{ago(n.scheduledAt)}</span>
        </span>
        <span class="footnote">{n.body}</span>
        {n.kind === 'marketing' ? <span class="footnote" style={{ color: 'var(--ink-3)' }}>Sent because you opted in. Manage in Notifications.</span> : null}
      </span>
      {!n.readAt ? <span aria-label="Unread" style={{ width: '9px', height: '9px', borderRadius: '99px', background: 'var(--sage)', marginTop: '7px', flex: 'none' }} /> : null}
    </button>
  );
}

// --------------------------------------------------------- preferences

const CATEGORY_COPY: Record<NotificationCategory, { title: string; sub: string }> = {
  booking: { title: 'Bookings', sub: 'Confirmations, changes and reminders' },
  service: { title: 'Payments and service', sub: 'Receipts, refunds and anything about a booking or payment' },
  events: { title: 'Event reminders', sub: 'For events you have booked' },
  rewards: { title: 'Rewards', sub: 'Points earned, rewards ready, points about to expire' },
  marketing: { title: 'News and offers', sub: 'New seasons, events and offers. Only with your permission.' },
};

const CHANNEL_LABEL: Record<Channel, string> = { 'in-app': 'Inbox', push: 'Push', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };

export function PreferencesScreen() {
  const guest = me()!;
  const prefs = sys.guests.preferences(guest.id);
  const settings = sys.db.require('settings', 'global');
  const actor = { kind: 'guest' as const, id: guest.id };
  const history = sys.consent.history(guest.id);

  const setChannel = (category: NotificationCategory, channel: Channel, on: boolean) => {
    const p = prefs.find((x) => x.category === category)!;
    const channels = on ? [...new Set([...p.channels, channel])] : p.channels.filter((c) => c !== channel);
    sys.guests.setPreference(guest.id, category, { channels, enabled: channels.length > 0 || p.enabled }, actor);
  };

  return (
    <>
      <NavBar title="Notifications" back />
      <div class="page-body">
        <p class="callout">
          Messages about bookings and payments are part of the service and always reach your inbox. News and offers are separate and only sent if you say yes, per channel. You can change your mind at any time.
        </p>

        {(['booking', 'service', 'events', 'rewards'] as NotificationCategory[]).map((cat) => {
          const p = prefs.find((x) => x.category === cat)!;
          const required = cat === 'booking' || cat === 'service';
          return (
            <section class="section" key={cat}>
              <div class="stack-sm">
                <h2 class="title-3">{CATEGORY_COPY[cat].title}</h2>
                <p class="footnote">{CATEGORY_COPY[cat].sub}</p>
              </div>
              <div class="group">
                {!required ? (
                  <div class="pref">
                    <span style={{ fontWeight: 560 }}>Allow</span>
                    <Toggle label={`Allow ${CATEGORY_COPY[cat].title}`} checked={p.enabled} onChange={(v) => sys.guests.setPreference(guest.id, cat, { enabled: v }, actor)} />
                  </div>
                ) : null}
                {(['in-app', 'email', 'push'] as Channel[]).map((ch) => {
                  const locked = required && ch === 'in-app';
                  const confirmations = required && ch === 'email';
                  return (
                    <div class="pref" key={ch}>
                      <span style={{ fontWeight: 520 }}>{CHANNEL_LABEL[ch]}</span>
                      <Toggle
                        label={`${CATEGORY_COPY[cat].title} by ${CHANNEL_LABEL[ch]}`}
                        checked={locked || p.channels.includes(ch)}
                        disabled={locked || (!required && !p.enabled) || (ch === 'push' && !guest.pushTokenValid)}
                        onChange={(v) => setChannel(cat, ch, v)}
                      />
                      {locked ? <span class="footnote">Always on</span> : null}
                      {confirmations ? <span class="footnote">Confirmations and receipts are always emailed</span> : null}
                      {ch === 'push' && !guest.pushTokenValid ? <span class="footnote">Allow push on this device first</span> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section class="section">
          <div class="stack-sm">
            <h2 class="title-3">{CATEGORY_COPY.marketing.title}</h2>
            <p class="footnote">{CATEGORY_COPY.marketing.sub}</p>
          </div>
          <div class="group">
            {(['email', 'push', 'sms', 'whatsapp'] as Channel[]).map((ch) => {
              const consent = sys.consent.current(guest.id, ch);
              const on = consent?.status === 'granted';
              const configured = sys.notifications.adapters[ch].configured;
              return (
                <div class="pref" key={ch}>
                  <span style={{ fontWeight: 520 }}>{CHANNEL_LABEL[ch]}</span>
                  <Toggle
                    label={`News and offers by ${CHANNEL_LABEL[ch]}`}
                    checked={on}
                    disabled={!configured || (ch === 'push' && !guest.pushTokenValid)}
                    onChange={(v) => {
                      try {
                        if (v) sys.consent.grant(guest.id, ch, 'preference-centre', actor);
                        else sys.consent.withdraw(guest.id, ch, 'preference-centre', actor);
                        void settle();
                        toast(v ? `Subscribed by ${CHANNEL_LABEL[ch]}` : `Unsubscribed from ${CHANNEL_LABEL[ch]}. This takes effect now.`);
                      } catch (err) {
                        toast(errorMessage(err), 'alert');
                      }
                    }}
                  />
                  <span class="footnote">
                    {!configured
                      ? 'Not available yet: needs an approved provider, sender and templates'
                      : consent
                        ? `${on ? 'Agreed' : 'Withdrawn'} ${formatDateLong(dateKeyAt(consent.capturedAt, 120))} at ${timeKeyAt(consent.capturedAt, 120)} · ${consent.source.replace(/-/g, ' ')}`
                        : 'Off'}
                  </span>
                </div>
              );
            })}
          </div>
          <p class="footnote">Turning one on means you agree to: “{settings.consentText}” (wording {settings.consentTextVersion}).</p>
        </section>

        <section class="section">
          <h2 class="title-3">This device</h2>
          <div class="group">
            <div class="pref">
              <span style={{ fontWeight: 520 }}>Push notifications</span>
              <Toggle
                label="Push notifications on this device"
                checked={guest.pushTokenValid}
                onChange={(v) => {
                  if (v) sys.guests.registerPushToken(guest.id, `sandbox-token-${sys.ctx.ids.id('dev')}`);
                  else sys.db.update('guests', guest.id, { pushTokenValid: false, pushToken: null });
                  toast(v ? 'Push allowed on this device' : 'Push switched off on this device');
                }}
              />
              <span class="footnote">Sandbox: registers a test device token. A native build asks the operating system for permission.</span>
            </div>
          </div>
        </section>

        {history.length ? (
          <Disclosure summary={`Consent history (${history.length})`}>
            {history.map((c) => (
              <p class="footnote" key={c.id}>
                {formatDateLong(dateKeyAt(c.capturedAt, 120))} {timeKeyAt(c.capturedAt, 120)} · {CHANNEL_LABEL[c.channel]} · {c.status} · {c.source.replace(/-/g, ' ')} · wording {c.consentTextVersion}
              </p>
            ))}
          </Disclosure>
        ) : null}
      </div>
    </>
  );
}

// ------------------------------------------------------------- privacy

export function PrivacyScreen() {
  const guest = me()!;
  const device = getDevice();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <NavBar title="Privacy" back />
      <div class="page-body">
        <Banner icon="shield" tone="neutral">
          <p>
            Sample privacy summary for review. Tashas will supply the final privacy notice, retention periods and terms after legal review under POPIA.
          </p>
        </Banner>
        <section class="section">
          <SectionHead title="What we hold and why" />
          <div class="card stack">
            <KV
              rows={[
                ['Name, email, mobile', 'To hold bookings and send confirmations'],
                ['Bookings and payments', 'To run your bookings and keep financial records'],
                ['Points and vouchers', 'To run rewards'],
                ['Marketing choices', 'To prove what you agreed to, and when'],
                ['Anonymous measurement', 'To see which screens help people book'],
              ]}
            />
            <p class="footnote">Card details are never collected by Tashas; payments go through the gateway’s secure checkout.</p>
          </div>
        </section>
        <section class="section">
          <SectionHead title="Your choices" />
          <div class="group">
            <div class="pref">
              <span style={{ fontWeight: 520 }}>Anonymous measurement</span>
              <Toggle label="Anonymous measurement" checked={device.measurement} onChange={(v) => setDevice({ measurement: v, ...(v ? {} : { attribution: null }) })} />
              <span class="footnote">Counts screens and campaign visits without your name or contact details. Turning it off also clears the campaign that brought you here.</span>
            </div>
            <Row icon="sliders" title="Marketing permissions" onClick={() => push({ name: 'preferences' })} />
            <Row icon="edit" title="Correct your details" onClick={() => push({ name: 'details' })} />
          </div>
        </section>
        <section class="section">
          <SectionHead title="Your data" />
          <div class="stack">
            <Button
              icon="download"
              onClick={async () => {
                const data = JSON.stringify(sys.guests.exportData(guest.id), null, 2);
                toast((await saveFile('tashas-my-data.json', data, 'application/json')).message, 'download');
              }}
            >
              Download my data (JSON)
            </Button>
            {!confirming ? (
              <Button variant="danger" icon="trash" onClick={() => setConfirming(true)}>
                Delete my personal data
              </Button>
            ) : (
              <div class="card stack">
                <p class="title-3">Delete your personal data?</p>
                <p class="callout">
                  Your name, email, mobile and saved items are removed now. Booking and payment records are kept without your details for the retention period finance requires, and your email stays on a do-not-contact list so marketing can never restart. Any upcoming bookings should be cancelled first.
                </p>
                <div class="row wrap">
                  <Button
                    variant="danger"
                    onClick={() => {
                      sys.guests.erase(guest.id, { kind: 'guest', id: guest.id });
                      const fresh = sys.guests.create({ name: SAMPLE_GUEST.name, email: `fresh.${Date.now().toString(36)}@example.com`, phone: SAMPLE_GUEST.phone });
                      setDevice({ guestId: fresh.id });
                      toast('Personal data deleted. A blank sample profile is now in use.');
                      setConfirming(false);
                    }}
                  >
                    Delete
                  </Button>
                  <Button onClick={() => setConfirming(false)}>Keep my data</Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- help

const FAQ: [string, string][] = [
  ['How do I change or cancel a booking?', 'Open the booking from your profile and choose Change or Cancel. Changes close a few hours before the booking; after that, please contact the café.'],
  ['When is a deposit needed, and when is it refunded?', 'Some cafés ask for a deposit for larger groups or busy services. It comes off your bill. Cancel inside the free window shown when you book for a full refund.'],
  ['Can I see allergen and dietary information?', 'Not yet in the app. Tashas will add it once each dish has been verified. Until then, please ask your server.'],
  ['We are a big group.', 'Online booking takes up to 12 guests. For more, contact the café directly.'],
  ['How do rewards work?', 'You earn points when the café confirms your visit. Redeem them for vouchers in Rewards and show the code at the till.'],
  ['What happens to my data?', 'See Privacy and your data in your profile. You can download it or ask for it to be deleted.'],
];

export function HelpScreen() {
  return (
    <>
      <NavBar title="Help" back />
      <div class="page-body">
        <section class="section">
          <SectionHead title="Questions" />
          <div class="stack">
            {FAQ.map(([q, a]) => (
              <Disclosure key={q} summary={q}>
                <p class="callout">{a}</p>
              </Disclosure>
            ))}
          </div>
        </section>
        <section class="section">
          <SectionHead title="Contact a café" />
          <div class="group">
            {sys.ctx.content.branches.map((b) => (
              <Row key={b.id} icon="pin" title={b.name} sub="Phone number to be verified · open the café for directions" onClick={() => push({ name: 'cafe', id: b.id })} />
            ))}
          </div>
        </section>
        <section class="section">
          <SectionHead title="If online booking is not working" />
          <div class="card stack">
            <p class="callout">If the app cannot reach the café’s booking system, it says so and books nothing. Try again in a few minutes, or contact the café directly. If you were charged and did not get a confirmation, your payment is safe: our team is alerted automatically and will confirm your table or refund you in full.</p>
          </div>
        </section>
        <section class="section">
          <SectionHead title="Privacy and terms" />
          <div class="group">
            <Row icon="shield" title="Privacy and your data" onClick={() => push({ name: 'privacy' })} />
            <Row icon="info" title="Terms of use" sub="To be supplied by Tashas" chevron={false} />
          </div>
        </section>
      </div>
    </>
  );
}

// --------------------------------------------------------------- about

export function AboutScreen() {
  return (
    <>
      <NavBar title="About" back />
      <div class="page-body">
        <div class="stack">
          <span class="wordmark" style={{ fontSize: '2.6rem' }}>tashas</span>
          <p class="callout">
            A working prototype of the Tashas guest app, built to the development brief for booking, payments, notifications and lifecycle marketing. It runs entirely in your browser.
          </p>
        </div>
        <section class="section">
          <SectionHead title="What works, end to end" />
          <div class="group">
            <Row icon="calendar" title="Booking lifecycle" sub="Live slot checks, holds, deposits, confirmation, change, cancel, waitlist and reconciliation" chevron={false} />
            <Row icon="card" title="Payments" sub="Hosted checkout, signed webhooks, deduplication, status API fallback, refunds, settlement export" chevron={false} />
            <Row icon="bell" title="Notifications" sub="Inbox, email and push adapters, reminders, retries, quiet hours, frequency caps" chevron={false} />
            <Row icon="shield" title="Consent" sub="Per-channel marketing consent with wording, version, source and suppression" chevron={false} />
            <Row icon="rewards" title="Rewards ledger" sub="Earn on verified visits only, redeem, expire, reverse, all idempotent" chevron={false} />
            <Row icon="megaphone" title="Campaigns" sub="Approval by a second person, audience preview, send-time checks, attribution" chevron={false} />
          </div>
        </section>
        <section class="section">
          <SectionHead title="What is not real yet" />
          <Banner icon="alert">
            <p>
              Providers are sandboxes: no table is reserved at a café, no money moves and no message leaves this page. Café details, menu, prices, events, reward rules and terms are samples marked as such. Tashas must supply approved data and provider access before anything goes live.
            </p>
          </Banner>
          <Disclosure summary={`Credentials and approvals still needed (${PROVIDER_CHECKLIST.length})`}>
            {PROVIDER_CHECKLIST.map((c) => (
              <p class="callout" key={c}>
                · {c}
              </p>
            ))}
          </Disclosure>
        </section>
        <PrototypeCard />
        <p class="footnote">
          Images: the 28 supplied photographs, embedded as web-sized derivatives; the originals are kept unchanged in the handover. Display type: Newsreader (SIL Open Font License), embedded.
        </p>
      </div>
    </>
  );
}

export function ShareSheet() {
  const url = publicUrl();
  return (
    <>
      <SheetHead title="Share on WhatsApp" />
      <div class="sheet-body">
        {url ? (
          <>
            <p class="callout">WhatsApp will open with a link to this app.</p>
            <a class="btn primary" href={whatsappHref(url)} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={19} /> Open WhatsApp
            </a>
          </>
        ) : (
          <>
            <Banner icon="info">
              <p>
                This copy of the app has no public web address yet, so there is no link anyone else could open. A file on this device or a preview frame cannot be shared as a link.
              </p>
            </Banner>
            <p class="callout">Download the app as one HTML file and send the file in WhatsApp instead, or share it through your device’s share sheet. Once the app is deployed at a stable HTTPS address, this button shares that link.</p>
            <Button variant="primary" icon="download" onClick={async () => toast((await downloadApp()).message, 'download')}>
              Download HTML
            </Button>
            <Button icon="share" onClick={async () => toast((await shareApp()).message, 'share')}>
              Share the file
            </Button>
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------- asset library

export function AssetLibrary() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<string>('all');
  const roles = ['all', ...new Set(brandAssets.map((a) => a.role))];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brandAssets.filter((a) => (role === 'all' || a.role === role) && (!q || `${a.id} ${a.title} ${a.altText} ${a.originalFilename} ${a.recommendedUse}`.toLowerCase().includes(q)));
  }, [query, role]);
  return (
    <>
      <NavBar title="Asset library" back />
      <div class="page-body tight">
        <p class="callout">The 28 supplied photographs and their metadata, from the manifest. Search by title, description, filename or use.</p>
        <p class="footnote">{MANIFEST_NOTE}</p>
        <div class="search">
          <Icon name="search" size={19} />
          <label class="vh" for="asset-search">Search images</label>
          <input id="asset-search" class="input" type="search" placeholder="Search title, description or filename" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        </div>
        <div class="hscroll">
          {roles.map((r) => (
            <button type="button" key={r} class="chip" aria-pressed={role === r ? 'true' : 'false'} onClick={() => setRole(r)}>
              {r === 'all' ? 'All' : r[0]!.toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <p class="footnote" aria-live="polite">{plural(list.length, 'image')}</p>
        <div class="grid-cards">
          {list.map((a) => (
            <article class="card pad-0" key={a.id}>
              <Photo id={a.id} ratio={`${a.width} / ${a.height}`} rounded="0" />
              <div class="stack" style={{ padding: '14px 16px 16px' }}>
                <div class="row between">
                  <span class="mono footnote">{a.id}</span>
                  <span class="tag">{a.role}</span>
                </div>
                <h3 class="title-3">{a.title}</h3>
                <p class="footnote">{a.altText}</p>
                <details>
                  <summary class="link" style={{ cursor: 'pointer' }}>Metadata</summary>
                  <div class="stack-sm" style={{ marginTop: '8px' }}>
                    <KV
                      rows={[
                        ['File', a.originalFilename],
                        ['Pixels', `${a.width} × ${a.height}`],
                        ['Size', `${(a.fileSizeBytes / 1048576).toFixed(3)} MB`],
                        ['EXIF fields', Object.keys(a.exif).join(', ')],
                        ['Camera, date', 'Not recorded in EXIF'],
                      ]}
                    />
                    <p class="footnote mono" style={{ overflowWrap: 'anywhere' }}>SHA-256 {a.sha256}</p>
                    <p class="footnote">Use: {a.recommendedUse}</p>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
