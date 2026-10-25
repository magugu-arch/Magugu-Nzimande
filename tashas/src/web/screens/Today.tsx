import { useState } from 'preact/hooks';
import { sys, track, getDevice } from '../app.ts';
import { openBook, openSheet, push, switchTab } from '../nav.ts';
import { Banner, Button, Check, IconButton, NavBar, Photo, SampleTag, SectionHead, errorMessage, toast, usePress } from '../components/ui.tsx';
import { Icon } from '../components/Icon.tsx';
import { branch, firstName, greeting, me, plural, upcoming, whenLabel } from '../format.ts';
import { formatZar } from '../../domain/util/core.ts';
import { formatDateShort } from '../../domain/util/time.ts';
import { downloadApp, publicUrl, shareApp, whatsappHref } from '../share.ts';

export function InboxButton() {
  const id = getDevice().guestId;
  const unread = sys.notifications.unreadCount(id);
  return <IconButton icon="bell" label="Inbox" badge={unread} onClick={() => push({ name: 'inbox' })} />;
}

export function PrototypePill() {
  const ref = usePress<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" class="tag sample pressable" style={{ height: '28px', padding: '0 10px' }} onClick={() => push({ name: 'about' })}>
      Prototype
    </button>
  );
}

export function TodayScreen() {
  const [query, setQuery] = useState('');
  const next = upcoming()[0];
  const guestId = getDevice().guestId;
  const rewards = sys.rewards.summary(guestId);
  const cheapest = [...sys.ctx.content.rewardRules.catalogue].sort((a, b) => a.pointsCost - b.pointsCost)[0]!;
  const highlights = ['avocado-toast', 'pancakes', 'cappuccino', 'layer-cake', 'croissant', 'grain-salad']
    .map((id) => sys.ctx.content.menuItems.find((m) => m.id === id)!)
    .filter(Boolean);
  const campaigns = sys.ctx.content.campaignPages.filter((c) => c.slug !== 'spring-tasting');

  return (
    <>
      <NavBar
        title="Tashas"
        large={false}
        leading={<span class="wordmark mobile-only" style={{ fontSize: '1.65rem', paddingLeft: '4px' }}>tashas</span>}
        trailing={
          <>
            <PrototypePill />
            <InboxButton />
          </>
        }
      />
      <div class="page-body">
        <div class="stack-sm" style={{ paddingTop: '4px' }}>
          <span class="caption">{greeting()}{firstName() ? `, ${firstName()}` : ''}</span>
        </div>

        <section class="hero wide" aria-label="This week">
          <Photo id="TASHAS-01" eager class="mobile-only" />
          <Photo id="TASHAS-06" class="desktop-only" />
          <div class="hero-copy">
            <span class="caption">This week at Tashas</span>
            <h1 class="display">Slow mornings, long tables</h1>
            <p class="callout">Breakfast at a café near you, with a table kept for you when you arrive.</p>
            <div class="row wrap" style={{ marginTop: '6px' }}>
              <Button variant="primary" icon="calendar" onClick={() => { track('booking_start', { source: 'today-hero' }); openBook({ source: 'today-hero' }); }}>
                Book a table
              </Button>
              <Button variant="on-photo" onClick={() => switchTab('menu')}>
                See the menu
              </Button>
            </div>
          </div>
        </section>

        <form
          class="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            track('branch_search', { from: 'today', hasQuery: query.trim().length > 0 });
            switchTab('cafes', { query: query.trim() });
          }}
        >
          <Icon name="search" size={19} />
          <label class="vh" for="today-search">Find a café</label>
          <input id="today-search" class="input" type="search" enterkeyhint="search" placeholder="Find a café by suburb or city" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        </form>

        {next ? <UpcomingCard id={next.id} /> : null}

        <button type="button" class="card pressable" style={{ textAlign: 'left', display: 'grid', gap: '12px' }} onClick={() => switchTab('rewards')}>
          <div class="row between">
            <div class="stack-sm">
              <span class="caption">Rewards · {rewards.tier.label}</span>
              <span class="title-2 num">{plural(rewards.balance, 'point')}</span>
            </div>
            <Icon name="rewards" size={26} />
          </div>
          <p class="footnote">
            {rewards.balance >= cheapest.pointsCost
              ? `You have enough for “${cheapest.title}”. Redeem it in Rewards.`
              : `${cheapest.pointsCost - rewards.balance} more points for “${cheapest.title}”.`}
          </p>
        </button>

        <section class="section">
          <SectionHead title="From the kitchen" eyebrow="Menu" action={<button class="link" type="button" onClick={() => switchTab('menu')}>All dishes</button>} />
          <div class="hscroll">
            {highlights.map((m) => (
              <button type="button" key={m.id} class="ed-card menu-tile pressable" onClick={() => { track('menu_item_view', { id: m.id, from: 'today' }); openSheet({ name: 'menu-item', id: m.id }); }}>
                <Photo id={m.imageId} />
                <span class="copy">
                  <span class="title-3">{m.name}</span>
                  <span class="price">{formatZar(m.priceMinor)} <span class="footnote">· sample price</span></span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section class="section">
          <SectionHead title="Stories and offers" eyebrow="Seasonal" />
          <div class="grid-2">
            {campaigns.map((c) => (
              <button type="button" key={c.slug} class="ed-card pressable" onClick={() => push({ name: 'campaign', slug: c.slug })}>
                <Photo id={c.heroImageId} />
                <span class="copy">
                  <span class="caption">{c.eyebrow}</span>
                  <span class="title-3">{c.title}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <EventsSection />

        <section class="section">
          <SectionHead title="Our cafés" eyebrow="Find a Tashas" action={<button class="link" type="button" onClick={() => switchTab('cafes')}>See all</button>} />
          <div class="hscroll">
            {sys.ctx.content.branches.map((b) => (
              <button type="button" key={b.id} class="ed-card cafe-tile pressable" onClick={() => { track('branch_view', { id: b.id, from: 'today' }); push({ name: 'cafe', id: b.id }); }}>
                <Photo id={b.heroImageId} ratio="4 / 3" />
                <span class="copy">
                  <span class="row" style={{ gap: '8px' }}>
                    <span class="title-3">{b.suburb}</span>
                    <SampleTag />
                  </span>
                  <span class="footnote">{b.city}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <Newsletter />
        <PrototypeCard />
      </div>
    </>
  );
}

function UpcomingCard({ id }: { id: string }) {
  const b = sys.bookings.booking(id);
  const br = branch(b.branchId);
  return (
    <button type="button" class="card pressable summary-card" style={{ textAlign: 'left' }} onClick={() => push({ name: 'booking', id })}>
      <Photo id={br.heroImageId} />
      <span class="stack-sm">
        <span class="caption">{b.status === 'waitlisted' ? 'On the waitlist' : 'Your next table'}</span>
        <span class="title-3">{whenLabel(b)}</span>
        <span class="footnote">
          {br.name} · {plural(b.partySize, 'guest')}
        </span>
        <span class="footnote mono">{b.reference}</span>
      </span>
    </button>
  );
}

function EventsSection() {
  const events = sys.ctx.content.events;
  return (
    <section class="section">
      <SectionHead title="At the long table" eyebrow="Events" />
      <div class="stack">
        {events.map((e) => {
          const when = sys.tickets.startsAt(e);
          const d = formatDateShort(when.date);
          const left = sys.tickets.placesLeft(e.id);
          return (
            <button type="button" key={e.id} class="card pressable summary-card" style={{ textAlign: 'left' }} onClick={() => push({ name: 'event', id: e.id })}>
              <Photo id={e.imageId} />
              <span class="stack-sm">
                <span class="row" style={{ gap: '8px' }}>
                  <span class="caption">{d.weekday} {d.day} {d.month} · {e.time}</span>
                  <SampleTag />
                </span>
                <span class="title-3">{e.title}</span>
                <span class="footnote">
                  {branch(e.branchId).suburb} · {formatZar(e.priceMinorPerGuest)} per guest · {left > 0 ? `${left} places left` : 'Full'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Newsletter() {
  const guest = me();
  const [email, setEmail] = useState(guest?.email ?? '');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!guest) return null;
  const subscribed = sys.consent.hasMarketingConsent(guest.id, 'email');
  const settings = sys.db.require('settings', 'global');
  return (
    <section class="card pad-0" aria-labelledby="news-title">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 0 }}>
        <Photo id="TASHAS-05" ratio="16 / 9" rounded="0" />
        <div class="stack" style={{ padding: '18px' }}>
          <span class="caption">Newsletter</span>
          <h2 class="title-2" id="news-title">
            New seasons on the menu, by email
          </h2>
          {subscribed ? (
            <Banner tone="good" icon="check">
              <p>You are subscribed by email. Change this any time in Notifications.</p>
            </Banner>
          ) : (
            <form
              class="stack"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (!agree) {
                  setError('Tick the box to agree to receive emails, or leave this for now.');
                  return;
                }
                try {
                  if (email.trim().toLowerCase() !== guest.email) {
                    sys.guests.updateContact(guest.id, { name: guest.name, email, phone: guest.phone ?? '' }, { kind: 'guest', id: guest.id });
                  }
                  sys.consent.grant(guest.id, 'email', 'newsletter-form', { kind: 'guest', id: guest.id });
                  track('newsletter_signup', {});
                  toast('Subscribed. You can unsubscribe any time.');
                } catch (err) {
                  setError(errorMessage(err));
                }
              }}
            >
              <div class="field">
                <label for="news-email">Email</label>
                <input id="news-email" class="input" type="email" autocomplete="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
              </div>
              <Check id="news-consent" checked={agree} onChange={setAgree}>
                {settings.consentText}
              </Check>
              {error ? <span class="field-error" role="alert">{error}</span> : null}
              <div class="row between wrap">
                <span class="footnote">Wording version {settings.consentTextVersion}</span>
                <Button type="submit" variant="primary" small>
                  Sign up
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export function PrototypeCard() {
  const url = publicUrl();
  return (
    <section class="card stack" aria-labelledby="proto-title">
      <div class="row" style={{ gap: '8px' }}>
        <span class="tag sample">Prototype</span>
        <span class="caption">Design and engineering review</span>
      </div>
      <h2 class="title-2" id="proto-title">
        Take this prototype with you
      </h2>
      <p class="callout">
        Bookings, deposits, messages and rewards here run against sandbox providers on this device. No table is reserved, no money moves and nothing is sent. Download the app as one HTML file that works offline.
      </p>
      <div class="row wrap">
        <Button variant="primary" icon="download" onClick={async () => toast((await downloadApp()).message, 'download')}>
          Download HTML
        </Button>
        <Button icon="share" onClick={async () => toast((await shareApp()).message, 'share')}>
          Share
        </Button>
        {url ? (
          <a class="btn" href={whatsappHref(url)} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={19} /> WhatsApp
          </a>
        ) : (
          <Button icon="chat" onClick={() => openSheet({ name: 'share' })}>
            WhatsApp
          </Button>
        )}
      </div>
    </section>
  );
}
