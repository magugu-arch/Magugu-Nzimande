import { useEffect, useState } from 'preact/hooks';
import { getDevice, setDevice, sys, track, useStore } from './app.ts';
import { navState, openBook, push, switchTab, useNav } from './nav.ts';
import type { Route, Sheet, Tab } from './nav.ts';
import { StackView } from './components/Stack.tsx';
import { SheetFrame } from './components/Sheet.tsx';
import { Button, Toasts, toast, usePress } from './components/ui.tsx';
import { Icon } from './components/Icon.tsx';
import { TodayScreen } from './screens/Today.tsx';
import { CafeDetail, CafesScreen } from './screens/Cafes.tsx';
import { MenuItemSheet, MenuScreen } from './screens/Menu.tsx';
import { BookSheet, CheckoutSheet, RescheduleSheet } from './screens/Book.tsx';
import { BookingDetail, BookingsList, CancelSheet } from './screens/Bookings.tsx';
import { RewardsScreen } from './screens/Rewards.tsx';
import { AboutScreen, AssetLibrary, DetailsScreen, FavouritesScreen, HelpScreen, InboxScreen, PreferencesScreen, PrivacyScreen, ProfileScreen, ShareSheet } from './screens/Account.tsx';
import { CampaignScreen, EventReserveSheet, EventScreen } from './screens/Campaign.tsx';
import { OpsScreen } from './screens/Ops.tsx';
import { downloadApp } from './share.ts';
import { parseAttribution, recordTouch } from '../domain/marketing/attribution.ts';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'cafes', label: 'Cafés', icon: 'pin' },
  { id: 'menu', label: 'Menu', icon: 'menu' },
  { id: 'rewards', label: 'Rewards', icon: 'rewards' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
];

function renderRoute(tab: Tab, route: Route) {
  switch (route.name) {
    case 'root':
      return tab === 'today' ? <TodayScreen /> : tab === 'cafes' ? <CafesScreen /> : tab === 'menu' ? <MenuScreen /> : tab === 'rewards' ? <RewardsScreen /> : tab === 'profile' ? <ProfileScreen /> : <OpsScreen />;
    case 'cafe':
      return <CafeDetail id={route.id} />;
    case 'campaign':
      return <CampaignScreen route={route} />;
    case 'event':
      return <EventScreen id={route.id} />;
    case 'booking':
      return <BookingDetail id={route.id} />;
    case 'attempt':
      return <BookingDetail id={`attempt:${route.id}`} />;
    case 'bookings':
      return <BookingsList />;
    case 'inbox':
      return <InboxScreen />;
    case 'preferences':
      return <PreferencesScreen />;
    case 'help':
      return <HelpScreen />;
    case 'privacy':
      return <PrivacyScreen />;
    case 'about':
      return <AboutScreen />;
    case 'assets':
      return <AssetLibrary />;
    case 'favourites':
      return <FavouritesScreen />;
    case 'details':
      return <DetailsScreen />;
  }
}

function sheetLabel(s: Sheet): string {
  switch (s.name) {
    case 'book':
      return 'Book a table';
    case 'reschedule':
      return 'Change booking';
    case 'menu-item':
      return 'Dish';
    case 'checkout':
      return 'Secure checkout (sandbox)';
    case 'cancel-booking':
      return 'Cancel booking';
    case 'event-reserve':
      return 'Reserve places';
    case 'share':
      return 'Share';
  }
}

function renderSheet(s: Sheet) {
  switch (s.name) {
    case 'book':
      return <BookSheet preset={s.preset} />;
    case 'reschedule':
      return <RescheduleSheet bookingId={s.bookingId} />;
    case 'menu-item':
      return <MenuItemSheet id={s.id} />;
    case 'checkout':
      return <CheckoutSheet paymentId={s.paymentId} returnTo={s.returnTo} />;
    case 'cancel-booking':
      return <CancelSheet id={s.id} />;
    case 'event-reserve':
      return <EventReserveSheet id={s.id} />;
    case 'share':
      return <ShareSheet />;
  }
}

function TabButton({ t, current }: { t: (typeof TABS)[number]; current: boolean }) {
  const ref = usePress<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" aria-current={current ? 'page' : undefined} onClick={() => switchTab(t.id)}>
      <Icon name={t.icon} size={25} stroke={current ? 1.9 : 1.6} />
      <span>{t.label}</span>
    </button>
  );
}

function Sidebar({ tab }: { tab: Tab }) {
  const unread = sys.notifications.unreadCount(getDevice().guestId);
  const items = [...TABS, { id: 'ops' as Tab, label: 'Operations', icon: 'ops' }];
  return (
    <aside class="sidebar" aria-label="Main">
      <div class="stack-sm" style={{ padding: '0 10px' }}>
        <span class="wordmark" style={{ fontSize: '2.2rem' }}>tashas</span>
        <span class="tag sample" style={{ justifySelf: 'start' }}>Prototype · sandbox</span>
      </div>
      <Button variant="primary" icon="calendar" onClick={() => { track('booking_start', { source: 'sidebar' }); openBook({ source: 'sidebar' }); }}>
        Book a table
      </Button>
      <nav>
        {items.map((t) => (
          <button type="button" key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => switchTab(t.id)}>
            <Icon name={t.icon} size={21} />
            {t.label}
          </button>
        ))}
        <button type="button" onClick={() => push({ name: 'inbox' })}>
          <Icon name="bell" size={21} />
          Inbox
          {unread ? <span class="tag good" style={{ marginLeft: 'auto' }}>{unread}</span> : null}
        </button>
      </nav>
      <div style={{ marginTop: 'auto' }} class="stack">
        <p class="footnote" style={{ padding: '0 10px' }}>
          Sandbox providers only: no real bookings, payments or messages. Sample café, menu and policy content.
        </p>
        <Button small icon="download" onClick={async () => toast((await downloadApp()).message, 'download')}>
          Download HTML
        </Button>
      </div>
    </aside>
  );
}

function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" style={{ position: 'fixed', zIndex: 70, top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: '50%', transform: 'translateX(-50%)', width: 'min(92vw, 460px)' }} class="toast">
      <Icon name="globe" size={18} />
      <span>Offline. The sandbox keeps working on this device; the live service will need a connection.</span>
    </div>
  );
}

/** Bare-token deep links (#book, #rewards, #ops …) and tracked campaign links (?utm_…). */
export function applyEntryLinks(): void {
  try {
    const attribution = parseAttribution(location.search);
    if (attribution && getDevice().measurement) {
      setDevice({ attribution: recordTouch(getDevice().attribution, { ...attribution, at: sys.ctx.clock.now() }) });
      if (attribution.landingSlug && sys.ctx.content.campaignPages.some((p) => p.slug === attribution.landingSlug)) {
        push({ name: 'campaign', slug: attribution.landingSlug, utm: attribution.utm, ...(attribution.campaignId ? { campaignId: attribution.campaignId } : {}) }, 'today');
      }
    }
  } catch {
    /* no query string in this frame */
  }
  const token = location.hash.replace('#', '');
  if (!token) return;
  if (token === 'book') openBook({ source: 'deep-link' });
  else if (['today', 'cafes', 'menu', 'rewards', 'profile', 'ops'].includes(token)) switchTab(token as Tab);
  else if (token === 'assets' || token === 'about' || token === 'inbox' || token === 'help' || token === 'privacy') {
    switchTab('profile');
    push({ name: token } as Route, 'profile');
  }
}

/**
 * The floating Book button stays out of the way: hidden while the Today hero's
 * own Book button is on screen, tucked away while scrolling down, back on the
 * way up.
 */
function useFabScroll(tab: Tab, depth: number): boolean {
  const [tucked, setTucked] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  useEffect(() => {
    const last = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!el.classList?.contains('page')) return;
      const y = el.scrollTop;
      const prev = last.get(el) ?? 0;
      last.set(el, y);
      if (el.querySelector('.hero')) setHeroInView(y < 420);
      if (y - prev > 6 && y > 80) setTucked(true);
      else if (prev - y > 6 || y < 40) setTucked(false);
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);
  useEffect(() => setTucked(false), [tab, depth]);
  const onTodayRoot = tab === 'today' && depth === 1;
  return !tucked && !(onTodayRoot && heroInView);
}

export function App() {
  useStore();
  const nav = useNav();
  const allTabs: Tab[] = ['today', 'cafes', 'menu', 'rewards', 'profile', 'ops'];
  const fabScroll = useFabScroll(nav.tab, nav.stacks[nav.tab].length);
  // Campaign and event pages carry their own primary action; the floating button would cover it.
  const top = nav.stacks[nav.tab].at(-1)?.name;
  const ownsAction = top === 'campaign' || top === 'event';
  const showFab = fabScroll && !ownsAction && nav.sheets.length === 0 && nav.tab !== 'ops' && nav.tab !== 'profile';
  return (
    <div class="app">
      <Sidebar tab={nav.tab} />
      <main class="stage" id="main">
        {allTabs.map((t) => (
          <StackView key={t} tab={t} active={nav.tab === t} stack={nav.stacks[t]} lastKind={navState().last.tab === t ? nav.last.kind : 'none'} render={(r) => renderRoute(t, r)} />
        ))}
      </main>
      <nav class="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <TabButton key={t.id} t={t} current={nav.tab === t.id} />
        ))}
      </nav>
      <Button variant="primary" icon="calendar" class={`book-fab ${showFab ? '' : 'hidden'}`} onClick={() => { track('booking_start', { source: 'floating' }); openBook({ source: 'floating' }); }}>
        Book a table
      </Button>
      {nav.sheets.map((s, i) => (
        <SheetFrame key={s.key} sheetKey={s.key} closing={s.closing} depth={i} label={sheetLabel(s.sheet)} compact={s.sheet.name === 'cancel-booking' || s.sheet.name === 'share'}>
          {renderSheet(s.sheet)}
        </SheetFrame>
      ))}
      <Toasts />
      <OfflineBanner />
    </div>
  );
}
